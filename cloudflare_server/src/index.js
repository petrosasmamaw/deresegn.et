import './polyfills.js';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDb } from './config/drizzle.js';
import { createAuth } from '../auth.mjs';
import {
  syncEnvToProcess,
  runWithRequestContext,
} from './config/requestContext.js';
import { isTrustedOrigin, getTrustedOrigins } from './config/clientOrigins.js';
import { requestId } from './middleware/requestId.js';
import { csrfOriginGuardHono } from './middleware/csrfOriginGuard.js';
import {
  globalApiRateLimiter,
  authRateLimiter,
  signupRateLimiter,
  verifyRateLimiter,
  topUpRateLimiter,
  apiV1RateLimiter,
} from './middleware/rateLimiters.js';
import { registerBalanceRoutes } from './routes/balanceRoutes.js';
import { registerCheckRoutes } from './routes/checkRoutes.js';
import { registerAppAuthRoutes } from './routes/appAuthRoutes.js';
import { registerAdminRoutes } from './routes/adminRoutes.js';
import { registerDeveloperRoutes } from './routes/developerRoutes.js';
import { registerV1ApiRoutes } from './routes/v1ApiRoutes.js';
import { registerMeRoutes } from './routes/meRoutes.js';
import { probeBankConnectivity, getBankConnectivityStatus } from './services/bankConnectivityProbe.js';
import { getPrimaryClientOrigin } from './config/clientOrigins.js';

const app = new Hono();

app.use('*', requestId());

// CORS first — OPTIONS preflight must never wait on Neon / Better Auth.
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return '*';
      if (isTrustedOrigin(origin)) return origin;
      if (/^exp:\/\//i.test(origin)) return origin;
      if (/^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
      if (/^http:\/\/(localhost|127\.0\.0\.1):8787$/i.test(origin)) return origin;
      console.warn(`CORS blocked for origin: ${origin}`);
      return null;
    },
    allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Tamagn-Client',
      'X-Tamagn-Platform',
      'X-API-Key',
      'X-Request-Id',
      'Cookie',
    ],
    exposeHeaders: ['X-Request-Id', 'Set-Cookie'],
    maxAge: 86400,
  }),
);

app.options('*', (c) => c.body(null, 204));

// Lightweight routes — no DB (so a bad DATABASE_URL cannot take down health).
app.get('/', (c) =>
  c.json({
    name: 'Deresegn API',
    runtime: 'cloudflare-workers',
    framework: 'hono',
    health: '/api/health',
  }),
);

app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    time: new Date().toISOString(),
    build: c.env?.CF_VERSION_METADATA?.id?.slice?.(0, 7) || 'dev',
    runtime: 'cloudflare-workers',
    features: {
      cbeMbReceiptSms: true,
      cbeBranchReceiptRef: true,
      bankProbe: true,
    },
  }),
);

app.use('*', async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    await next();
    return;
  }
  // Health already handled above
  if (c.req.path === '/' || c.req.path === '/api/health') {
    await next();
    return;
  }

  const env = c.env || {};
  syncEnvToProcess(env);

  try {
    const { default: cloudinary } = await import('./config/cloudinary.js');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  } catch {
    // ignore
  }

  try {
    const db = createDb(env);
    const auth = createAuth(db, env);
    await runWithRequestContext({ env, db, auth }, async () => {
      await next();
    });
  } catch (err) {
    console.error('[boot-context]', err?.message || err, err?.stack);
    return c.json(
      {
        success: false,
        message: err?.message || 'Failed to initialize request context',
        code: 'CONTEXT_INIT_FAILED',
        requestId: c.get('requestId'),
      },
      500,
    );
  }
});

app.use('/api/*', globalApiRateLimiter);
app.use('/api/*', async (c, next) => {
  const isMobile =
    c.req.header('x-tamagn-client') === '1' &&
    String(c.req.header('x-tamagn-platform') || '').toLowerCase() === 'mobile';
  if (isMobile) {
    const origin = c.req.header('origin');
    const bad = !origin || origin === 'null' || /^exp:\/\//i.test(origin);
    if (bad) {
      const primary = getPrimaryClientOrigin();
      if (primary) c.set('normalizedOrigin', primary);
    }
  }
  await next();
});
app.use('/api/*', csrfOriginGuardHono);

