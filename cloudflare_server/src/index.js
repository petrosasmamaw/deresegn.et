import './polyfills.js';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { httpServerHandler } from 'cloudflare:node';
import { syncWorkerEnv } from './config/workerEnv.js';
import { isWorkersRuntime } from './config/runtime.js';
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
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
import { ensureApiKeysTable } from './services/apiKeyService.js'
import { ensureRegistrationBonusUniqueIndex } from './services/balanceLedgerService.js'
import { isTrustedOrigin } from './config/clientOrigins.js'
import { assertRequiredEnv } from './config/requiredEnv.js'
import { probeBankConnectivity, getBankConnectivityStatus, startBankConnectivityMonitor } from './services/bankConnectivityProbe.js'
import { normalizeNativeClientOrigin } from './middleware/normalizeNativeClientOrigin.js'
import { requestId } from './middleware/requestId.js'
import { fromNodeHeaders } from 'better-auth/node'
import { auth, nodeHandler } from '../auth.mjs'

dotenv.config();
syncWorkerEnv();

const app = express();

let bootPromise = null;
function ensureBoot() {
  if (!bootPromise) bootPromise = bootstrap();
  return bootPromise;
}

app.use(async (req, res, next) => {
  try {
    await ensureBoot();
    next();
  } catch (err) {
    next(err);
  }
});

app.set('trust proxy', 1)

// Security headers. This is a JSON API (no server-rendered HTML), so CSP and
// cross-origin embedder policies are disabled to avoid interfering with CORS,
// image delivery, or the Better Auth redirect flow. HSTS activates on HTTPS.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}))

// Correlate logs per request; echoes X-Request-Id back to the caller.
app.use(requestId)

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

app.get('/api/auth/get-session', async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    res.json(session || null);
  } catch (error) {
    console.error('[auth] get-session failed:', error.message);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

app.all('/api/auth/*', async (req, res, next) => {
  try {
    const url = `${req.protocol}://${req.get('host') || 'localhost'}${req.originalUrl}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value != null) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }
    const init = {
      method: req.method,
      headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
    }
    const webReq = new Request(url, init);
    const webRes = await auth.handler(webReq);
    res.status(webRes.status);
    webRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const bodyText = await webRes.text();
    res.send(bodyText);
  } catch (err) {
    next(err);
  }
});
console.log('✅ Mounted Better Auth handler at /api/auth');

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

const WORKER_HTTP_PORT = Number(process.env.WORKER_HTTP_PORT || 3000);

async function bootstrap() {
  if (isWorkersRuntime()) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    try {
      assertRequiredEnv();
    } catch (err) {
      console.error('[boot] env validation:', err.message);
    }
  }

  const connected = await testConnection();
  if (!connected) {
    console.error('⚠️  Database connection test failed');
    return;
  }

  try {
    await ensureTopUpReceiverDefaults();
    await ensureApiKeysTable();
    await ensureUserPaymentAccountsTable();
    await ensureRegistrationBonusUniqueIndex();
  } catch (err) {
    console.error('⚠️  Boot seed warning:', err.message);
  }

  if (process.env.NODE_ENV === 'production') {
    startBankConnectivityMonitor();
  }
}

app.listen(WORKER_HTTP_PORT, () => {
  console.log(`🚀 Express on Workers port ${WORKER_HTTP_PORT}`);
});

export default httpServerHandler({ port: WORKER_HTTP_PORT });
