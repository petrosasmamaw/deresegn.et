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
import errorHandler from './middleware/errorHandler.js'
import { testConnection } from './db/index.js'
import { ensureTopUpReceiverDefaults } from './services/topUpAccountService.js'
import { isTrustedOrigin } from './config/clientOrigins.js'
import { assertRequiredEnv } from './config/requiredEnv.js'

dotenv.config()

const app = express()

// Required on Render when behind a reverse proxy (X-Forwarded-* headers)
app.set('trust proxy', 1)

// CORS configuration for better-auth
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
    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}))

app.use(express.json({ limit: '2mb' }))
app.use(cookieParser())

// Mount Better Auth handler (dynamic import)
async function mountAuthHandler() {
  try {
    const authModuleUrl = pathToFileURL(path.join(process.cwd(), './auth.mjs')).href
    const mod = await import(authModuleUrl)

    app.get('/api/auth/get-session', async (req, res) => {
      try {
        const session = await mod.auth.api.getSession({
          headers: new Headers(req.headers),
        })
        res.json(session || null)
      } catch (error) {
        res.status(500).json({ error: 'Failed to get session' })
      }
    })

    if (mod?.nodeHandler) {
      app.use('/api/auth', mod.nodeHandler)
      console.log('✅ Mounted Better Auth handler at /api/auth')
    }
  } catch (err) {
    console.error('❌ Failed to mount auth handler', err)
  }
}

mountAuthHandler()

// Mount API routes
app.use('/api/balance', balanceRoutes)
app.use('/api/check', checkRoutes)
app.use('/api/users', appAuthRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    build: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    features: {
      cbeMbReceiptSms: true,
    },
  })
})

// Error handler must be last
app.use(errorHandler)

const PORT = process.env.PORT || 5000

// Test DB connection and start server
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
    } catch (err) {
      console.error('⚠️  Warning: Could not seed top-up receiver accounts:', err.message)
    }
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`)
    console.log(`📡 API available at http://localhost:${PORT}/api`)
  })
}

start().catch(err => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
