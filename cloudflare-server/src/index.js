if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
    }
  };
}

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from '../auth.mjs';
import balanceRoutes from './routes/balanceRoutes.js';
import checkRoutes from './routes/checkRoutes.js';
import appAuthRoutes from './routes/appAuthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import developerRoutes from './routes/developerRoutes.js';
import v1ApiRoutes from './routes/v1ApiRoutes.js';
import meRoutes from './routes/meRoutes.js';
import { csrfOriginGuard } from './middleware/csrfOriginGuard.js';
import {
  globalApiRateLimiter,
  authRateLimiter,
  signupRateLimiter,
  verifyRateLimiter,
  topUpRateLimiter,
  apiV1RateLimiter,
} from './middleware/rateLimiters.js';
import { normalizeNativeClientOrigin } from './middleware/normalizeNativeClientOrigin.js';
import { isTrustedOrigin } from './config/clientOrigins.js';
import { probeBankConnectivity, getBankConnectivityStatus } from './services/bankConnectivityProbe.js';
import { ensureTopUpReceiverDefaults } from './services/topUpAccountService.js';
import { ensureUserPaymentAccountsTable } from './services/userPaymentAccountService.js';
import { ensureApiKeysTable } from './services/apiKeyService.js';
import { ensureRegistrationBonusUniqueIndex } from './services/balanceLedgerService.js';
import { testConnection } from './db/index.js';
import { db } from './config/drizzle.js';
import * as schema from './db/schema.js';
import { eq, or } from 'drizzle-orm';

const app = new Hono();

let tablesInitialized = false;
async function ensureInitTables() {
  if (tablesInitialized) return;
  tablesInitialized = true;
  try {
    await Promise.allSettled([
      ensureTopUpReceiverDefaults(),
      ensureApiKeysTable(),
      ensureUserPaymentAccountsTable(),
      ensureRegistrationBonusUniqueIndex(),
    ]);
  } catch (err) {
    console.warn('[Init] Table initialization warning:', err.message);
  }
}

// 1. Environment propagation middleware
// Synchronizes Cloudflare Worker env bindings into process.env for downstream services
app.use('*', async (c, next) => {
  if (c.env && typeof c.env === 'object') {
    for (const [key, value] of Object.entries(c.env)) {
      if (typeof value === 'string' && value) {
        process.env[key] = value;
      }
    }
  }

  const reqId = c.req.header('x-request-id') || crypto.randomUUID();
  c.header('X-Request-Id', reqId);

  // Security headers
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'SAMEORIGIN');
  c.header('Referrer-Policy', 'no-referrer');

  ensureInitTables().catch(() => {});

  await next();
});

// 2. CORS middleware matching existing server behavior
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return origin;
      if (isTrustedOrigin(origin)) return origin;
      if (/^exp:\/\//i.test(origin) || /^http:\/\/(10\.0\.2\.2|localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return origin;
      }
      return null;
    },
    credentials: true,
    allowMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'authorization',
      'X-Requested-With',
      'X-Tamagn-Client',
      'X-Tamagn-Platform',
      'X-Api-Key',
      'X-Session-Token',
      'Accept',
      'Origin',
    ],
    exposeHeaders: [
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Auth-Token',
      'x-auth-token',
      'Set-Cookie',
    ],
  }),
);

// 3. Global shield, origin normalization, CSRF guard
app.use('/api/*', globalApiRateLimiter);
app.use('/api/*', normalizeNativeClientOrigin);
app.use('/api/*', csrfOriginGuard);

