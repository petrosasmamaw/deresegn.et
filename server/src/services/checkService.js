import fs from 'fs/promises';
import cloudinary from '../config/cloudinary.js';
import { db } from '../db/index.js';
import { balances, receiptChecks, topUpTransactions } from '../db/schema.js';
import { eq, desc, sql } from 'drizzle-orm';
import { extractPaymentFromScreenshot, extractPaymentFromBuffer } from './geminiService.js';
import { decodeQrFromImage, decodeQrFromBuffer, prepareQrScanImage } from './qrService.js';
import { validateReceiptSubmission, buildDuplicateTxIssue, validateOfficialTopUpReceiver } from './receiptValidationService.js';
import { getTopUpReceiverAccount } from './topUpAccountService.js';
import { normalizeTxCode } from '../utils/txCode.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { fetchCbeTransactionFromQr, mergeCbeApiIntoQrFields, verifyCbeReceipt } from './cbeReceiptService.js';
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
import {
  verifySmsTransaction,
  SMS_SCREENSHOT_PLACEHOLDER,
} from './smsVerifyService.js';
import {
  generateShareToken,
  isWithinRecheckWindow,
  recordBalanceTransaction,
  ensureRegistrationBonus,
} from './balanceLedgerService.js';
import { computeConfidenceTier } from './confidenceService.js';
import { matchPaymentToMyAccount } from './userPaymentAccountService.js';
import { isVerifyChannelEnabled } from './verifyChannelService.js';

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

function parseMatchMyAccount(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

async function assertVerifyChannel(method, mode) {
  const allowed = await isVerifyChannelEnabled(method, mode);
  if (!allowed) {
    throw new CheckError('This verification option is currently unavailable', 403, {
      issues: [{
        type: 'error',
        code: 'CHANNEL_DISABLED',
        field: 'method',
        message: 'This verification option is currently unavailable',
      }],
    });
  }
}

async function enforcePaymentToMyAccount(userId, method, matchMyAccount, details) {
  if (!parseMatchMyAccount(matchMyAccount) || !userId) return;
  const match = await matchPaymentToMyAccount(userId, method, details);
  if (!match.ok) {
    throw new CheckError(match.message, 422, { issues: match.issues });
  }
}

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
  await ensureRegistrationBonus(userId)
  const row = await ensureUserBalance(userId)
  return parseFloat(toMoney(row.amount))
}

async function deductBalance(userId, amount, ledgerMeta = null) {
  await ensureUserBalance(userId);
  const debit = parseFloat(toMoney(amount)) || 0;
  if (debit <= 0) {
    return getUserBalance(userId);
  }

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
    throw new CheckError('Insufficient balance. Top up to continue verifying receipts.', 402);
  }

  const newBalance = parseFloat(toMoney(row.amount));
  if (ledgerMeta && debit > 0) {
    await recordBalanceTransaction({
      userId,
      type: ledgerMeta.type || 'verification',
      amount: -debit,
      balanceAfter: newBalance,
      referenceType: ledgerMeta.referenceType || null,
      referenceId: ledgerMeta.referenceId || null,
      description: ledgerMeta.description || null,
    });
  }
  return newBalance;
}

