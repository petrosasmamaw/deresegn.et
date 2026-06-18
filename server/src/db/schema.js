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
  role: varchar('role', { length: 20 }).notNull().default('user'),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('receipt_checks_user_id_idx').on(table.userId),
  transactionCodeUnique: uniqueIndex('receipt_checks_tx_code_unique').on(table.transactionCode),
}));