// 4. Better Auth handlers (Native Web Standards on Cloudflare Workers)
app.get('/api/auth/get-session', async (c) => {
  try {
    let session = null;

    // 1. Try Better Auth's native getSession
    try {
      session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
    } catch (authErr) {
      console.warn('[auth] get-session native error:', authErr.message);
    }

    // 2. Fallback: extract token if Better Auth native getSession did not resolve
    if (!session?.user) {
      const authHeader = c.req.header('authorization') || c.req.header('Authorization');
      let token = null;

      if (authHeader && /^Bearer\s+/i.test(authHeader)) {
        token = authHeader.replace(/^Bearer\s+/i, '').trim();
      } else {
        token = c.req.header('x-session-token');
        if (!token) {
          const cookieHeader = c.req.header('cookie') || '';
          const match = cookieHeader.match(/(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
          if (match) {
            token = decodeURIComponent(match[1].trim());
          }
        }
      }

      if (token) {
        try {
          const rawToken = token.includes('.') ? token.split('.')[0] : token;
          const sessions = await db
            .select()
            .from(schema.session)
            .where(or(eq(schema.session.token, token), eq(schema.session.token, rawToken)))
            .limit(1);

          if (sessions.length > 0) {
            const dbSession = sessions[0];
            const expiresAt = new Date(dbSession.expiresAt).getTime();
            if (expiresAt > Date.now()) {
              const users = await db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, dbSession.userId))
                .limit(1);

              if (users.length > 0) {
                session = {
                  session: dbSession,
                  user: users[0],
                };
              }
            }
          }
        } catch (dbErr) {
          console.warn('[auth] get-session DB fallback error:', dbErr.message);
        }
      }
    }

    return c.json(session || null);
  } catch (error) {
    console.error('[auth] get-session failed:', error.message);
    return c.json({ error: 'Failed to get session' }, 500);
  }
});

app.all('/api/auth/*', signupRateLimiter, authRateLimiter, async (c) => {
  const res = await auth.handler(c.req.raw);
  const setCookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : res.headers.get('set-cookie')
      ? [res.headers.get('set-cookie')]
      : [];

  const origin = c.req.header('origin');
  const trusted = origin && isTrustedOrigin(origin);
  const newHeaders = new Headers(res.headers);

  if (origin && trusted) {
    newHeaders.set('Access-Control-Allow-Origin', origin);
    newHeaders.set('Access-Control-Allow-Credentials', 'true');
  }

  let sessionToken = null;

  if (setCookies.length > 0) {
    newHeaders.delete('set-cookie');
    for (const cookieStr of setCookies) {
      let patched = cookieStr;
      if (/SameSite=(Lax|Strict)/i.test(patched)) {
        patched = patched.replace(/SameSite=(Lax|Strict)/i, 'SameSite=None');
      } else if (!/SameSite=/i.test(patched)) {
        patched += '; SameSite=None';
      }
      if (!/Secure/i.test(patched)) {
        patched += '; Secure';
      }
      if (!/Partitioned/i.test(patched)) {
        patched += '; Partitioned';
      }
      newHeaders.append('set-cookie', patched);

      const m = cookieStr.match(/(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
      if (m) {
        sessionToken = decodeURIComponent(m[1].trim());
      }
    }
  }

  if (sessionToken) {
    newHeaders.set('X-Auth-Token', sessionToken);
  }

  // If response is JSON, ensure token is attached to JSON body so frontend can easily store it
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      const text = await res.text();
      let bodyData = JSON.parse(text);
      if (typeof bodyData === 'object' && bodyData !== null) {
        if (!bodyData.token && sessionToken) {
          bodyData.token = sessionToken;
        }
        const updatedBody = JSON.stringify(bodyData);
        newHeaders.set('Content-Length', String(new TextEncoder().encode(updatedBody).length));
        return new Response(updatedBody, {
          status: res.status,
          statusText: res.statusText,
          headers: newHeaders,
        });
      }
      return new Response(text, {
        status: res.status,
        statusText: res.statusText,
        headers: newHeaders,
      });
    } catch {
      // ignore parse error, return as is
    }
  }

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
});

// 5. Application routes
app.use('/api/balance/topup', topUpRateLimiter);
app.route('/api/balance', balanceRoutes);

app.use('/api/check', verifyRateLimiter);
app.route('/api/check', checkRoutes);

app.route('/api/me', meRoutes);
app.route('/api/users', appAuthRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/developer', developerRoutes);

app.use('/api/v1/*', apiV1RateLimiter);
app.route('/api/v1', v1ApiRoutes);

// 6. Health & diagnostic endpoints
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    time: new Date().toISOString(),
    runtime: 'cloudflare_workers',
    platform: 'Hono',
    features: {
      cbeMbReceiptSms: true,
      cbeBranchReceiptRef: true,
      bankProbe: true,
    },
  });
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

// Root ping
app.get('/', (c) => {
  return c.text('Deresegn Cloudflare Worker API is active');
});

// 7. Global error handler
app.onError((err, c) => {
  console.error('[Global Error]', err);
  return c.json(
    {
      success: false,
      message: err.message || 'Internal Server Error',
    },
    500,
  );
});

export default app;
