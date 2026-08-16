import express from 'express'
import dotenv from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'path'
import { pathToFileURL } from 'url'
import balanceRoutes from './routes/balanceRoutes.js'
import checkRoutes from './routes/checkRoutes.js'
import appAuthRoutes from './routes/appAuthRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import developerRoutes from './routes/developerRoutes.js'
import v1ApiRoutes from './routes/v1ApiRoutes.js'
import meRoutes from './routes/meRoutes.js'
import errorHandler from './middleware/errorHandler.js'
import { csrfOriginGuard } from './middleware/csrfOriginGuard.js'
import {
  globalApiRateLimiter,
  authRateLimiter,
  signupRateLimiter,
  verifyRateLimiter,
  topUpRateLimiter,
  apiV1RateLimiter,
} from './middleware/rateLimiters.js'
import { testConnection } from './db/index.js'
import { ensureTopUpReceiverDefaults } from './services/topUpAccountService.js'
import { ensureUserPaymentAccountsTable } from './services/userPaymentAccountService.js'
import { ensureRegistrationBonusUniqueIndex } from './services/balanceLedgerService.js'
import { isTrustedOrigin } from './config/clientOrigins.js'
import { assertRequiredEnv } from './config/requiredEnv.js'
import { probeBankConnectivity, getBankConnectivityStatus, startBankConnectivityMonitor } from './services/bankConnectivityProbe.js'
import { normalizeNativeClientOrigin } from './middleware/normalizeNativeClientOrigin.js'
import { fromNodeHeaders } from 'better-auth/node'

dotenv.config()

const app = express()

app.set('trust proxy', 1)

app.use(cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (isTrustedOrigin(origin)) {
      callback(null, origin);
      return;
    }
    // Expo / React Native may set an Origin that isn't a browser website — allow (not cross-site form CSRF).
    if (/^exp:\/\//i.test(origin) || /^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      callback(null, true);
      return;
    }
    console.warn(`CORS blocked for origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())
app.use('/api', globalApiRateLimiter)
app.use('/api', normalizeNativeClientOrigin)
app.use('/api', csrfOriginGuard)

async function mountAuthHandler() {
  try {
    const authModuleUrl = pathToFileURL(path.join(process.cwd(), './auth.mjs')).href
    const mod = await import(authModuleUrl)

    app.get('/api/auth/get-session', async (req, res) => {
      try {
        const session = await mod.auth.api.getSession({
          headers: fromNodeHeaders(req.headers),
        })
        res.json(session || null)
      } catch (error) {
        console.error('[auth] get-session failed:', error.message)
        res.status(500).json({ error: 'Failed to get session' })
      }
    })

    if (mod?.nodeHandler) {
      app.use('/api/auth', signupRateLimiter, authRateLimiter, mod.nodeHandler)
      console.log('✅ Mounted Better Auth handler at /api/auth')
    }
  } catch (err) {
    console.error('❌ Failed to mount auth handler', err)
  }
}

mountAuthHandler()

app.use('/api/balance/topup', topUpRateLimiter)
app.use('/api/balance', balanceRoutes)
app.use('/api/check', verifyRateLimiter, checkRoutes)
app.use('/api/me', meRoutes)
app.use('/api/users', appAuthRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/developer', developerRoutes)
app.use('/api/v1', apiV1RateLimiter, v1ApiRoutes)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    build: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    features: {
      cbeMbReceiptSms: true,
      cbeBranchReceiptRef: true,
      bankProbe: true,
    },
  })
})

app.get('/api/health/banks', async (req, res) => {
  try {
    const banks = await probeBankConnectivity()
    const allOk = banks.every((b) => b.ok)
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ok' : 'degraded',
      banks,
      cached: getBankConnectivityStatus(),
      time: new Date().toISOString(),
    })
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message })
  }
})

app.use(errorHandler)

const PORT = process.env.PORT || 5000

async function start() {
  if (process.env.NODE_ENV === 'production') {
    assertRequiredEnv()
  }

  const connected = await testConnection()
  if (!connected) {
    console.error('⚠️  Warning: Database connection test failed, but starting server anyway')
  } else {
    try {
      await ensureTopUpReceiverDefaults()
      await ensureApiKeysTable()
      await ensureUserPaymentAccountsTable()
      await ensureRegistrationBonusUniqueIndex()
    } catch (err) {
      console.error('⚠️  Warning: Could not seed top-up receiver accounts:', err.message)
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`)
    console.log(`📡 API available at http://localhost:${PORT}/api`)
    console.log(`📱 Android emulator: http://10.0.2.2:${PORT}/api`)
    if (process.env.NODE_ENV === 'production') {
      startBankConnectivityMonitor()
    }
  })
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
