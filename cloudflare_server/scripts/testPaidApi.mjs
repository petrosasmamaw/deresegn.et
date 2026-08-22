/**
 * Tests Paid API: auth, /me, capacity consume → expire, expired reject.
 * Run: node scripts/testPaidApi.mjs
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { apiKeys, user } from '../src/db/schema.js';
import {
  ensureApiKeysTable,
  consumeApiKeyCapacity,
  findApiKeyByRaw,
} from '../src/services/apiKeyService.js';

dotenv.config();

const BASE = process.env.API_TEST_BASE || 'http://localhost:5000/api';

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function http(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}

async function main() {
  console.log('=== Paid API test ===');
  console.log('Base:', BASE);

  await ensureApiKeysTable();

  const anyUser = await db.query.user.findFirst();
  assert(anyUser?.id, 'No user in DB — register/login once or run seed:users');

  const rawKey = `dk_live_test_${crypto.randomBytes(16).toString('base64url')}`;
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  // Tiny capacity so we can expire quickly
  const [created] = await db.insert(apiKeys).values({
    userId: anyUser.id,
    name: 'Test Key (auto)',
    keyPrefix,
    keyHash,
    packagePrice: '0.00',
    capacityAmount: '100.00',
    usedAmount: '0.00',
    status: 'active',
  }).returning();

  console.log('Created test key id=', created.id, 'capacity=100');

  try {
    // 1) Public guide
    const guide = await http('/v1');
    assert(guide.status === 200, `GET /v1 expected 200 got ${guide.status}`);
    assert(guide.json?.data?.banks?.length >= 4, 'Guide must list all banks');
    const methods = guide.json.data.banks.map((b) => b.method).sort();
    assert(
      methods.join(',') === 'boa,cbe,dashen,telebirr',
      `Banks incomplete: ${methods.join(',')}`,
    );
    console.log('OK  GET /api/v1 guide — Telebirr, CBE, BOA, Dashen');

    // 2) Missing key
    const missing = await http('/v1/me');
    assert(missing.status === 401, `Missing key expected 401 got ${missing.status}`);
    console.log('OK  GET /v1/me without key → 401');

    // 3) Invalid key
    const bad = await http('/v1/me', { headers: { 'X-API-Key': 'dk_live_invalid' } });
    assert(bad.status === 401, `Invalid key expected 401 got ${bad.status}`);
    console.log('OK  GET /v1/me invalid key → 401');

    // 4) Valid /me
    const me = await http('/v1/me', { headers: { 'X-API-Key': rawKey } });
    assert(me.status === 200, `/me expected 200 got ${me.status}: ${me.text}`);
    assert(me.json?.data?.status === 'active', 'Key should be active');
    assert(Number(me.json.data.remainingAmount) === 100, 'Remaining should be 100');
    console.log('OK  GET /v1/me with key — remaining', me.json.data.remainingAmount);

    // 5) Consume 60 → still active
    const after60 = await consumeApiKeyCapacity(created.id, 60);
    assert(after60.status === 'active', 'After 60 used should still be active');
    assert(after60.remainingAmount === 40, `Remaining expected 40 got ${after60.remainingAmount}`);
    console.log('OK  consume 60 → remaining 40, status active');

    // 6) Consume 40 → expire
    const after40 = await consumeApiKeyCapacity(created.id, 40);
    assert(after40.status === 'expired', `Expected expired got ${after40.status}`);
    assert(after40.remainingAmount === 0, 'Remaining should be 0');
    console.log('OK  consume 40 → status expired');

    // 7) Expired key rejected by HTTP
    const expiredMe = await http('/v1/me', { headers: { 'X-API-Key': rawKey } });
    assert(expiredMe.status === 403, `Expired /me expected 403 got ${expiredMe.status}`);
    assert(
      expiredMe.json?.code === 'API_KEY_EXPIRED' || /expir/i.test(expiredMe.json?.message || ''),
      `Expected expiry message, got ${JSON.stringify(expiredMe.json)}`,
    );
    console.log('OK  GET /v1/me expired key → 403');

    // 8) Over-capacity reject while active
    const raw2 = `dk_live_test_${crypto.randomBytes(16).toString('base64url')}`;
    const [k2] = await db.insert(apiKeys).values({
      userId: anyUser.id,
      name: 'Test Key capacity',
      keyPrefix: raw2.slice(0, 12),
      keyHash: hashKey(raw2),
      packagePrice: '0.00',
      capacityAmount: '50.00',
      usedAmount: '0.00',
      status: 'active',
    }).returning();

    let overErr = null;
    try {
      await consumeApiKeyCapacity(k2.id, 80);
    } catch (e) {
      overErr = e;
    }
    assert(overErr, 'Expected capacity error for 80 on 50 capacity');
    assert(overErr.details?.code === 'INSUFFICIENT_CAPACITY' || /capacity/i.test(overErr.message), overErr.message);
    console.log('OK  consume over capacity → rejected (key stays usable for smaller amounts)');

    const still = await findApiKeyByRaw(raw2);
    assert(still?.status === 'active', 'Key should remain active after over-capacity reject');

    // Cleanup k2
    await db.delete(apiKeys).where(eq(apiKeys.id, k2.id));

    // 9) Verify endpoint validates method for all banks (auth works; fake tx → 422/400 not 401)
    for (const sample of [
      { method: 'telebirr', transactionCode: 'FAKETEST01' },
      { method: 'cbe', transactionCode: 'FTFAKE000000', accountSuffix: '12345678' },
      { method: 'boa', transactionCode: 'FTFAKE000001', accountSuffix: '12345' },
      { method: 'dashen', transactionCode: '110IPSSFAKETEST1' },
    ]) {
      // Use a fresh active key for auth
      const raw3 = `dk_live_test_${crypto.randomBytes(12).toString('base64url')}`;
      const [k3] = await db.insert(apiKeys).values({
        userId: anyUser.id,
        name: 'Test verify auth',
        keyPrefix: raw3.slice(0, 12),
        keyHash: hashKey(raw3),
        packagePrice: '0.00',
        capacityAmount: '1000.00',
        usedAmount: '0.00',
        status: 'active',
      }).returning();

      const vr = await http('/v1/verify/reference', {
        method: 'POST',
        headers: { 'X-API-Key': raw3 },
        body: sample,
      });
      assert(vr.status !== 401 && vr.status !== 403, `${sample.method} auth failed: ${vr.status}`);
      assert([400, 404, 422, 500, 502, 503].includes(vr.status) || vr.status === 200,
        `${sample.method} unexpected status ${vr.status}: ${vr.text?.slice(0, 200)}`);
      console.log(`OK  POST verify/reference method=${sample.method} → ${vr.status} (authenticated)`);

      await db.delete(apiKeys).where(eq(apiKeys.id, k3.id));
    }

    console.log('\nAll Paid API tests passed.');
  } finally {
    await db.delete(apiKeys).where(eq(apiKeys.id, created.id));
    console.log('Cleaned up test key', created.id);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('\nFAILED:', err.message);
  process.exit(1);
});
