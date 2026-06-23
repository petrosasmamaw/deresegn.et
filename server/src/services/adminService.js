import { db } from '../db/index.js';
import { user, balances, receiptChecks, topUpTransactions, balanceTransactions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getBonusStats, getRegistrationBonusSettings } from './balanceLedgerService.js';

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
      ...(await getBonusStats()),
    },
    recentChecks: checks
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map((c) => ({
        id: c.id,
        userId: c.userId,
        paymentMethod: c.paymentMethod,
        transactionCode: c.transactionCode,
        amount: c.amount,
        balanceDeducted: c.balanceDeducted,
        confidenceTier: c.confidenceTier,
        verifyMode: c.verifyMode,
        shareToken: c.shareToken,
        createdAt: c.createdAt,
      })),
    recentTopups: topups
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map((t) => ({
        id: t.id,
        userId: t.userId,
        status: t.status,
        amount: t.amount,
        transactionCode: t.transactionCode,
        unitsAdded: t.unitsAdded,
        createdAt: t.createdAt,
      })),
    recentBonuses: (await db
      .select()
      .from(balanceTransactions)
      .where(eq(balanceTransactions.type, 'registration_bonus'))
      .orderBy(desc(balanceTransactions.createdAt))
      .limit(50)),
    registrationBonus: await getRegistrationBonusSettings(),
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

  const ledger = await db
    .select()
    .from(balanceTransactions)
    .where(eq(balanceTransactions.userId, userId))
    .orderBy(desc(balanceTransactions.createdAt))
    .limit(100);

  const bonusTotal = ledger
    .filter((t) => t.type === 'registration_bonus')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

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
    ledger,
    stats: {
      checksCount: checks.length,
      topupsCount: topups.filter((t) => t.status === 'complete').length,
      totalVerified: checks.filter((c) => c.isValid).length,
      registrationBonusTotal: bonusTotal,
    },
  };
}

export async function getAllVerifications(limit = 100) {
  const checks = await db
    .select()
    .from(receiptChecks)
    .orderBy(desc(receiptChecks.createdAt))
    .limit(limit);
  return checks;
}

export async function getAllTopups(limit = 100) {
  const topups = await db
    .select()
    .from(topUpTransactions)
    .orderBy(desc(topUpTransactions.createdAt))
    .limit(limit);
  return topups;
}
