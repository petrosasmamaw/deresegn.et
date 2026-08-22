/**
 * Quick test: encrypt store + revealApiKey
 * Run: node scripts/testRevealApiKey.mjs
 */
import dotenv from 'dotenv';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { apiKeys, user } from '../src/db/schema.js';
import { ensureApiKeysTable, revealApiKey, purchaseApiKey } from '../src/services/apiKeyService.js';

dotenv.config();

function assert(c, m) {
  if (!c) throw new Error(m);
}

async function main() {
  await ensureApiKeysTable();
  const u = await db.query.user.findFirst();
  assert(u?.id, 'Need a user in DB');

  // Zero-cost insert via service internals is purchase — use direct encrypt by buying if balance ok,
  // else insert encrypted row like create does.
  const raw = `dk_live_reveal_${crypto.randomBytes(12).toString('base64url')}`;
  // Re-use service encrypt by purchasing only if we can; otherwise mirror encrypt via reveal roundtrip after purchase path.

  // Insert using same encryption as service: call purchase with mocked... simpler: temporary update after hash insert
  // Import isn't exported encrypt — create via SQL after we temporarily use purchase with 0? packages min 100.

  // Direct: create key through DB then update — reveal needs keyEncrypted from service.
  // Use purchase if balance >= 100, else skip purchase and call encrypt by re-importing logic.

  const { default: cryptoMod } = await import('crypto');
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.BETTER_AUTH_SECRET || 'deresegn-dev-api-key-encryption';
  const keyBytes = cryptoMod.createHash('sha256').update(String(secret)).digest();
  const iv = cryptoMod.randomBytes(12);
  const cipher = cryptoMod.createCipheriv('aes-256-gcm', keyBytes, iv);
  const enc = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const blob = Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');

  const [row] = await db.insert(apiKeys).values({
    userId: u.id,
    name: 'Reveal test',
    keyPrefix: raw.slice(0, 12),
    keyHash: crypto.createHash('sha256').update(raw).digest('hex'),
    keyEncrypted: blob,
    packagePrice: '0.00',
    capacityAmount: '10.00',
    usedAmount: '0.00',
    status: 'active',
  }).returning();

  try {
    const out = await revealApiKey(u.id, row.id);
    assert(out.apiKey === raw, `Mismatch: ${out.apiKey}`);
    console.log('OK revealApiKey returns full secret');

    // list marks canReveal
    const { listUserApiKeys } = await import('../src/services/apiKeyService.js');
    const list = await listUserApiKeys(u.id);
    const mine = list.find((k) => k.id === row.id);
    assert(mine?.canReveal === true, 'canReveal should be true');
    console.log('OK listUserApiKeys canReveal=true');
    console.log('All reveal tests passed.');
  } finally {
    await db.delete(apiKeys).where(eq(apiKeys.id, row.id));
  }
}

main().catch((e) => {
  console.error('FAILED', e.message);
  process.exit(1);
});