app.get('/api/health/db', async (c) => {
  try {
    const { getRequestDb } = await import('./config/requestContext.js');
    const database = getRequestDb();
    await database.execute('select 1 as ok');
    return c.json({ status: 'ok', db: true, time: new Date().toISOString() });
  } catch (err) {
    console.error('[health/db]', err?.message || err);
    return c.json(
      {
        status: 'error',
        db: false,
        message: err?.message || 'Database check failed',
        requestId: c.get('requestId'),
      },
      500,
    );
  }
});

app.get('/api/health/banks', async (c) => {
  try {
    const banks = await probeBankConnectivity();
    const allOk = banks.every((b) => b.ok);
    return c.json(
      {
        status: allOk ? 'ok' : 'degraded',
        banks,
        cached: getBankConnectivityStatus(),
        time: new Date().toISOString(),
      },
      allOk ? 200 : 503,
    );
  } catch (err) {
    return c.json({ status: 'error', message: err.message }, 500);
  }
});

app.get('/api/auth/get-session', authRateLimiter, async (c) => {
  try {
    const { getRequestAuth } = await import('./config/requestContext.js');
    const authInstance = getRequestAuth();
    let request = c.req.raw;
    const normalizedOrigin = c.get('normalizedOrigin');
    if (normalizedOrigin) {
      const headers = new Headers(request.headers);
      headers.set('origin', normalizedOrigin);
      request = new Request(request, { headers });
    }
    const session = await authInstance.api.getSession({ headers: request.headers });
    return c.json(session || null);
  } catch (error) {
    console.error('[auth] get-session failed:', error?.message || error, error?.stack);
    return c.json(
      {
        error: 'Failed to get session',
        message: error?.message || 'Failed to get session',
        requestId: c.get('requestId'),
      },
      500,
    );
  }
});

app.on(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'], '/api/auth/sign-up/*', signupRateLimiter);
app.on(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'], '/api/auth/sign-up/email', signupRateLimiter);

app.on(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'], '/api/auth/*', authRateLimiter, async (c) => {
  try {
    const { getRequestAuth } = await import('./config/requestContext.js');
    const authInstance = getRequestAuth();

    let request = c.req.raw;
    const normalizedOrigin = c.get('normalizedOrigin');
    if (normalizedOrigin) {
      const headers = new Headers(request.headers);
      headers.set('origin', normalizedOrigin);
      if (!headers.get('referer')) headers.set('referer', `${normalizedOrigin}/`);
      request = new Request(request, { headers });
    }

    return await authInstance.handler(request);
  } catch (error) {
    console.error('[auth] handler failed:', error?.message || error, error?.stack);
    return c.json(
      {
        success: false,
        message: error?.message || 'Auth handler failed',
        requestId: c.get('requestId'),
      },
      500,
    );
  }
});

app.use('/api/balance/topup/*', topUpRateLimiter);
app.use('/api/balance/topup', topUpRateLimiter);
app.use('/api/check/*', verifyRateLimiter);
app.use('/api/check', verifyRateLimiter);
app.use('/api/v1/*', apiV1RateLimiter);
app.use('/api/v1', apiV1RateLimiter);

registerBalanceRoutes(app);
registerCheckRoutes(app);
registerMeRoutes(app);
registerAppAuthRoutes(app);
registerAdminRoutes(app);
registerDeveloperRoutes(app);
registerV1ApiRoutes(app);

app.onError((err, c) => {
  console.error('[Worker]', err?.message || err, err?.stack);
  const status = err.status || err.statusCode || 500;
  // Surface real messages for auth/config failures so prod is diagnosable.
  const expose =
    status < 500 ||
    /DATABASE_URL|BETTER_AUTH|not configured|not initialized|CONTEXT_INIT/i.test(
      String(err?.message || ''),
    );
  return c.json(
    {
      success: false,
      message: expose ? err.message || 'Internal Server Error' : 'Internal Server Error',
      requestId: c.get('requestId'),
    },
    status,
  );
});

app.notFound((c) =>
  c.json({ success: false, message: 'Not found', path: c.req.path }, 404),
);

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};

export { app, getTrustedOrigins };
