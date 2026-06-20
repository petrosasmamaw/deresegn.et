import fs from 'fs/promises';
import cloudinary from '../config/cloudinary.js';
import { db } from '../db/index.js';
import { balances, receiptChecks, topUpTransactions } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { extractPaymentFromScreenshot, extractPaymentFromBuffer } from './geminiService.js';
import { decodeQrFromImage, decodeQrFromBuffer } from './qrService.js';
import { validateReceiptSubmission, buildDuplicateTxIssue } from './receiptValidationService.js';
import { getTopUpReceiverAccount } from './topUpAccountService.js';
import { normalizeTxCode } from '../utils/txCode.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { fetchCbeTransactionFromQr, mergeCbeApiIntoQrFields } from './cbeReceiptService.js';
import { verifyTelebirrReceipt } from './telebirrVerifyService.js';
import {
  verifyDashenReceipt,
} from './dashenService.js';
import {
  verifyBoaReceipt,
} from './boaReceiptService.js';
import {
  lookupOfficialByReference,
  REFERENCE_SCREENSHOT_PLACEHOLDER,
  validateReferenceInput,
} from './referenceVerifyService.js';

function toMoney(value) {
  return (Math.round((parseFloat(value) || 0) * 100) / 100).toFixed(2);
}

export function resolvePaymentId(method, { validation, qrData, extracted }) {
  const qrFields = validation?.qrFields;
  const qrTx = normalizeTxCode(qrFields?.transactionCode || qrData?.transactionCode);
  const screenshotTx = normalizeTxCode(extracted?.transactionCode);
  const fallbackTx = normalizeTxCode(validation?.txCode);

  if (method === 'telebirr') {
    if (qrFields?.telebirrApiSource || qrFields?.transactionCode) {
      return qrTx || fallbackTx || screenshotTx || null;
    }
    return qrTx || screenshotTx || fallbackTx || null;
  }
  if (method === 'cbe') {
    return qrTx || screenshotTx || qrData?.verificationToken || fallbackTx || null;
  }
  if (method === 'dashen') {
    return qrTx || screenshotTx || qrData?.dashenReference || qrData?.dashenReceiptToken || qrData?.verificationToken || fallbackTx || null;
  }
  if (method === 'boa') {
    if (qrFields?.boaApiSource || qrFields?.boaQrDecrypted) {
      return qrTx || fallbackTx || screenshotTx || null;
    }
    return null;
  }
  return qrTx || screenshotTx || fallbackTx || null;
}

const TOPUP_UNITS_PER_APPROVAL = 50;

// Calculate check cost based on receipt amount
export function getCheckCostByAmount(amount) {
  const numAmount = parseFloat(amount) || 0;
  
  if (numAmount < 100) return 2;
  if (numAmount < 1000) return 5;
  if (numAmount < 5000) return 10;
  if (numAmount < 10000) return 15;
  return 20;
}

export class CheckError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export class TopUpError extends CheckError {}

async function cleanupTempFile(filePath) {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => {});
}

async function deleteCloudinaryImage(publicId) {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});
}

