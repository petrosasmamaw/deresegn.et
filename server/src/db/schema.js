import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  varchar,
  decimal,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Better Auth user table (extended for Deresegn balance tracking)
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  role: varchar('role', { length: 20 }).notNull().default('client'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
}, (table) => ({
  sessionUserIdIdx: index('session_userId_idx').on(table.userId),
}));

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  accountUserIdIdx: index('account_userId_idx').on(table.userId),
}));

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  verificationIdentifierIdx: index('verification_identifier_idx').on(table.identifier),
}));

// Deresegn-specific tables
export const balances = pgTable('balances', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique().references(() => user.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('balances_user_id_idx').on(table.userId),
}));

export const topUpTransactions = pgTable('top_up_transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  screenshotUrl: text('screenshot_url').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  senderName: text('sender_name'),
  senderAccount: text('sender_account'),
  receiverName: text('receiver_name'),
  receiverAccount: text('receiver_account'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  transactionCode: varchar('transaction_code', { length: 100 }),
  aiResult: text('ai_result'),
  rejectionReason: text('rejection_reason'),
  unitsAdded: integer('units_added'),
  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('top_up_transactions_user_id_idx').on(table.userId),
  transactionCodeIdx: index('top_up_transactions_tx_code_idx').on(table.transactionCode),
  transactionCodeUnique: uniqueIndex('top_up_transactions_tx_code_unique').on(table.transactionCode),
}));

export const receiptChecks = pgTable('receipt_checks', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  paymentMethod: varchar('payment_method', { length: 20 }).notNull(),
  senderName: text('sender_name'),
  senderAccount: text('sender_account'),
  receiverName: text('receiver_name'),
  receiverAccount: text('receiver_account'),
  amount: decimal('amount', { precision: 10, scale: 2 }),
  transactionCode: varchar('transaction_code', { length: 100 }).notNull(),
  screenshotUrl: text('screenshot_url').notNull(),
  enteredDetails: text('entered_details'),
  extractedDetails: text('extracted_details'),
  qrData: text('qr_data'),
  validationResult: text('validation_result'),
  isValid: boolean('is_valid').notNull().default(true),
  balanceDeducted: integer('balance_deducted').notNull().default(5),
  shareToken: varchar('share_token', { length: 64 }),
  confidenceTier: varchar('confidence_tier', { length: 20 }).default('verified'),
  verifyMode: varchar('verify_mode', { length: 20 }),
  isRecheck: boolean('is_recheck').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('receipt_checks_user_id_idx').on(table.userId),
  transactionCodeUnique: uniqueIndex('receipt_checks_tx_code_unique').on(table.transactionCode),
  shareTokenUnique: uniqueIndex('receipt_checks_share_token_unique').on(table.shareToken),
}));

export const balanceTransactions = pgTable('balance_transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 30 }).notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  referenceType: varchar('reference_type', { length: 30 }),
  referenceId: integer('reference_id'),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('balance_transactions_user_id_idx').on(table.userId),
  typeIdx: index('balance_transactions_type_idx').on(table.type),
}));

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 50 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const topUpReceiverAccounts = pgTable('top_up_receiver_accounts', {
  id: serial('id').primaryKey(),
  method: varchar('method', { length: 20 }).notNull().unique(),
  receiverName: text('receiver_name').notNull(),
  receiverAccount: text('receiver_account').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/** Prepaid developer API keys — capacity is sum of verified receipt amounts (Birr). */
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('API Key'),
  keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
  keyHash: text('key_hash').notNull().unique(),
  packagePrice: decimal('package_price', { precision: 10, scale: 2 }).notNull(),
  capacityAmount: decimal('capacity_amount', { precision: 12, scale: 2 }).notNull(),
  usedAmount: decimal('used_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
  statusIdx: index('api_keys_status_idx').on(table.status),
  keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
}));
