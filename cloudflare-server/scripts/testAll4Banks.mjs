import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.dev.vars' });

const API_BASE = 'https://deresegn-cloudflare-server.asmamawpetros.workers.dev/api';
const ORIGIN = 'https://tamagncheck.online';
const SAMPLES_DIR = path.resolve('../server/training/receipt-samples');

const results = [];
function report(bank, checkType, passed, detail = '') {
  results.push({ bank, checkType, passed, detail });
  const statusStr = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${statusStr} [${bank} - ${checkType}] ${detail}`);
}

async function run() {
  console.log('================================================================');
  console.log('  TESTING VERIFICATION ENGINE ACROSS ALL 4 ETHIOPIAN BANKS');
  console.log('  Live Cloudflare Worker API:', API_BASE);
  console.log('  Target Origin:', ORIGIN);
  console.log('================================================================\n');

  // Authenticate using active session from DB
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
    console.error('No active session found in DB to perform authenticated checks');
    process.exit(1);
  }

  const { token, email, name } = activeSessions[0];
  console.log(`Authenticated as: ${name} (${email})\n`);

  // ----------------------------------------------------------------
  // BANK 1: TELEBIRR
  // ----------------------------------------------------------------
  console.log('--- 1. Testing Telebirr ---');
  // A. Reference Check (Official Telebirr Query)
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
        transactionCode: 'DET8FJGUJ4',
        matchMyAccount: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    const isOk = [200, 422].includes(res.status) && hasCors;
    report(
      'TELEBIRR',
      'Reference / Invoice Verify',
      isOk,
      `Status: ${res.status}, CORS: ${hasCors ? 'OK' : 'MISSING'}, Success: ${data.success}, Message: "${data.message}"`,
    );
  } catch (err) {
    report('TELEBIRR', 'Reference Verify', false, err.message);
  }

  // ----------------------------------------------------------------
  // BANK 2: COMMERCIAL BANK OF ETHIOPIA (CBE)
  // ----------------------------------------------------------------
  console.log('\n--- 2. Testing CBE (Commercial Bank of Ethiopia) ---');
  // A. Screenshot Check with CBE Receipt Sample
  const cbeSamplePath = path.join(SAMPLES_DIR, 'cbe-success-card.png');
  if (fs.existsSync(cbeSamplePath)) {
    try {
      const buffer = fs.readFileSync(cbeSamplePath);
      const form = new FormData();
      form.append('method', 'cbe');
      form.append('matchMyAccount', 'false');
      form.append('withDetails', 'false');
      form.append('screenshot', new Blob([buffer], { type: 'image/png' }), 'cbe-receipt.png');

      const res = await fetch(`${API_BASE}/check`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
      const isOk = [200, 422].includes(res.status) && hasCors;
      report(
        'CBE',
        'Screenshot Receipt Verify',
        isOk,
        `Status: ${res.status}, CORS: ${hasCors ? 'OK' : 'MISSING'}, Success: ${data.success}, Message: "${data.message}", Issues: ${data.data?.issues?.length || 0}`,
      );
    } catch (err) {
      report('CBE', 'Screenshot Verify', false, err.message);
    }
  } else {
    report('CBE', 'Screenshot Verify', false, 'Sample cbe-success-card.png not found');
  }

  // B. CBE Reference Check
  try {
    const res = await fetch(`${API_BASE}/check/reference`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'cbe',
        transactionCode: 'FT2400000000',
        accountSuffix: '100012345678',
        matchMyAccount: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    const isOk = [200, 422].includes(res.status) && hasCors;
    report(
      'CBE',
      'Branch Reference Verify',
      isOk,
      `Status: ${res.status}, CORS: ${hasCors ? 'OK' : 'MISSING'}, Success: ${data.success}, Message: "${data.message}"`,
    );
  } catch (err) {
    report('CBE', 'Branch Reference Verify', false, err.message);
  }

  // ----------------------------------------------------------------
  // BANK 3: DASHEN BANK
  // ----------------------------------------------------------------
  console.log('\n--- 3. Testing Dashen Bank ---');
  // A. Screenshot Check with Dashen Receipt Sample
  const dashenSamplePath = path.join(SAMPLES_DIR, 'dashen-success-paid.png');
  if (fs.existsSync(dashenSamplePath)) {
    try {
      const buffer = fs.readFileSync(dashenSamplePath);
      const form = new FormData();
      form.append('method', 'dashen');
      form.append('matchMyAccount', 'false');
      form.append('withDetails', 'false');
      form.append('screenshot', new Blob([buffer], { type: 'image/png' }), 'dashen-success.png');

      const res = await fetch(`${API_BASE}/check`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
      const isOk = [200, 422].includes(res.status) && hasCors;
      report(
        'DASHEN',
        'Screenshot Receipt Verify',
        isOk,
        `Status: ${res.status}, CORS: ${hasCors ? 'OK' : 'MISSING'}, Success: ${data.success}, Message: "${data.message}", Tx: ${data.data?.check?.transactionCode || data.data?.validation?.txCode || 'none'}`,
      );
    } catch (err) {
      report('DASHEN', 'Screenshot Verify', false, err.message);
    }
  } else {
    report('DASHEN', 'Screenshot Verify', false, 'Sample dashen-success-paid.png not found');
  }

  // B. Dashen Reference Check (VAT receipt format)
  try {
    const res = await fetch(`${API_BASE}/check/reference`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'dashen',
        transactionCode: '110IPSS2616900WO',
        matchMyAccount: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    const isOk = [200, 422].includes(res.status) && hasCors;
    report(
      'DASHEN',
      'Reference Verify',
      isOk,
      `Status: ${res.status}, CORS: ${hasCors ? 'OK' : 'MISSING'}, Success: ${data.success}, Message: "${data.message}"`,
    );
  } catch (err) {
    report('DASHEN', 'Reference Verify', false, err.message);
  }

  // ----------------------------------------------------------------
  // BANK 4: BANK OF ABYSSINIA (BOA)
  // ----------------------------------------------------------------
  console.log('\n--- 4. Testing Bank of Abyssinia (BOA) ---');
  // A. Screenshot Check with BOA Receipt Sample
  const boaSamplePath = path.join(SAMPLES_DIR, 'boa-receipt.png');
  if (fs.existsSync(boaSamplePath)) {
    try {
      const buffer = fs.readFileSync(boaSamplePath);
      const form = new FormData();
      form.append('method', 'boa');
      form.append('matchMyAccount', 'false');
      form.append('withDetails', 'false');
      form.append('screenshot', new Blob([buffer], { type: 'image/png' }), 'boa-receipt.png');

      const res = await fetch(`${API_BASE}/check`, {
        method: 'POST',
        headers: {
          Origin: ORIGIN,
          Authorization: `Bearer ${token}`,
        },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
      const isOk = [200, 422].includes(res.status) && hasCors;
      report(
        'BOA',
        'Screenshot Receipt Verify',
        isOk,
        `Status: ${res.status}, CORS: ${hasCors ? 'OK' : 'MISSING'}, Success: ${data.success}, Message: "${data.message}", Tx: ${data.data?.check?.transactionCode || data.data?.validation?.txCode || 'none'}`,
      );
    } catch (err) {
      report('BOA', 'Screenshot Verify', false, err.message);
    }
  } else {
    report('BOA', 'Screenshot Verify', false, 'Sample boa-receipt.png not found');
  }

  // B. BOA Reference Check
  try {
    const res = await fetch(`${API_BASE}/check/reference`, {
      method: 'POST',
      headers: {
        Origin: ORIGIN,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        method: 'boa',
        transactionCode: 'FT26169X4SRS',
        accountSuffix: '246302723',
        matchMyAccount: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const hasCors = res.headers.get('access-control-allow-origin') === ORIGIN;
    const isOk = [200, 422].includes(res.status) && hasCors;
    report(
      'BOA',
      'Reference Verify',
      isOk,
      `Status: ${res.status}, CORS: ${hasCors ? 'OK' : 'MISSING'}, Success: ${data.success}, Message: "${data.message}"`,
    );
  } catch (err) {
    report('BOA', 'Reference Verify', false, err.message);
  }

  console.log('\n================================================================');
  const allPassed = results.every((r) => r.passed);
  console.log(`  OVERALL RESULT FOR ALL 4 BANKS: ${allPassed ? 'ALL PASSED ✅' : 'SOME FAILED ❌'}`);
  console.log('================================================================\n');
  process.exit(allPassed ? 0 : 1);
}

run().catch((e) => {
  console.error('FATAL ERROR:', e);
  process.exit(1);
});