async function uploadScreenshot(screenshotPath) {
  const folder = process.env.CLOUDINARY_FOLDER || 'deresegn';
  const result = await cloudinary.uploader.upload(screenshotPath, {
    folder: `${folder}/receipts`,
    resource_type: 'image',
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function uploadScreenshotBuffer(buffer, mimeType = 'image/jpeg') {
  const folder = process.env.CLOUDINARY_FOLDER || 'deresegn';
  const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: `${folder}/receipts`,
    resource_type: 'image',
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function ensureUserBalance(userId) {
  let row = await db.query.balances.findFirst({ where: eq(balances.userId, userId) });
  if (!row) {
    const [created] = await db.insert(balances).values({ userId, amount: 0 }).returning();
    row = created;
  }
  return row;
}

export async function getUserBalance(userId) {
  const row = await ensureUserBalance(userId);
  return parseFloat(toMoney(row.amount));
}

async function deductBalance(userId, amount) {
  const row = await ensureUserBalance(userId);
  const current = parseFloat(toMoney(row.amount));
  const debit = parseFloat(amount) || 0;
  if (current < debit) {
    throw new CheckError('Insufficient balance. Top up to continue verifying receipts.', 402);
  }
  const [updated] = await db
    .update(balances)
    .set({ amount: toMoney(current - debit), updatedAt: new Date() })
    .where(eq(balances.userId, userId))
    .returning();
  return parseFloat(toMoney(updated.amount));
}

async function addBalance(userId, amount) {
  const row = await ensureUserBalance(userId);
  const current = parseFloat(toMoney(row.amount));
  const credit = parseFloat(amount) || 0;
  const [updated] = await db
    .update(balances)
    .set({ amount: toMoney(current + credit), updatedAt: new Date() })
    .where(eq(balances.userId, userId))
    .returning();
  return parseFloat(toMoney(updated.amount));
}

export async function findCheckByTxCode(txCode) {
  if (!txCode) return null;
  return db.query.receiptChecks.findFirst({
    where: eq(receiptChecks.transactionCode, txCode),
  });
}

export async function findTopUpByTxCode(txCode) {
  if (!txCode) return null;
  return db.query.topUpTransactions.findFirst({
    where: eq(topUpTransactions.transactionCode, txCode),
  });
}

function parseCheckRow(row) {
  if (!row) return null;
  return {
    ...row,
    enteredDetails: row.enteredDetails ? JSON.parse(row.enteredDetails) : null,
    extractedDetails: row.extractedDetails ? JSON.parse(row.extractedDetails) : null,
    qrData: row.qrData ? JSON.parse(row.qrData) : null,
    validationResult: row.validationResult ? JSON.parse(row.validationResult) : null,
    aiResult: row.extractedDetails ? JSON.parse(row.extractedDetails) : null,
  };
}

export async function getCheckHistory(userId, limit = 50) {
  const rows = await db
    .select()
    .from(receiptChecks)
    .where(eq(receiptChecks.userId, userId))
    .orderBy(desc(receiptChecks.createdAt))
    .limit(limit);
  return rows.map(parseCheckRow);
}

async function readScreenshotBuffer(screenshotPath) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fs.readFile(screenshotPath);
    } catch {
      await new Promise((resolve) => { setTimeout(resolve, 80 * (attempt + 1)); });
    }
  }
  return null;
}

async function resolveScreenshotInput({ screenshotBuffer, screenshotMime, screenshotPath }) {
  if (screenshotBuffer && Buffer.isBuffer(screenshotBuffer) && screenshotBuffer.length > 0) {
    return {
      buffer: screenshotBuffer,
      mime: screenshotMime || 'image/jpeg',
    };
  }
  if (screenshotPath) {
    const buffer = await readScreenshotBuffer(screenshotPath);
    const mime = screenshotPath.toLowerCase().endsWith('.png') ? 'image/png'
      : screenshotPath.toLowerCase().endsWith('.webp') ? 'image/webp'
        : 'image/jpeg';
    return { buffer, mime };
  }
  return { buffer: null, mime: null };
}

async function extractScreenshotData({ screenshotBuffer, screenshotMime, screenshotPath }, method) {
  let geminiUsed = true;
  let geminiError = null;

  const { buffer, mime } = await resolveScreenshotInput({ screenshotBuffer, screenshotMime, screenshotPath });

  if (method === 'dashen') {
    const dashen = await verifyDashenReceipt({ buffer, mime, screenshotPath });
    return {
      extracted: dashen.extracted,
      geminiUsed: dashen.geminiUsed,
      geminiError: dashen.geminiError,
      initialQr: dashen.qrData,
      dashenQrFields: dashen.qrFields,
      buffer,
    };
  }

  if (method === 'boa') {
    const boa = await verifyBoaReceipt({ buffer, mime, screenshotPath });
    return {
      extracted: boa.extracted,
      geminiUsed: boa.geminiUsed,
      geminiError: boa.geminiError,
      initialQr: boa.qrData,
      boaQrFields: boa.qrFields,
      boaResolve: boa.boaResolve,
      buffer,
    };
  }

  if (method === 'telebirr') {
    const telebirr = await verifyTelebirrReceipt({ buffer, mime, screenshotPath });
    return {
      extracted: telebirr.extracted,
      geminiUsed: telebirr.geminiUsed,
      geminiError: telebirr.geminiError,
      initialQr: telebirr.qrData,
      telebirrQrFields: telebirr.qrFields,
      telebirrResolve: telebirr.telebirrResolve,
      buffer,
    };
  }

  const geminiPromise = (buffer
    ? extractPaymentFromBuffer(buffer, method, mime)
    : extractPaymentFromScreenshot(screenshotPath, method)
  )
    .then((data) => ({ data }))
    .catch((err) => ({ error: err }));

  const qrPromise = buffer
    ? decodeQrFromBuffer(buffer, { maxMs: 14000 })
    : decodeQrFromImage(screenshotPath);

  const [geminiOutcome, initialQr] = await Promise.all([geminiPromise, qrPromise]);

  let extracted;
  if (geminiOutcome.error) {
    geminiError = geminiOutcome.error.message;
    console.warn('[Gemini]', geminiError);
    geminiUsed = false;
    extracted = {
      senderName: null,
      senderAccount: null,
      receiverName: null,
      receiverAccount: null,
      amount: null,
      date: null,
      transactionCode: null,
    };
  } else {
    extracted = geminiOutcome.data;
  }

  return { extracted, geminiUsed, geminiError, initialQr, buffer };
}

async function runReceiptVerification({
  method,
  form,
  screenshotBuffer,
  screenshotMime,
  screenshotPath,
  withDetails = true,
  expectedReceiver = null,
}) {
  const {
    extracted, geminiUsed, geminiError, initialQr, buffer, dashenQrFields, boaQrFields, boaResolve,
    telebirrQrFields, telebirrResolve,
  } = await extractScreenshotData(
    { screenshotBuffer, screenshotMime, screenshotPath },
    method,
  );

  let qrData = initialQr;

  if (qrData?.transactionCode) {
    console.log('[QR] Payment ID from QR:', qrData.transactionCode);
  }

  let qrFields = method === 'dashen' && dashenQrFields
    ? dashenQrFields
    : method === 'boa' && boaQrFields
      ? boaQrFields
      : method === 'telebirr' && telebirrQrFields
        ? telebirrQrFields
        : extractQrReceiptFields(method, qrData);
  if (method === 'cbe' && qrData?.verificationToken) {
    const cbeApiFields = await fetchCbeTransactionFromQr(qrData);
    qrFields = mergeCbeApiIntoQrFields(qrFields, cbeApiFields);
    if (cbeApiFields?.transactionCode) {
      console.log('[CBE API] Loaded transaction:', cbeApiFields.transactionCode);
    }
  }

  const validation = validateReceiptSubmission({
    method,
    form,
    extracted,
    qrData,
    qrFields,
    geminiUsed,
    geminiError,
    withDetails,
    expectedReceiver,
    boaResolve,
    telebirrResolve,
  });

  const paymentId = resolvePaymentId(method, { validation, qrData, extracted });
  if (paymentId) {
    validation.txCode = paymentId;
    if (validation.resolvedDetails) {
      validation.resolvedDetails.transactionCode = paymentId;
    }
  }

  if (validation.txCode) {
    const duplicateCheck = await findCheckByTxCode(validation.txCode);
    if (duplicateCheck) {
      const dupIssue = buildDuplicateTxIssue(validation.txCode);
      validation.passed = false;
      validation.issues = [dupIssue, ...validation.issues];
      validation.errors = [dupIssue.message, ...validation.errors];
    }

    const duplicateTopUp = await findTopUpByTxCode(validation.txCode);
    if (duplicateTopUp?.status === 'complete') {
      const dupIssue = buildDuplicateTxIssue(validation.txCode);
      validation.passed = false;
      validation.issues = [dupIssue, ...validation.issues];
      validation.errors = [dupIssue.message, ...validation.errors];
    }
  }

  return {
    passed: validation.passed,
    validation,
    extracted,
    qrData,
  };
}

export async function submitReceiptCheck({
  userId,
  method,
  form,
  screenshotBuffer,
  screenshotMime,
  screenshotPath,
  withDetails = true,
}) {
  let screenshotUrl = null;
  let screenshotPublicId = null;

  try {
    const result = await runReceiptVerification({
      method,
      form,
      screenshotBuffer,
      screenshotMime,
      screenshotPath,
      withDetails,
    });

    if (!result.passed) {
      const firstError = result.validation.errors[0] || 'Receipt could not be verified';
      throw new CheckError(firstError, 422, {
        validation: result.validation,
        issues: result.validation.issues.filter((i) => i.type === 'error'),
      });
    }

    const upload = screenshotBuffer
      ? await uploadScreenshotBuffer(screenshotBuffer, screenshotMime)
      : await uploadScreenshot(screenshotPath);
    screenshotUrl = upload.url;
    screenshotPublicId = upload.publicId;

    const details = result.validation.resolvedDetails;
    const checkCost = getCheckCostByAmount(details.amount);
    const newBalance = await deductBalance(userId, checkCost);

    try {
      const [saved] = await db.insert(receiptChecks).values({
        userId,
        paymentMethod: method,
        senderName: details.senderName,
        senderAccount: details.senderAccount,
        receiverName: details.receiverName,
        receiverAccount: details.receiverAccount,
        amount: String(details.amount || 0),
        transactionCode: result.validation.txCode,
        screenshotUrl,
        enteredDetails: JSON.stringify(withDetails ? form : { withDetails: false }),
        extractedDetails: JSON.stringify(result.extracted),
        qrData: JSON.stringify(result.qrData),
        validationResult: JSON.stringify(result.validation),
        isValid: true,
        balanceDeducted: checkCost,
      }).returning();

      return {
        check: parseCheckRow(saved),
        newBalance,
        message: result.validation.warnings.length
          ? 'Receipt verified (with warnings)'
          : 'Receipt verified successfully',
        validation: result.validation,
        issues: result.validation.issues,
        resolvedDetails: details,
      };
    } catch (err) {
      await addBalance(userId, checkCost);
      await deleteCloudinaryImage(screenshotPublicId);
      screenshotPublicId = null;

      if (err.code === '23505') {
        const dupIssue = buildDuplicateTxIssue(result.validation.txCode);
        throw new CheckError(dupIssue.message, 409, { issues: [dupIssue] });
      }
      throw err;
    }
  } finally {
    await cleanupTempFile(screenshotPath);
  }
}

export async function submitReferenceCheck({
  userId,
  method,
  transactionCode,
  accountSuffix = '',
}) {
  try {
    validateReferenceInput(method, { transactionCode, accountSuffix });
  } catch (err) {
    if (err.isValidation) {
      throw new CheckError(err.message, 400, {
        issues: [{
          type: 'error',
          code: 'INVALID_REFERENCE_INPUT',
          field: err.field,
          message: err.message,
        }],
      });
    }
    throw err;
  }

  const result = await lookupOfficialByReference(method, { transactionCode, accountSuffix });

  if (!result.passed) {
    throw new CheckError(result.message, 422, {
      issues: [{
        type: 'error',
        code: 'OFFICIAL_RECORD_NOT_FOUND',
        field: 'transactionCode',
        message: result.message,
      }],
    });
  }

  const duplicateCheck = await findCheckByTxCode(result.txCode);
  if (duplicateCheck) {
    const dupIssue = buildDuplicateTxIssue(result.txCode);
    throw new CheckError(dupIssue.message, 409, { issues: [dupIssue] });
  }

  const duplicateTopUp = await findTopUpByTxCode(result.txCode);
  if (duplicateTopUp?.status === 'complete') {
    const dupIssue = buildDuplicateTxIssue(result.txCode);
    throw new CheckError(dupIssue.message, 409, { issues: [dupIssue] });
  }

  const details = result.resolvedDetails;
  const checkCost = getCheckCostByAmount(details.amount);
  const newBalance = await deductBalance(userId, checkCost);

  const validation = {
    passed: true,
    verifyMode: 'reference',
    txCode: result.txCode,
    resolvedDetails: details,
    officialSource: result.official?.source || 'official_api',
    issues: [],
    warnings: [],
    errors: [],
  };

  try {
    const [saved] = await db.insert(receiptChecks).values({
      userId,
      paymentMethod: method,
      senderName: details.senderName,
      senderAccount: details.senderAccount,
      receiverName: details.receiverName,
      receiverAccount: details.receiverAccount,
      amount: String(details.amount || 0),
      transactionCode: result.txCode,
      screenshotUrl: REFERENCE_SCREENSHOT_PLACEHOLDER,
      enteredDetails: JSON.stringify({
        verifyMode: 'reference',
        transactionCode: result.validated.transactionCode,
        accountSuffix: result.validated.accountSuffix || null,
      }),
      extractedDetails: JSON.stringify({ official: result.official }),
      qrData: JSON.stringify(null),
      validationResult: JSON.stringify(validation),
      isValid: true,
      balanceDeducted: checkCost,
    }).returning();

    return {
      check: parseCheckRow(saved),
      newBalance,
      message: 'Payment ID verified successfully',
      validation,
      issues: [],
      resolvedDetails: details,
    };
  } catch (err) {
    await addBalance(userId, checkCost);

    if (err.code === '23505') {
      const dupIssue = buildDuplicateTxIssue(result.txCode);
      throw new CheckError(dupIssue.message, 409, { issues: [dupIssue] });
    }
    throw err;
  }
}

export async function submitTopUp({ userId, screenshotPath, method = 'telebirr' }) {
  const receiverConfig = await getTopUpReceiverAccount(method);
  if (!receiverConfig) {
    throw new TopUpError('Top-up is only supported for Telebirr and CBE', 400);
  }

  let screenshotUrl = null;
  let screenshotPublicId = null;

  try {
    const result = await runReceiptVerification({
      method,
      form: {},
      screenshotPath,
      withDetails: false,
      expectedReceiver: {
        receiverName: receiverConfig.receiverName,
        receiverAccount: receiverConfig.receiverAccount,
      },
    });

    if (!result.passed) {
      const firstError = result.validation.errors[0] || 'Top-up receipt could not be verified';
      throw new TopUpError(firstError, 422, {
        validation: result.validation,
        issues: result.validation.issues.filter((i) => i.type === 'error'),
      });
    }

    const details = result.validation.resolvedDetails;
    const birrAmount = parseFloat(details.amount) || 0;
    const paymentId = result.validation.txCode || resolvePaymentId(method, {
      validation: result.validation,
      qrData: result.qrData,
      extracted: result.extracted,
    });

    if (!paymentId) {
      throw new TopUpError('Payment ID error: could not determine a unique payment ID from the QR code or receipt.', 422);
    }

    if (birrAmount <= 0) {
      throw new TopUpError('Invalid amount. Please deposit a valid Birr amount.', 422);
    }

    details.transactionCode = paymentId;

    const upload = await uploadScreenshot(screenshotPath);
    screenshotUrl = upload.url;
    screenshotPublicId = upload.publicId;

    try {
      const outcome = await db.transaction(async (tx) => {
        const [existingBalance] = await tx
          .select()
          .from(balances)
          .where(eq(balances.userId, userId))
          .limit(1);

        let balanceRow = existingBalance;
        if (!balanceRow) {
          const [created] = await tx.insert(balances).values({ userId, amount: '0.00' }).returning();
          balanceRow = created;
        }

        const current = parseFloat(toMoney(balanceRow.amount));
        const nextBalance = toMoney(current + birrAmount);

        const [transaction] = await tx.insert(topUpTransactions).values({
          userId,
          screenshotUrl,
          status: 'complete',
          senderName: details.senderName,
          senderAccount: details.senderAccount,
          receiverName: details.receiverName,
          receiverAccount: details.receiverAccount,
          amount: toMoney(birrAmount),
          transactionCode: paymentId,
          aiResult: JSON.stringify({
            extracted: result.extracted,
            qrData: result.qrData,
            validation: result.validation,
          }),
          unitsAdded: Math.round(birrAmount),
          submittedAt: new Date(),
        }).returning();

        const [updatedBalance] = await tx
          .update(balances)
          .set({ amount: nextBalance, updatedAt: new Date() })
          .where(eq(balances.userId, userId))
          .returning();

        return {
          transaction,
          newBalance: parseFloat(toMoney(updatedBalance.amount)),
        };
      });

      return {
        newBalance: outcome.newBalance,
        transaction: outcome.transaction,
        message: 'Top-up verified and balance credited',
        resolvedDetails: details,
        validation: result.validation,
      };
    } catch (err) {
      await deleteCloudinaryImage(screenshotPublicId);
      screenshotPublicId = null;

      if (err.code === '23505') {
        const dupIssue = buildDuplicateTxIssue(paymentId);
        throw new TopUpError(dupIssue.message, 409, { issues: [dupIssue] });
      }
      throw err;
    }
  } finally {
    await cleanupTempFile(screenshotPath);
  }
}