async function addBalance(userId, amount) {
  await ensureUserBalance(userId);
  const credit = parseFloat(toMoney(amount)) || 0;
  if (credit <= 0) {
    return getUserBalance(userId);
  }

  const result = await db.execute(sql`
    UPDATE balances
    SET amount = amount + ${credit}::numeric,
        updated_at = NOW()
    WHERE user_id = ${userId}
    RETURNING amount
  `);
  const row = result?.rows?.[0] || result?.[0];
  return parseFloat(toMoney(row?.amount));
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

function buildResolvedDetailsFromCheck(row) {
  return {
    senderName: row.senderName,
    senderAccount: row.senderAccount,
    receiverName: row.receiverName,
    receiverAccount: row.receiverAccount,
    amount: row.amount,
    transactionCode: row.transactionCode,
  };
}

function buildRecheckResult(existingRow) {
  const check = parseCheckRow(existingRow);
  return {
    check,
    newBalance: null,
    message: 'Receipt re-verified (no charge within 24h)',
    validation: check.validationResult,
    issues: check.validationResult?.issues || [],
    resolvedDetails: buildResolvedDetailsFromCheck(check),
    isRecheck: true,
    previousVerification: buildPreviouslyVerifiedInfo(existingRow, 'self'),
  };
}

function buildPreviouslyVerifiedInfo(existingRow, verifiedBy = 'other') {
  if (!existingRow) return null;
  return {
    verifiedBy,
    checkedAt: existingRow.createdAt,
    method: existingRow.paymentMethod,
    verifyMode: existingRow.verifyMode,
  };
}

function buildExistingVerifiedResult(existingRow, verifiedBy = 'other') {
  const check = parseCheckRow(existingRow);
  return {
    check,
    newBalance: null,
    message: 'Payment ID already verified',
    validation: check.validationResult,
    issues: check.validationResult?.issues || [],
    resolvedDetails: buildResolvedDetailsFromCheck(check),
    isRecheck: true,
    previousVerification: buildPreviouslyVerifiedInfo(existingRow, verifiedBy),
  };
}

async function resolveDuplicateCheck(userId, txCode) {
  if (!txCode) return { action: 'continue' };
  const existing = await findCheckByTxCode(txCode);
  if (!existing) return { action: 'continue' };
  if (existing.userId === userId && isWithinRecheckWindow(existing.createdAt)) {
    return { action: 'recheck', existing };
  }
  return {
    action: 'existing',
    existing,
    verifiedBy: existing.userId === userId ? 'self' : 'other',
  };
}

function buildCheckRecordValues({
  userId,
  method,
  details,
  txCode,
  screenshotUrl,
  enteredDetails,
  extractedDetails,
  qrData,
  validation,
  checkCost,
  verifyMode,
  isRecheck = false,
}) {
  const confidenceTier = computeConfidenceTier(validation, verifyMode);
  return {
    userId,
    paymentMethod: method,
    senderName: details.senderName,
    senderAccount: details.senderAccount,
    receiverName: details.receiverName,
    receiverAccount: details.receiverAccount,
    amount: String(details.amount || 0),
    transactionCode: txCode,
    screenshotUrl,
    enteredDetails: JSON.stringify(enteredDetails),
    extractedDetails: JSON.stringify(extractedDetails),
    qrData: JSON.stringify(qrData),
    validationResult: JSON.stringify(validation),
    isValid: true,
    balanceDeducted: checkCost,
    shareToken: generateShareToken(),
    confidenceTier,
    verifyMode,
    isRecheck,
  };
}

async function finalizeRecheck(userId, existing) {
  const balance = await getUserBalance(userId);
  const result = buildRecheckResult(existing);
  result.newBalance = balance;
  return result;
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

  if (method === 'cbe') {
    const cbe = await verifyCbeReceipt({ buffer, mime, screenshotPath });
    return {
      extracted: cbe.extracted,
      geminiUsed: cbe.geminiUsed,
      geminiError: cbe.geminiError,
      initialQr: cbe.qrData,
      cbeQrFields: cbe.qrFields,
      cbeApiFields: cbe.cbeOfficial,
      buffer,
    };
  }

  const geminiPromise = (buffer
    ? extractPaymentFromBuffer(buffer, method, mime)
    : extractPaymentFromScreenshot(screenshotPath, method)
  )
    .then((data) => ({ data }))
    .catch((err) => ({ error: err }));

  const preparedPromise = buffer ? prepareQrScanImage(buffer) : Promise.resolve(null);

  const qrPromise = preparedPromise.then((prepared) => (
    buffer
      ? decodeQrFromBuffer(buffer, { maxMs: 9000, image: prepared })
      : decodeQrFromImage(screenshotPath)
  ));

  const cbeApiPrefetch = method === 'cbe'
    ? qrPromise.then((qr) => (qr?.verificationToken ? fetchCbeTransactionFromQr(qr) : null))
    : Promise.resolve(null);

  const [geminiOutcome, initialQr, cbeApiFields] = await Promise.all([
    geminiPromise,
    qrPromise,
    cbeApiPrefetch,
  ]);

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

  return { extracted, geminiUsed, geminiError, initialQr, buffer, cbeApiFields };
}

async function runReceiptVerification({
  userId,
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
    telebirrQrFields, telebirrResolve, cbeQrFields, cbeApiFields,
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
        : method === 'cbe' && cbeQrFields
          ? cbeQrFields
          : extractQrReceiptFields(method, qrData);
  if (method === 'cbe' && !cbeQrFields && qrData?.verificationToken) {
    const cbeApiFieldsResolved = cbeApiFields || await fetchCbeTransactionFromQr(qrData);
    qrFields = mergeCbeApiIntoQrFields(qrFields, cbeApiFieldsResolved);
    if (cbeApiFieldsResolved?.transactionCode) {
      console.log('[CBE API] Loaded transaction:', cbeApiFieldsResolved.transactionCode);
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
    if (userId) {
      const dup = await resolveDuplicateCheck(userId, validation.txCode);
      if (dup.action === 'recheck') {
        validation.recheckExisting = dup.existing;
      } else if (dup.action === 'existing') {
        validation.recheckExisting = dup.existing;
        validation.previousVerification = buildPreviouslyVerifiedInfo(dup.existing, dup.verifiedBy);
      }
    } else {
      const duplicateCheck = await findCheckByTxCode(validation.txCode);
      if (duplicateCheck) {
        // Guest or unauthenticated — return the existing verification instead of erroring
        validation.recheckExisting = duplicateCheck;
        validation.previousVerification = buildPreviouslyVerifiedInfo(duplicateCheck, 'other');
      }
    }

    const duplicateTopUp = await findTopUpByTxCode(validation.txCode);
    if (duplicateTopUp?.status === 'complete' && !validation.recheckExisting) {
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
  matchMyAccount = false,
}) {
  let screenshotUrl = null;
  let screenshotPublicId = null;

  await assertVerifyChannel(method, 'screenshot');

  try {
    const result = await runReceiptVerification({
      userId,
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

    if (result.validation.recheckExisting) {
      if (result.validation.previousVerification) {
        return buildExistingVerifiedResult(
          result.validation.recheckExisting,
          result.validation.previousVerification.verifiedBy,
        );
      }
      return finalizeRecheck(userId, result.validation.recheckExisting);
    }

    await enforcePaymentToMyAccount(
      userId,
      method,
      matchMyAccount,
      result.validation.resolvedDetails,
    );

    const upload = screenshotBuffer
      ? await uploadScreenshotBuffer(screenshotBuffer, screenshotMime)
      : await uploadScreenshot(screenshotPath);
    screenshotUrl = upload.url;
    screenshotPublicId = upload.publicId;

    const details = result.validation.resolvedDetails;
    const checkCost = getCheckCostByAmount(details.amount);
    const newBalance = await deductBalance(userId, checkCost);

    try {
      const [saved] = await db.insert(receiptChecks).values(
        buildCheckRecordValues({
          userId,
          method,
          details,
          txCode: result.validation.txCode,
          screenshotUrl,
          enteredDetails: withDetails ? form : { withDetails: false },
          extractedDetails: result.extracted,
          qrData: result.qrData,
          validation: result.validation,
          checkCost,
          verifyMode: 'screenshot',
        }),
      ).returning();

      const check = parseCheckRow(saved);
      await recordBalanceTransaction({
        userId,
        type: 'verification',
        amount: -checkCost,
        balanceAfter: newBalance,
        referenceType: 'check',
        referenceId: check.id,
        description: `Receipt verification — ${result.validation.txCode}`,
      }).catch(() => {});

      return {
        check,
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
  billing = { type: 'wallet' },
  matchMyAccount = false,
}) {
  await assertVerifyChannel(method, 'reference');

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
      issues: result.issues?.length
        ? result.issues
        : [{
          type: 'error',
          code: 'OFFICIAL_RECORD_NOT_FOUND',
          field: 'transactionCode',
          message: result.message,
        }],
    });
  }

  const dup = await resolveDuplicateCheck(userId, result.txCode);
  if (dup.action === 'recheck') {
    return finalizeRecheck(userId, dup.existing);
  }
  if (dup.action === 'existing') {
    return buildExistingVerifiedResult(dup.existing, dup.verifiedBy);
  }

  const duplicateTopUp = await findTopUpByTxCode(result.txCode);
  if (duplicateTopUp?.status === 'complete') {
    const dupIssue = buildDuplicateTxIssue(result.txCode);
    throw new CheckError(dupIssue.message, 409, { issues: [dupIssue] });
  }

  const details = result.resolvedDetails;
  await enforcePaymentToMyAccount(userId, method, matchMyAccount, details);
  const useApiKey = billing?.type === 'api_key' && billing.apiKeyId;

  let checkCost = 0;
  let newBalance = null;
  let apiKeyState = null;

  if (useApiKey) {
    const { assertApiKeyHasCapacity, consumeApiKeyCapacity, refundApiKeyCapacity } = await import('./apiKeyService.js');
    await assertApiKeyHasCapacity(billing.apiKeyRow, details.amount);
    apiKeyState = await consumeApiKeyCapacity(billing.apiKeyId, details.amount);
    checkCost = 0;
    newBalance = await getUserBalance(userId);
  } else {
    checkCost = getCheckCostByAmount(details.amount);
    newBalance = await deductBalance(userId, checkCost);
  }

  const validation = {
    passed: true,
    verifyMode: 'reference',
    txCode: result.txCode,
    resolvedDetails: details,
    officialSource: result.official?.source || 'official_api',
    issues: [],
    warnings: [],
    errors: [],
    billedVia: useApiKey ? 'api_key' : 'wallet',
  };

  try {
    const [saved] = await db.insert(receiptChecks).values(
      buildCheckRecordValues({
        userId,
        method,
        details,
        txCode: result.txCode,
        screenshotUrl: REFERENCE_SCREENSHOT_PLACEHOLDER,
        enteredDetails: {
          verifyMode: 'reference',
          transactionCode: result.validated.transactionCode,
          accountSuffix: result.validated.accountSuffix || null,
          billedVia: useApiKey ? 'api_key' : 'wallet',
          apiKeyId: useApiKey ? billing.apiKeyId : null,
        },
        extractedDetails: { official: result.official },
        qrData: null,
        validation,
        checkCost,
        verifyMode: 'reference',
      }),
    ).returning();

    const check = parseCheckRow(saved);
    if (!useApiKey && checkCost > 0) {
      await recordBalanceTransaction({
        userId,
        type: 'verification',
        amount: -checkCost,
        balanceAfter: newBalance,
        referenceType: 'check',
        referenceId: check.id,
        description: `Payment ID verification — ${result.txCode}`,
      }).catch(() => {});
    }

    return {
      check,
      newBalance,
      apiKey: apiKeyState,
      message: 'Payment ID verified successfully',
      validation,
      issues: [],
      resolvedDetails: details,
    };
  } catch (err) {
    if (!useApiKey) {
      await addBalance(userId, checkCost);
    } else {
      const { refundApiKeyCapacity } = await import('./apiKeyService.js');
      await refundApiKeyCapacity(billing.apiKeyId, details.amount).catch(() => {});
    }

    if (err.code === '23505') {
      const dupIssue = buildDuplicateTxIssue(result.txCode);
      throw new CheckError(dupIssue.message, 409, { issues: [dupIssue] });
    }
    throw err;
  }
}

export async function submitSmsCheck({
  userId,
  method,
  smsText,
  billing = { type: 'wallet' },
  matchMyAccount = false,
}) {
  await assertVerifyChannel(method, 'sms');

  if (!['telebirr', 'cbe', 'boa'].includes(method)) {
    throw new CheckError('SMS verification is only supported for Telebirr, CBE, and Bank of Abyssinia', 400, {
      issues: [{
        type: 'error',
        code: 'UNSUPPORTED_METHOD',
        field: 'method',
        message: 'SMS verification is only supported for Telebirr, CBE, and Bank of Abyssinia',
      }],
    });
  }

  const trimmed = String(smsText || '').trim();
  if (!trimmed || trimmed.length < 40) {
    throw new CheckError('Paste the full transaction SMS including the receipt link', 400, {
      issues: [{
        type: 'error',
        code: 'SMS_REQUIRED',
        field: 'smsText',
        message: 'Paste the full transaction SMS including the receipt link',
      }],
    });
  }

  let result;
  try {
    result = await verifySmsTransaction(method, trimmed);
  } catch (err) {
    if (err.isValidation) {
      throw new CheckError(err.message, 400, {
        issues: [{
          type: 'error',
          code: 'INVALID_SMS',
          field: err.field || 'smsText',
          message: err.message,
        }],
      });
    }
    throw err;
  }

  if (!result.passed) {
    throw new CheckError(result.message, 422, {
      issues: result.issues.filter((i) => i.type === 'error'),
    });
  }

  const dup = await resolveDuplicateCheck(userId, result.txCode);
  if (dup.action === 'recheck') {
    return finalizeRecheck(userId, dup.existing);
  }
  if (dup.action === 'existing') {
    return buildExistingVerifiedResult(dup.existing, dup.verifiedBy);
  }

  const duplicateTopUp = await findTopUpByTxCode(result.txCode);
  if (duplicateTopUp?.status === 'complete') {
    const dupIssue = buildDuplicateTxIssue(result.txCode);
    throw new CheckError(dupIssue.message, 409, { issues: [dupIssue] });
  }

  const details = result.resolvedDetails;
  await enforcePaymentToMyAccount(userId, method, matchMyAccount, details);
  const useApiKey = billing?.type === 'api_key' && billing.apiKeyId;

  let checkCost = 0;
  let newBalance = null;
  let apiKeyState = null;

  if (useApiKey) {
    const { assertApiKeyHasCapacity, consumeApiKeyCapacity } = await import('./apiKeyService.js');
    await assertApiKeyHasCapacity(billing.apiKeyRow, details.amount);
    apiKeyState = await consumeApiKeyCapacity(billing.apiKeyId, details.amount);
    checkCost = 0;
    newBalance = await getUserBalance(userId);
  } else {
    checkCost = getCheckCostByAmount(details.amount);
    newBalance = await deductBalance(userId, checkCost);
  }

  const validation = {
    passed: true,
    verifyMode: 'sms',
    txCode: result.txCode,
    resolvedDetails: details,
    officialSource: result.official?.source || 'official_receipt',
    smsParsed: result.parsed,
    issues: result.issues,
    warnings: result.issues.filter((i) => i.type === 'warning'),
    errors: [],
    billedVia: useApiKey ? 'api_key' : 'wallet',
  };

  try {
    const [saved] = await db.insert(receiptChecks).values(
      buildCheckRecordValues({
        userId,
        method,
        details,
        txCode: result.txCode,
        screenshotUrl: SMS_SCREENSHOT_PLACEHOLDER,
        enteredDetails: {
          verifyMode: 'sms',
          smsTextPreview: trimmed.slice(0, 500),
          billedVia: useApiKey ? 'api_key' : 'wallet',
          apiKeyId: useApiKey ? billing.apiKeyId : null,
        },
        extractedDetails: { sms: result.parsed, official: result.official },
        qrData: null,
        validation,
        checkCost,
        verifyMode: 'sms',
      }),
    ).returning();

    const check = parseCheckRow(saved);
    if (!useApiKey && checkCost > 0) {
      await recordBalanceTransaction({
        userId,
        type: 'verification',
        amount: -checkCost,
        balanceAfter: newBalance,
        referenceType: 'check',
        referenceId: check.id,
        description: `SMS verification — ${result.txCode}`,
      }).catch(() => {});
    }

    return {
      check,
      newBalance,
      apiKey: apiKeyState,
      message: 'SMS verified successfully',
      validation,
      issues: result.issues,
      resolvedDetails: details,
    };
  } catch (err) {
    if (!useApiKey) {
      await addBalance(userId, checkCost);
    } else {
      const { refundApiKeyCapacity } = await import('./apiKeyService.js');
      await refundApiKeyCapacity(billing.apiKeyId, details.amount).catch(() => {});
    }

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
    const paymentId = result.validation.txCode || resolvePaymentId(method, {
      validation: result.validation,
      qrData: result.qrData,
      extracted: result.extracted,
    });

    if (!paymentId) {
      throw new TopUpError('Payment ID error: could not determine a unique payment ID from the QR code or receipt.', 422);
    }

    details.transactionCode = paymentId;

    const upload = await uploadScreenshot(screenshotPath);
    screenshotUrl = upload.url;
    screenshotPublicId = upload.publicId;

    try {
      const outcome = await creditTopUpBalance({
        userId,
        details,
        paymentId,
        screenshotUrl,
        aiResult: {
          verifyMode: 'screenshot',
          extracted: result.extracted,
          qrData: result.qrData,
          validation: result.validation,
        },
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
      throw err;
    }
  } finally {
    await cleanupTempFile(screenshotPath);
  }
}

export async function submitTopUpReference({
  userId,
  method,
  transactionCode,
  accountSuffix = '',
}) {
  const receiverConfig = await getTopUpReceiverAccount(method);
  if (!receiverConfig) {
    throw new TopUpError('Top-up is only supported for Telebirr and CBE', 400);
  }

  try {
    validateReferenceInput(method, { transactionCode, accountSuffix });
  } catch (err) {
    if (err.isValidation) {
      throw new TopUpError(err.message, 400, {
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
    throw new TopUpError(result.message, 422, {
      issues: [{
        type: 'error',
        code: 'OFFICIAL_RECORD_NOT_FOUND',
        field: 'transactionCode',
        message: result.message,
      }],
    });
  }

  const receiverIssues = validateOfficialTopUpReceiver(result.official, receiverConfig);
  if (receiverIssues.length) {
    throw new TopUpError(receiverIssues[0].message, 422, { issues: receiverIssues });
  }

  const details = result.resolvedDetails;
  details.transactionCode = result.txCode;

  const outcome = await creditTopUpBalance({
    userId,
    details,
    paymentId: result.txCode,
    screenshotUrl: REFERENCE_SCREENSHOT_PLACEHOLDER,
    aiResult: {
      verifyMode: 'reference',
      official: result.official,
      validated: result.validated,
    },
  });

  return {
    newBalance: outcome.newBalance,
    transaction: outcome.transaction,
    message: 'Top-up verified and balance credited',
    resolvedDetails: details,
    validation: { passed: true, verifyMode: 'reference', txCode: result.txCode },
  };
}

export async function submitTopUpSms({
  userId,
  method,
  smsText,
}) {
  const receiverConfig = await getTopUpReceiverAccount(method);
  if (!receiverConfig) {
    throw new TopUpError('Top-up is only supported for Telebirr and CBE', 400);
  }

  const trimmed = String(smsText || '').trim();
  if (!trimmed || trimmed.length < 40) {
    throw new TopUpError('Paste the full transaction SMS including the receipt link', 400, {
      issues: [{
        type: 'error',
        code: 'SMS_REQUIRED',
        field: 'smsText',
        message: 'Paste the full transaction SMS including the receipt link',
      }],
    });
  }

  let result;
  try {
    result = await verifySmsTransaction(method, trimmed);
  } catch (err) {
    if (err.isValidation) {
      throw new TopUpError(err.message, 400, {
        issues: [{
          type: 'error',
          code: 'INVALID_SMS',
          field: err.field || 'smsText',
          message: err.message,
        }],
      });
    }
    throw err;
  }

  if (!result.passed) {
    throw new TopUpError(result.message, 422, {
      issues: result.issues.filter((i) => i.type === 'error'),
    });
  }

  const receiverIssues = validateOfficialTopUpReceiver(result.official, receiverConfig);
  if (receiverIssues.length) {
    throw new TopUpError(receiverIssues[0].message, 422, { issues: receiverIssues });
  }

  const details = result.resolvedDetails;
  details.transactionCode = result.txCode;

  const outcome = await creditTopUpBalance({
    userId,
    details,
    paymentId: result.txCode,
    screenshotUrl: SMS_SCREENSHOT_PLACEHOLDER,
    aiResult: {
      verifyMode: 'sms',
      sms: result.parsed,
      official: result.official,
      smsTextPreview: trimmed.slice(0, 500),
    },
  });

  return {
    newBalance: outcome.newBalance,
    transaction: outcome.transaction,
    message: 'Top-up verified and balance credited',
    resolvedDetails: details,
    validation: { passed: true, verifyMode: 'sms', txCode: result.txCode },
  };
}

async function assertTopUpPaymentIdAvailable(paymentId) {
  const duplicateCheck = await findCheckByTxCode(paymentId);
  if (duplicateCheck) {
    const dupIssue = buildDuplicateTxIssue(paymentId);
    throw new TopUpError(dupIssue.message, 409, { issues: [dupIssue] });
  }

  const duplicateTopUp = await findTopUpByTxCode(paymentId);
  if (duplicateTopUp?.status === 'complete') {
    const dupIssue = buildDuplicateTxIssue(paymentId);
    throw new TopUpError(dupIssue.message, 409, { issues: [dupIssue] });
  }
}

async function creditTopUpBalance({
  userId,
  details,
  paymentId,
  screenshotUrl,
  aiResult,
}) {
  const birrAmount = parseFloat(details.amount) || 0;
  if (birrAmount <= 0) {
    throw new TopUpError('Invalid amount. Please deposit a valid Birr amount.', 422);
  }

  await assertTopUpPaymentIdAvailable(paymentId);

  try {
    return await db.transaction(async (tx) => {
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
        aiResult: JSON.stringify(aiResult),
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
  } catch (err) {
    if (err.code === '23505') {
      const dupIssue = buildDuplicateTxIssue(paymentId);
      throw new TopUpError(dupIssue.message, 409, { issues: [dupIssue] });
    }
    throw err;
  }
}
