import crypto from 'crypto';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys } from '../db/schema.js';
import { ensureUserBalance, getUserBalance, CheckError } from './checkService.js';
import { recordBalanceTransaction } from './balanceLedgerService.js';

/** Buy price (Birr) → verified-amount capacity (Birr). 2000→5000 fills the unspecified middle tier. */
export const API_PACKAGES = [
  { id: 'starter', price: 100, capacity: 150, label: 'Starter' },
  { id: 'growth', price: 500, capacity: 850, label: 'Growth' },
  { id: 'pro', price: 1000, capacity: 2000, label: 'Pro' },
  { id: 'business', price: 2000, capacity: 5000, label: 'Business' },
  { id: 'enterprise', price: 5000, capacity: 15000, label: 'Enterprise' },
];

export const VERIFY_FEE_TIERS = [
  { maxExclusive: 100, label: 'Under 100 ETB', cost: 2 },
  { maxExclusive: 1000, label: '100 – 999 ETB', cost: 5 },
  { maxExclusive: 5000, label: '1,000 – 4,999 ETB', cost: 10 },
  { maxExclusive: 10000, label: '5,000 – 9,999 ETB', cost: 15 },
  { maxExclusive: null, label: '10,000+ ETB', cost: 20 },
];

function toMoney(n) {
  return Number(n || 0).toFixed(2);
}

function money(n) {
  return parseFloat(toMoney(n));
}

export function getApiPackage(packageId) {
  return API_PACKAGES.find((p) => p.id === packageId) || null;
}

export function getPricingCatalog() {
  return {
    verifyFees: VERIFY_FEE_TIERS.map((t) => ({
      range: t.label,
      costBirr: t.cost,
    })),
    apiPackages: API_PACKAGES.map((p) => ({
      id: p.id,
      label: p.label,
      priceBirr: p.price,
      capacityBirr: p.capacity,
      note: `Verify receipts totaling up to ${p.capacity} Birr in payment amounts`,
    })),
  };
}

function generateRawKey() {
  const body = crypto.randomBytes(24).toString('base64url');
  return `dk_live_${body}`;
}

function hashKey(rawKey) {
  return crypto.createHash('sha256').update(String(rawKey)).digest('hex');
}

function publicKeyView(row, { includeSecret = null } = {}) {
  const capacity = money(row.capacityAmount);
  const used = money(row.usedAmount);
  const remaining = Math.max(0, capacity - used);
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    packagePrice: money(row.packagePrice),
    capacityAmount: capacity,
    usedAmount: used,
    remainingAmount: remaining,
    status: row.status,
    lastUsedAt: row.lastUsedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(includeSecret ? { apiKey: includeSecret } : {}),
  };
}

let tableReady = false;

