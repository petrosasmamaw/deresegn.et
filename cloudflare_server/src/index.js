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

app.use('*', async (c, next) => {
  const env = c.env || {};
  syncEnvToProcess(env);

  // Reconfigure Cloudinary from bindings each request (module may load before env).
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

  const db = createDb(env);
  const auth = createAuth(db, env);

  await runWithRequestContext({ env, db, auth }, async () => {
    await next();
  });
});

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin || '*';
      if (isTrustedOrigin(origin)) return origin;
      if (/^exp:\/\//i.test(origin)) return origin;
      if (/^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
      // Wrangler local
      if (/^http:\/\/(localhost|127\.0\.0\.1):8787$/i.test(origin)) return origin;
      console.warn(`CORS blocked for origin: ${origin}`);
      return null;
    },
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
  }),
);

app.use('/api/*', globalApiRateLimiter);
app.use('/api/*', async (c, next) => {
  // Normalize native mobile Origin for Better Auth
  const isMobile =
    c.req.header('x-tamagn-client') === '1' &&
    String(c.req.header('x-tamagn-platform') || '').toLowerCase() === 'mobile';
  if (isMobile) {
    const origin = c.req.header('origin');
    const bad = !origin || origin === 'null' || /^exp:\/\//i.test(origin);
    if (bad) {
      const primary = getPrimaryClientOrigin();
      if (primary) {
        // Cannot mutate Request headers in Workers easily; Better Auth reads
        // from the Request we pass — handled in auth mount below via rewritten headers.
        c.set('normalizedOrigin', primary);
      }
    }
  }
  await next();
});
app.use('/api/*', csrfOriginGuardHono);

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

// Better Auth — fetch handler (specific routes before wildcard)
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
    console.error('[auth] get-session failed:', error.message);
    return c.json({ error: 'Failed to get session' }, 500);
  }
});

app.on(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'], '/api/auth/sign-up/*', signupRateLimiter);
app.on(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'], '/api/auth/sign-up/email', signupRateLimiter);

app.on(['POST', 'GET', 'PUT', 'PATCH', 'DELETE'], '/api/auth/*', authRateLimiter, async (c) => {
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

  return authInstance.handler(request);
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
  console.error('[Worker]', err);
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  return c.json(
    {
      success: false,
      message: status >= 500 && isProd ? 'Internal Server Error' : err.message || 'Internal Server Error',
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
