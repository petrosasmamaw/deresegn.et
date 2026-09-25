import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.dev.vars' });

const API_BASE = 'https://deresegn-cloudflare-server.asmamawpetros.workers.dev/api';
const ORIGIN = 'https://tamagncheck.online';

const results = [];
function report(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusStr} [${name}] ${detail}`);
}

async function run() {
  console.log('======================================================');
  console.log('  TESTING LIVE DEPLOYED CLOUDFLARE WORKER API');
  console.log('  Base URL:', API_BASE);
  console.log('  Target Origin:', ORIGIN);
  console.log('======================================================\n');

  // 1. Health check
  try {
    const res = await fetch(`${API_BASE}/health`, {
      headers: { Origin: ORIGIN },
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    report(
      'GET /health',
      res.status === 200 && data.status === 'ok' && hasCors,
      `Status: ${res.status}, Runtime: ${data.runtime}, CORS: ${hasCors ? 'OK' : 'MISSING'}`,
    );
  } catch (err) {
    report('GET /health', false, err.message);
  }

  // 2. Bank connectivity probe
  try {
    const res = await fetch(`${API_BASE}/health/banks`, {
      headers: { Origin: ORIGIN },
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    report(
      'GET /health/banks',
      [200, 503].includes(res.status) && hasCors,
      `Status: ${res.status}, Banks: ${data.banks?.map(b => `${b.bank}:${b.ok}`).join(', ')}, CORS: ${hasCors ? 'OK' : 'MISSING'}`,
    );
  } catch (err) {
    report('GET /health/banks', false, err.message);
  }

  // 3. Channels catalog
  try {
    const res = await fetch(`${API_BASE}/check/channels`, {
      headers: { Origin: ORIGIN },
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    report(
      'GET /check/channels',
      res.status === 200 && data.success && hasCors,
      `Status: ${res.status}, Success: ${data.success}, Channels count: ${Object.keys(data.data || {}).length}, CORS: ${hasCors ? 'OK' : 'MISSING'}`,
    );
  } catch (err) {
    report('GET /check/channels', false, err.message);
  }

  // 4. CORS Preflight OPTIONS /check
  try {
    const res = await fetch(`${API_BASE}/check`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type,Authorization,X-Requested-With,X-Tamagn-Client',
      },
    });
    const allowOrigin = res.headers.get('access-control-allow-origin');
    const allowMethods = res.headers.get('access-control-allow-methods');
    const allowHeaders = res.headers.get('access-control-allow-headers');
    report(
      'OPTIONS /check (Preflight)',
      res.status === 204 && allowOrigin === ORIGIN,
      `Status: ${res.status}, Allow-Origin: ${allowOrigin}, Allow-Methods: ${allowMethods}`,
    );
  } catch (err) {
    report('OPTIONS /check (Preflight)', false, err.message);
  }

  // 5. Unauthenticated POST /check/reference -> Must return 401 WITH CORS headers
  try {
    const res = await fetch(`${API_BASE}/check/reference`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method: 'telebirr', transactionCode: 'TEST12345' }),
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    report(
      'POST /check/reference (No Auth -> 401 + CORS)',
      res.status === 401 && hasCors,
      `Status: ${res.status}, Message: ${data.message}, CORS: ${hasCors ? 'OK' : 'MISSING'}`,
    );
  } catch (err) {
    report('POST /check/reference (No Auth)', false, err.message);
  }

  // Retrieve active session token for Petros Client
  const { db } = await import('../src/config/drizzle.js');
  const { session, user } = await import('../src/db/schema.js');
  const { eq, gt } = await import('drizzle-orm');

  const activeSessions = await db
    .select({ token: session.token, email: user.email, name: user.name })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(gt(session.expiresAt, new Date()))
    .limit(1);

  if (!activeSessions.length) {
    console.error('No active session found in DB to test authenticated endpoints');
    return;
  }

  const { token, email, name } = activeSessions[0];
  console.log(`\nFound active session for ${name} (${email}). Testing authenticated endpoints...`);

  // 6. GET /auth/get-session with Authorization Bearer
  try {
    const res = await fetch(`${API_BASE}/auth/get-session`, {
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    report(
      'GET /auth/get-session (Authenticated)',
      res.status === 200 && data?.user?.email === email && hasCors,
      `Status: ${res.status}, Logged In User: ${data?.user?.name} (${data?.user?.email}), CORS: ${hasCors ? 'OK' : 'MISSING'}`,
    );
  } catch (err) {
    report('GET /auth/get-session', false, err.message);
  }

  // 7. GET /balance (Authenticated)
  try {
    const res = await fetch(`${API_BASE}/balance`, {
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    report(
      'GET /balance (Authenticated)',
      res.status === 200 && data.success && hasCors,
      `Status: ${res.status}, Balance: ${data.data?.balance} ETB, CORS: ${hasCors ? 'OK' : 'MISSING'}`,
    );
  } catch (err) {
    report('GET /balance', false, err.message);
  }

  // 8. GET /check/history (Authenticated)
  try {
    const res = await fetch(`${API_BASE}/check/history?limit=5`, {
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    report(
      'GET /check/history (Authenticated)',
      res.status === 200 && data.success && hasCors,
      `Status: ${res.status}, History Items: ${data.data?.checks?.length ?? 0}, CORS: ${hasCors ? 'OK' : 'MISSING'}`,
    );
  } catch (err) {
    report('GET /check/history', false, err.message);
  }

  // 9. POST /check/reference with test transactionCode -> Must return 422/200 WITH CORS!
  try {
    const res = await fetch(`${API_BASE}/check/reference`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'telebirr',
        transactionCode: 'TX9999999999',
        matchMyAccount: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    const hasCredentials = res.headers.get('access-control-allow-credentials') === 'true';
    report(
      'POST /check/reference (Verification check -> Status 422/200 + CORS)',
      [422, 200].includes(res.status) && hasCors && hasCredentials,
      `Status: ${res.status}, Message: "${data.message}", CORS Header: "${res.headers.get('access-control-allow-origin')}", Credentials: ${hasCredentials ? 'true' : 'false'}`,
    );
  } catch (err) {
    report('POST /check/reference', false, err.message);
  }

  // 10. POST /check (Receipt screenshot verification)
  try {
    // Generate a minimal valid JPEG image buffer for upload test
    const dummyJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9
    ]);

    const formData = new FormData();
    formData.append('method', 'telebirr');
    formData.append('matchMyAccount', 'false');
    formData.append('screenshot', new Blob([dummyJpeg], { type: 'image/jpeg' }), 'receipt.jpg');

    const res = await fetch(`${API_BASE}/check`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    const hasCredentials = res.headers.get('access-control-allow-credentials') === 'true';

    report(
      'POST /check (Screenshot verification -> Status 422 + CORS)',
      [422, 200].includes(res.status) && hasCors && hasCredentials,
      `Status: ${res.status}, Message: "${data.message}", CORS: ${hasCors ? 'OK' : 'MISSING'}, Issues: ${data.data?.issues?.length ?? 0}`,
    );
  } catch (err) {
    report('POST /check (Screenshot verification)', false, err.message);
  }

  console.log('\n======================================================');
  const allPassed = results.every(r => r.passed);
  console.log(`  FINAL RESULT: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  console.log('======================================================\n');
  process.exit(allPassed ? 0 : 1);
}

run().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