export async function ensureApiKeysTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id serial PRIMARY KEY NOT NULL,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
      name text DEFAULT 'API Key' NOT NULL,
      key_prefix varchar(16) NOT NULL,
      key_hash text NOT NULL UNIQUE,
      package_price numeric(10, 2) NOT NULL,
      capacity_amount numeric(12, 2) NOT NULL,
      used_amount numeric(12, 2) DEFAULT '0' NOT NULL,
      status varchar(20) DEFAULT 'active' NOT NULL,
      last_used_at timestamp,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS api_keys_status_idx ON api_keys (status)`);
  tableReady = true;
}

async function debitWalletAtomic(userId, amount, ledgerMeta) {
  await ensureUserBalance(userId);
  const debit = money(amount);
  const result = await db.execute(sql`
    UPDATE balances
    SET amount = amount - ${debit}::numeric,
        updated_at = NOW()
    WHERE user_id = ${userId}
      AND amount::numeric >= ${debit}::numeric
    RETURNING amount
  `);
  const row = result?.rows?.[0] || result?.[0];
  if (!row) {
    throw new CheckError('Insufficient balance. Top up to buy or renew an API package.', 402);
  }
  const balanceAfter = money(row.amount);
  if (ledgerMeta) {
    await recordBalanceTransaction({
      userId,
      type: ledgerMeta.type,
      amount: -debit,
      balanceAfter,
      referenceType: ledgerMeta.referenceType || 'api_key',
      referenceId: ledgerMeta.referenceId || null,
      description: ledgerMeta.description || null,
    }).catch(() => {});
  }
  return balanceAfter;
}

export async function listUserApiKeys(userId) {
  await ensureApiKeysTable();
  const rows = await db.query.apiKeys.findMany({
    where: eq(apiKeys.userId, userId),
    orderBy: [desc(apiKeys.createdAt)],
  });
  return rows.map((r) => publicKeyView(r));
}

export async function purchaseApiKey(userId, { packageId, name } = {}) {
  await ensureApiKeysTable();
  const pkg = getApiPackage(packageId);
  if (!pkg) {
    throw new CheckError('Invalid API package. Choose starter, growth, pro, business, or enterprise.', 400);
  }

  const balance = await getUserBalance(userId);
  if (balance < pkg.price) {
    throw new CheckError(
      `Insufficient balance. This package costs ${pkg.price} Birr. Top up and try again.`,
      402,
      { required: pkg.price, balance, needTopUp: true },
    );
  }

  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  const newBalance = await debitWalletAtomic(userId, pkg.price, null);

  const [created] = await db.insert(apiKeys).values({
    userId,
    name: String(name || `${pkg.label} API`).slice(0, 80),
    keyPrefix,
    keyHash,
    packagePrice: toMoney(pkg.price),
    capacityAmount: toMoney(pkg.capacity),
    usedAmount: '0.00',
    status: 'active',
  }).returning();

  await recordBalanceTransaction({
    userId,
    type: 'api_key_purchase',
    amount: -pkg.price,
    balanceAfter: newBalance,
    referenceType: 'api_key',
    referenceId: created.id,
    description: `API ${pkg.label} — key ${keyPrefix}…`,
  }).catch(() => {});

  return {
    key: publicKeyView(created, { includeSecret: rawKey }),
    newBalance,
    package: pkg,
  };
}

export async function renewApiKey(userId, keyId, { packageId } = {}) {
  await ensureApiKeysTable();
  const pkg = getApiPackage(packageId);
  if (!pkg) {
    throw new CheckError('Invalid API package for renewal.', 400);
  }

  const row = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, Number(keyId)),
  });
  if (!row || row.userId !== userId) {
    throw new CheckError('API key not found.', 404);
  }
  if (row.status === 'revoked') {
    throw new CheckError('This key was revoked. Buy a new key instead.', 400);
  }

  const balance = await getUserBalance(userId);
  if (balance < pkg.price) {
    throw new CheckError(
      `Insufficient balance. Renewal costs ${pkg.price} Birr. Top up and try again.`,
      402,
      { required: pkg.price, balance, needTopUp: true },
    );
  }

  const newBalance = await debitWalletAtomic(userId, pkg.price, null);

  const nextCapacity = money(row.capacityAmount) + pkg.capacity;
  const [updated] = await db
    .update(apiKeys)
    .set({
      capacityAmount: toMoney(nextCapacity),
      packagePrice: toMoney(pkg.price),
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(apiKeys.id, row.id))
    .returning();

  await recordBalanceTransaction({
    userId,
    type: 'api_key_renewal',
    amount: -pkg.price,
    balanceAfter: newBalance,
    referenceType: 'api_key',
    referenceId: row.id,
    description: `Renewed API key ${row.keyPrefix}… (+${pkg.capacity} capacity)`,
  }).catch(() => {});

  return {
    key: publicKeyView(updated),
    newBalance,
    package: pkg,
  };
}

export async function revokeApiKey(userId, keyId) {
  await ensureApiKeysTable();
  const row = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.id, Number(keyId)),
  });
  if (!row || row.userId !== userId) {
    throw new CheckError('API key not found.', 404);
  }
  const [updated] = await db
    .update(apiKeys)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .returning();
  return publicKeyView(updated);
}

export async function findApiKeyByRaw(rawKey) {
  await ensureApiKeysTable();
  if (!rawKey || !String(rawKey).startsWith('dk_live_')) return null;
  const keyHash = hashKey(rawKey);
  const row = await db.query.apiKeys.findFirst({
    where: eq(apiKeys.keyHash, keyHash),
  });
  return row || null;
}

/**
 * Meter verified payment amount against key capacity.
 * Returns updated key view; expires key when used >= capacity.
 */
export async function consumeApiKeyCapacity(keyId, verifiedAmount) {
  const amount = money(verifiedAmount);
  if (amount <= 0) {
    throw new CheckError('Verified amount must be greater than zero.', 400);
  }

  const result = await db.execute(sql`
    UPDATE api_keys
    SET
      used_amount = used_amount + ${amount}::numeric,
      last_used_at = NOW(),
      updated_at = NOW(),
      status = CASE
        WHEN (used_amount + ${amount}::numeric) >= capacity_amount THEN 'expired'
        ELSE status
      END
    WHERE id = ${keyId}
      AND status = 'active'
      AND (used_amount + ${amount}::numeric) <= capacity_amount
    RETURNING *
  `);

  const row = result?.rows?.[0] || result?.[0];
  if (!row) {
    // Distinguish expired vs insufficient remaining capacity
    const current = await db.query.apiKeys.findFirst({ where: eq(apiKeys.id, keyId) });
    if (!current || current.status !== 'active') {
      throw new CheckError('API key expired or inactive. Renew with a package after topping up.', 403, {
        code: 'API_KEY_EXPIRED',
      });
    }
    const remaining = money(current.capacityAmount) - money(current.usedAmount);
    throw new CheckError(
      `Not enough API capacity. Remaining ${remaining} Birr; this receipt is ${amount} Birr. Renew your package.`,
      403,
      { code: 'INSUFFICIENT_CAPACITY', remaining, required: amount },
    );
  }

  // Map snake_case from raw SQL if needed
  const normalized = row.capacity_amount != null
    ? {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      keyPrefix: row.key_prefix,
      packagePrice: row.package_price,
      capacityAmount: row.capacity_amount,
      usedAmount: row.used_amount,
      status: row.status,
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
    : row;

  return publicKeyView(normalized);
}

export async function assertApiKeyHasCapacity(keyRow, verifiedAmount) {
  if (!keyRow || keyRow.status !== 'active') {
    throw new CheckError('API key expired or inactive. Renew with a package after topping up.', 403, {
      code: 'API_KEY_EXPIRED',
    });
  }
  const remaining = money(keyRow.capacityAmount) - money(keyRow.usedAmount);
  const amount = money(verifiedAmount);
  if (amount > remaining) {
    throw new CheckError(
      `Not enough API capacity. Remaining ${remaining} Birr; this receipt is ${amount} Birr. Renew your package.`,
      403,
      { code: 'INSUFFICIENT_CAPACITY', remaining, required: amount },
    );
  }
}

export async function refundApiKeyCapacity(keyId, verifiedAmount) {
  const amount = money(verifiedAmount);
  if (amount <= 0) return;
  await db.execute(sql`
    UPDATE api_keys
    SET
      used_amount = GREATEST(0, used_amount - ${amount}::numeric),
      status = CASE
        WHEN status = 'revoked' THEN 'revoked'
        ELSE 'active'
      END,
      updated_at = NOW()
    WHERE id = ${keyId}
  `);
}
