import { db } from '../db/index.js';
import { receiptChecks, user } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { getConfidenceDescription, getConfidenceLabel } from './confidenceService.js';

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'Commercial Bank of Ethiopia',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
};

function parseCheckRow(row) {
  if (!row) return null;
  return {
    ...row,
    enteredDetails: row.enteredDetails ? JSON.parse(row.enteredDetails) : null,
    extractedDetails: row.extractedDetails ? JSON.parse(row.extractedDetails) : null,
    qrData: row.qrData ? JSON.parse(row.qrData) : null,
    validationResult: row.validationResult ? JSON.parse(row.validationResult) : null,
  };
}

export async function getCertificateByShareToken(shareToken) {
  if (!shareToken?.trim()) return null;

  const row = await db.query.receiptChecks.findFirst({
    where: eq(receiptChecks.shareToken, shareToken.trim()),
  });

  if (!row || !row.isValid) return null;

  const owner = await db.query.user.findFirst({ where: eq(user.id, row.userId) });

  const check = parseCheckRow(row);
  return {
    id: check.id,
    shareToken: check.shareToken,
    paymentMethod: check.paymentMethod,
    paymentMethodLabel: METHOD_LABELS[check.paymentMethod] || check.paymentMethod,
    transactionCode: check.transactionCode,
    amount: check.amount,
    senderName: check.senderName,
    senderAccount: check.senderAccount,
    receiverName: check.receiverName,
    receiverAccount: check.receiverAccount,
    confidenceTier: check.confidenceTier,
    confidenceLabel: getConfidenceLabel(check.confidenceTier),
    confidenceDescription: getConfidenceDescription(check.confidenceTier, check.verifyMode),
    verifyMode: check.verifyMode,
    verifiedAt: check.createdAt,
    verifiedBy: owner ? { name: owner.name } : null,
  };
}

export async function getCheckByIdForUser(userId, checkId) {
  const row = await db.query.receiptChecks.findFirst({
    where: eq(receiptChecks.id, checkId),
  });
  if (!row || row.userId !== userId) return null;
  return parseCheckRow(row);
}
