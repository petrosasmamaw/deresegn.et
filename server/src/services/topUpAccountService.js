import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { topUpReceiverAccounts } from '../db/schema.js';

const DEFAULT_ACCOUNTS = [
  { method: 'telebirr', receiverName: 'seifeslaisie asmamaw', receiverAccount: '0989886956' },
  { method: 'cbe', receiverName: 'petiros asmamaw abebe', receiverAccount: '1000333687112' },
];

export const TOP_UP_METHODS = ['telebirr', 'cbe'];

export function isTopUpMethod(method) {
  return TOP_UP_METHODS.includes(String(method || '').toLowerCase());
}

export async function ensureTopUpReceiverDefaults() {
  for (const account of DEFAULT_ACCOUNTS) {
    const existing = await getTopUpReceiverAccount(account.method);
    if (!existing) {
      await db.insert(topUpReceiverAccounts).values(account);
    }
  }
}

export async function getAllTopUpReceiverAccounts() {
  const rows = await db.select().from(topUpReceiverAccounts);
  return rows
    .filter((row) => isTopUpMethod(row.method))
    .sort((a, b) => TOP_UP_METHODS.indexOf(a.method) - TOP_UP_METHODS.indexOf(b.method));
}

export async function getTopUpReceiverAccount(method) {
  const normalized = String(method || '').toLowerCase();
  if (!isTopUpMethod(normalized)) return null;
  const [row] = await db
    .select()
    .from(topUpReceiverAccounts)
    .where(eq(topUpReceiverAccounts.method, normalized))
    .limit(1);
  return row || null;
}

export async function updateTopUpReceiverAccount(method, { receiverName, receiverAccount }) {
  const normalized = String(method || '').toLowerCase();
  if (!isTopUpMethod(normalized)) {
    throw new Error('Only Telebirr and CBE top-up accounts can be configured');
  }

  const name = String(receiverName || '').trim();
  const account = String(receiverAccount || '').trim();
  if (!name || !account) {
    throw new Error('Receiver name and account are required');
  }

  const existing = await getTopUpReceiverAccount(normalized);
  if (!existing) {
    const [created] = await db.insert(topUpReceiverAccounts).values({
      method: normalized,
      receiverName: name,
      receiverAccount: account,
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  const [updated] = await db.update(topUpReceiverAccounts)
    .set({
      receiverName: name,
      receiverAccount: account,
      updatedAt: new Date(),
    })
    .where(eq(topUpReceiverAccounts.method, normalized))
    .returning();

  return updated;
}
