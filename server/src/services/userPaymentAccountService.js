import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userPaymentAccounts } from '../db/schema.js';
import {
  accountsMatch,
  namesMatch,
  normalizeAccount,
} from './receiptValidationService.js';

export const USER_ACCOUNT_METHODS = ['telebirr', 'cbe', 'boa', 'dashen'];

let tableReady = false;

export async function ensureUserPaymentAccountsTable() {
  if (tableReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_payment_accounts (
      id serial PRIMARY KEY NOT NULL,
      user_id text NOT NULL REFERENCES "user"(id) ON DELETE cascade,
      method varchar(20) NOT NULL,
      account_name text NOT NULL,
      account_number text NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS user_payment_accounts_user_method_idx
    ON user_payment_accounts (user_id, method)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS user_payment_accounts_user_id_idx
    ON user_payment_accounts (user_id)
  `);
  tableReady = true;
}

function publicView(row) {
  if (!row) return null;
  return {
    id: row.id,
    method: row.method,
    accountName: row.accountName,
    accountNumber: row.accountNumber,
    updatedAt: row.updatedAt,
  };
}

function normalizeMethod(method) {
  return String(method || '').trim().toLowerCase();
}

function validateAccountNumber(method, raw) {
  const value = String(raw || '').trim();
  if (!value) throw new Error('Account number is required');

  if (method === 'telebirr') {
    const digits = normalizeAccount(value);
    if (!/^09\d{8}$/.test(digits)) {
      throw new Error('Telebirr account must be a 10-digit phone starting with 09');
    }
    return digits;
  }

  const digits = value.replace(/\D/g, '');
  if (method === 'cbe') {
    if (!/^\d{13}$/.test(digits)) {
      throw new Error('CBE account must be the full 13-digit number');
    }
    return digits;
  }
  if (method === 'boa') {
    if (!/^\d{9}$/.test(digits)) {
      throw new Error('Bank of Abyssinia account must be the full 9-digit number');
    }
    return digits;
  }
  if (method === 'dashen') {
    if (!/^\d{10,16}$/.test(digits)) {
      throw new Error('Dashen account must be 10–16 digits');
    }
    return digits;
  }
  throw new Error('Unsupported payment method');
}

function accountsMatchForMethod(method, saved, official) {
  if (accountsMatch(saved, official)) return true;
  const a = normalizeAccount(saved);
  const b = normalizeAccount(official);
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (method === 'boa' && shorter.length >= 5 && longer.endsWith(shorter)) return true;
  if (method === 'cbe' && shorter.length >= 8 && longer.endsWith(shorter)) return true;
  return false;
}

export async function listUserPaymentAccounts(userId) {
  await ensureUserPaymentAccountsTable();
  const rows = await db
    .select()
    .from(userPaymentAccounts)
    .where(eq(userPaymentAccounts.userId, userId));
  const byMethod = Object.fromEntries(rows.map((r) => [r.method, publicView(r)]));
  return USER_ACCOUNT_METHODS.map((method) => byMethod[method] || { method, accountName: '', accountNumber: '' });
}

export async function getUserPaymentAccount(userId, method) {
  await ensureUserPaymentAccountsTable();
  const normalized = normalizeMethod(method);
  if (!USER_ACCOUNT_METHODS.includes(normalized)) return null;
  const [row] = await db
    .select()
    .from(userPaymentAccounts)
    .where(and(
      eq(userPaymentAccounts.userId, userId),
      eq(userPaymentAccounts.method, normalized),
    ))
    .limit(1);
  return publicView(row);
}

export async function upsertUserPaymentAccount(userId, method, { accountName, accountNumber }) {
  await ensureUserPaymentAccountsTable();
  const normalized = normalizeMethod(method);
  if (!USER_ACCOUNT_METHODS.includes(normalized)) {
    throw new Error('Choose Telebirr, CBE, Bank of Abyssinia, or Dashen');
  }
  const name = String(accountName || '').replace(/\s+/g, ' ').trim();
  if (name.length < 3) {
    throw new Error('Account name must be at least 3 characters');
  }
  const number = validateAccountNumber(normalized, accountNumber);
  const existing = await getUserPaymentAccount(userId, normalized);
  if (!existing?.id) {
    const [created] = await db.insert(userPaymentAccounts).values({
      userId,
      method: normalized,
      accountName: name,
      accountNumber: number,
    }).returning();
    return publicView(created);
  }
  const [updated] = await db.update(userPaymentAccounts)
    .set({
      accountName: name,
      accountNumber: number,
      updatedAt: new Date(),
    })
    .where(eq(userPaymentAccounts.id, existing.id))
    .returning();
  return publicView(updated);
}

export async function deleteUserPaymentAccount(userId, method) {
  await ensureUserPaymentAccountsTable();
  const normalized = normalizeMethod(method);
  await db.delete(userPaymentAccounts).where(and(
    eq(userPaymentAccounts.userId, userId),
    eq(userPaymentAccounts.method, normalized),
  ));
}

function formatAccountLine(name, number) {
  const n = String(name || '').trim() || '—';
  const a = String(number || '').trim() || '—';
  return `${n} · ${a}`;
}

/**
 * After official bank lookup succeeds, confirm receiver name + account match the user's saved payout account.
 * Fast in-memory compare — no extra OCR or bank call.
 */
export async function matchPaymentToMyAccount(userId, method, details) {
  const saved = await getUserPaymentAccount(userId, method);
  if (!saved?.accountNumber || !saved?.accountName) {
    return {
      ok: false,
      message: 'Save this bank on My Accounts before checking payment to your account.',
      issues: [{
        type: 'error',
        code: 'MY_ACCOUNT_NOT_SAVED',
        field: 'receiverAccount',
        message: 'Save this bank on My Accounts before checking payment to your account.',
      }],
    };
  }

  const officialName = String(details?.receiverName || '').trim();
  const officialAccount = String(details?.receiverAccount || '').trim();
  const yourLine = formatAccountLine(saved.accountName, saved.accountNumber);
  const receiverLine = formatAccountLine(officialName, officialAccount);
  const extras = {
    yourName: saved.accountName,
    yourNumber: saved.accountNumber,
    receiverName: officialName || '—',
    receiverAccount: officialAccount || '—',
    formValue: yourLine,
    qrValue: receiverLine,
  };

  const issues = [];

  if (!officialName) {
    issues.push({
      type: 'error',
      code: 'MY_ACCOUNT_RECEIVER_MISSING',
      field: 'receiverName',
      message: `Your name and number is ${yourLine}. The official record did not include a receiver name.`,
      ...extras,
    });
  } else if (!namesMatch(saved.accountName, officialName)) {
    issues.push({
      type: 'error',
      code: 'MY_ACCOUNT_NAME_MISMATCH',
      field: 'receiverName',
      message: `Your name and number is ${yourLine}. The receiver on this payment is ${officialName}. The names are not the same.`,
      ...extras,
    });
  }

  if (!officialAccount) {
    issues.push({
      type: 'error',
      code: 'MY_ACCOUNT_RECEIVER_MISSING',
      field: 'receiverAccount',
      message: `Your name and number is ${yourLine}. The official record did not include a receiver account.`,
      ...extras,
    });
  } else if (!accountsMatchForMethod(method, saved.accountNumber, officialAccount)) {
    issues.push({
      type: 'error',
      code: 'MY_ACCOUNT_NUMBER_MISMATCH',
      field: 'receiverAccount',
      message: `Your name and number is ${yourLine}. The receiver account on this payment is ${officialAccount}. The numbers are not the same.`,
      ...extras,
    });
  }

  if (issues.length) {
    const primary = {
      ...issues[0],
      message: issues.map((i) => i.message).join(' '),
    };
    return {
      ok: false,
      message: primary.message,
      issues: [primary],
    };
  }
  return { ok: true };
}
