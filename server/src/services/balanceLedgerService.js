import crypto from 'crypto';
import { db } from '../db/index.js';
import { balances, balanceTransactions, systemSettings } from '../db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

function toMoney(value) {
  return (Math.round((parseFloat(value) || 0) * 100) / 100).toFixed(2);
}

let bonusIndexReady = false;

export async function ensureRegistrationBonusUniqueIndex() {
  if (bonusIndexReady) return;
  try {
    // Remove duplicate bonus rows (keep earliest) so partial unique index can be created.
    await db.execute(sql`
      DELETE FROM balance_transactions a
      USING balance_transactions b
      WHERE a.type = 'registration_bonus'
        AND b.type = 'registration_bonus'
        AND a.user_id = b.user_id
        AND a.id > b.id
    `);
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS balance_transactions_registration_bonus_uidx
      ON balance_transactions (user_id)
      WHERE type = 'registration_bonus'
    `);
  } catch (err) {
    console.warn('[bonus] unique index setup skipped:', err.message);
  }
  bonusIndexReady = true;
}

export async function getSetting(key, fallback = null) {
  const row = await db.query.systemSettings.findFirst({ where: eq(systemSettings.key, key) });
  return row?.value ?? fallback;
}

export async function setSetting(key, value) {
  const [row] = await db
    .insert(systemSettings)
    .values({ key, value: String(value), updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: String(value), updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function getRegistrationBonusSettings() {
  const [amount, enabled] = await Promise.all([
    getSetting('registration_bonus_amount', '20'),
    getSetting('registration_bonus_enabled', 'true'),
  ]);
  return {
    amount: parseFloat(amount) || 20,
    enabled: enabled !== 'false',
  };
}

export async function recordBalanceTransaction({
  userId,
  type,
  amount,
  balanceAfter,
  referenceType = null,
  referenceId = null,
  description = null,
}) {
  const [row] = await db.insert(balanceTransactions).values({
    userId,
    type,
    amount: toMoney(amount),
    balanceAfter: toMoney(balanceAfter),
    referenceType,
    referenceId,
    description,
  }).returning();
  return row;
}

export async function hasRegistrationBonus(userId) {
  const row = await db.query.balanceTransactions.findFirst({
    where: and(
      eq(balanceTransactions.userId, userId),
      eq(balanceTransactions.type, 'registration_bonus'),
    ),
  });
  return Boolean(row);
}

/**
 * Grant welcome bonus at most once per user (unique index + atomic wallet credit).
 */
export async function ensureRegistrationBonus(userId) {
  await ensureRegistrationBonusUniqueIndex();

  const settings = await getRegistrationBonusSettings();
  if (!settings.enabled || settings.amount <= 0) {
    return { granted: false, reason: 'disabled', amount: settings.amount };
  }

  if (await hasRegistrationBonus(userId)) {
    return { granted: false, reason: 'already_claimed', amount: settings.amount };
  }

  const credit = settings.amount;

  try {
    return await db.transaction(async (tx) => {
      const existingBonus = await tx.query.balanceTransactions.findFirst({
        where: and(
          eq(balanceTransactions.userId, userId),
          eq(balanceTransactions.type, 'registration_bonus'),
        ),
      });
      if (existingBonus) {
        return { granted: false, reason: 'already_claimed', amount: settings.amount };
      }

      let balanceRow = await tx.query.balances.findFirst({ where: eq(balances.userId, userId) });
      if (!balanceRow) {
        [balanceRow] = await tx.insert(balances).values({ userId, amount: '0.00' }).returning();
      }

      const current = parseFloat(toMoney(balanceRow.amount));
      const newBalance = parseFloat(toMoney(current + credit));

      await tx.insert(balanceTransactions).values({
        userId,
        type: 'registration_bonus',
        amount: toMoney(credit),
        balanceAfter: toMoney(newBalance),
        description: `Welcome bonus — ${credit} Birr`,
      });

      await tx
        .update(balances)
        .set({ amount: toMoney(newBalance), updatedAt: new Date() })
        .where(eq(balances.userId, userId));

      return {
        granted: true,
        amount: credit,
        newBalance,
      };
    });
  } catch (err) {
    if (err?.code === '23505' || /unique/i.test(String(err?.message || ''))) {
      return { granted: false, reason: 'already_claimed', amount: settings.amount };
    }
    throw err;
  }
}

export async function getUserLedger(userId, limit = 50) {
  const rows = await db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, userId))
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(limit);
  return rows;
}

export async function getAllBonuses(limit = 100) {
  const rows = await db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.type, 'registration_bonus'))
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(limit);
  return rows;
}

export async function getBonusStats() {
  const bonuses = await getAllBonuses(10000);
  const totalGiven = bonuses.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
  return {
    bonusCount: bonuses.length,
    bonusTotalGiven: parseFloat(toMoney(totalGiven)),
  };
}

export function generateShareToken() {
  return crypto.randomBytes(24).toString('hex');
}

export const RECHECK_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isWithinRecheckWindow(createdAt) {
  return Date.now() - new Date(createdAt).getTime() <= RECHECK_WINDOW_MS;
}
