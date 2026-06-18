import { db } from '../db/index.js';
import { user, balances, receiptChecks, topUpTransactions } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function getAdminDashboardData() {
  // Get all users
  const users = await db.select().from(user);

  // Get balance data for all users
  const allBalances = await db.select().from(balances);

  // Get check counts per user
  const checkCounts = {};
  const checks = await db.select().from(receiptChecks);
  checks.forEach((check) => {
    checkCounts[check.userId] = (checkCounts[check.userId] || 0) + 1;
  });

  // Get topup counts per user
  const topupCounts = {};
  const topups = await db.select().from(topUpTransactions);
  topups.forEach((topup) => {
    if (topup.status === 'complete') {
      topupCounts[topup.userId] = (topupCounts[topup.userId] || 0) + 1;
    }
  });

  // Combine data
  const usersData = users.map((u) => {
    const balance = allBalances.find((b) => b.userId === u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      balance: balance?.amount || 0,
      checksCount: checkCounts[u.id] || 0,
      topupsCount: topupCounts[u.id] || 0,
      createdAt: u.createdAt,
    };
  });

  return {
    users: usersData,
    stats: {
      totalUsers: users.length,
      totalBalance: allBalances.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0),
      totalChecks: checks.length,
      totalTopups: topups.filter((t) => t.status === 'complete').length,
    },
  };
}

export async function getUserDetailData(userId) {
  const userData = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!userData) {
    throw new Error('User not found');
  }

  const balance = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });

  const checks = await db
    .select()
    .from(receiptChecks)
    .where(eq(receiptChecks.userId, userId));

  const topups = await db
    .select()
    .from(topUpTransactions)
    .where(eq(topUpTransactions.userId, userId));

  // Parse JSON fields in checks
  const parsedChecks = checks.map((c) => ({
    ...c,
    enteredDetails: c.enteredDetails ? JSON.parse(c.enteredDetails) : null,
    extractedDetails: c.extractedDetails ? JSON.parse(c.extractedDetails) : null,
    qrData: c.qrData ? JSON.parse(c.qrData) : null,
    validationResult: c.validationResult ? JSON.parse(c.validationResult) : null,
  }));

  // Parse JSON fields in topups
  const parsedTopups = topups.map((t) => ({
    ...t,
    aiResult: t.aiResult ? JSON.parse(t.aiResult) : null,
  }));

  return {
    user: {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      createdAt: userData.createdAt,
      updatedAt: userData.updatedAt,
    },
    balance: balance?.amount || 0,
    checks: parsedChecks,
    topups: parsedTopups,
    stats: {
      checksCount: checks.length,
      topupsCount: topups.filter((t) => t.status === 'complete').length,
      totalVerified: checks.filter((c) => c.isValid).length,
    },
  };
}
