import {
  isSupportedMethod,
  getMethodLabel,
  requiresQrCode,
  getQrMissingMessage,
} from './receiptFormats.js';
import {
  analyzeQrAuthenticity,
  isQrTrustworthyForMethod,
  buildFakeQrIssue,
} from './qrAuthenticityService.js';
import { normalizeTxCode, txCodesMatch } from '../utils/txCode.js';
import {
  extractQrReceiptFields,
  detectScreenshotCropped,
  mergeReceiptSources,
  hasOfficialQrTruth,
} from './qrFieldExtractor.js';
import { extractTelebirrInvoiceFromExtracted } from './telebirrReceiptService.js';

function issue(type, code, field, message, extra = {}) {
  return { type, code, field, message, ...extra };
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeAccount(value) {
  const raw = String(value || '').trim().replace(/^ETB[-\s]*/i, '');
  const digitParts = raw.replace(/[^\d*]/g, '').split('*').filter(Boolean);
  if (digitParts.length >= 2) {
    let combined = digitParts.join('');
    if (combined.startsWith('251') && combined.length >= 10) {
      return `0${combined.slice(3)}`;
    }
    return combined;
  }

  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length >= 12) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

export function namesMatch(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const wordsA = na.split(' ').filter((w) => w.length > 2);
  const wordsB = nb.split(' ').filter((w) => w.length > 2);
  const overlap = wordsA.filter((w) => wordsB.some((x) => x.includes(w) || w.includes(x)));
  return overlap.length >= Math.min(2, Math.min(wordsA.length, wordsB.length));
}

export function accountsMatch(a, b) {
  const aa = normalizeAccount(a);
  const ab = normalizeAccount(b);
  if (!aa || !ab) return false;
  if (aa === ab) return true;

  const rawA = String(a || '');
  const rawB = String(b || '');
  const masked = /\*/.test(rawA) || /\*/.test(rawB);

  // Masked bank accounts (e.g. 1********7112): require shared last 4 + first digit.
  // Never accept last-4 alone for two full unmasked numbers (top-up fraud vector).
  if (masked) {
    if (aa.length < 4 || ab.length < 4) return false;
    if (aa.slice(-4) !== ab.slice(-4)) return false;
    if (aa[0] !== ab[0]) return false;
    return true;
  }

  // Full accounts: allow suffix only when the shorter side is substantial (8+ digits).
  const shorter = aa.length <= ab.length ? aa : ab;
  const longer = aa.length > ab.length ? aa : ab;
  if (shorter.length >= 8 && longer.endsWith(shorter)) return true;

  return false;
}

export function topUpReceiverAccountsMatch(method, official, expected) {
  if (accountsMatch(official, expected)) return true;
  const a = normalizeAccount(official);
  const b = normalizeAccount(expected);
  if (!a || !b) return false;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (method === 'boa' && shorter.length >= 5 && longer.endsWith(shorter)) return true;
  return false;
}

function amountsMatch(a, b) {
  const p = Number(String(a).replace(/,/g, ''));
  const f = Number(String(b).replace(/,/g, ''));
  if (Number.isNaN(p) || Number.isNaN(f)) return false;
  return Math.abs(p - f) <= 1;
}

/** Top-up receipts can differ slightly because screenshots may show fee-inclusive totals. */
function topUpAmountsCompatible(qrAmount, screenshotAmount) {
  const q = Number(String(qrAmount).replace(/,/g, ''));
  const s = Number(String(screenshotAmount).replace(/,/g, ''));
  if (Number.isNaN(q) || Number.isNaN(s)) return false;
  return Math.abs(q - s) <= 10;
}

/** Telebirr SMS/screenshot amount must match official total paid or settled (±1 Birr). No ±10 window. */
function telebirrAmountMatchesOfficial(shownAmount, official) {
  if (shownAmount == null || official == null) return true;
  const shown = Number(String(shownAmount).replace(/,/g, ''));
  if (Number.isNaN(shown)) return false;
  const candidates = [official.amount, official.settledAmount, official.totalPaidAmount]
    .filter((v) => v != null && v !== '');
  if (!candidates.length && official) {
    return amountsMatch(shownAmount, official);
  }
  return candidates.some((value) => amountsMatch(shown, value));
}

function telebirrAmountsCompatible(officialAmount, screenshotAmount, official = null) {
  if (official && typeof official === 'object') {
    return telebirrAmountMatchesOfficial(screenshotAmount, official);
  }
  if (officialAmount == null || screenshotAmount == null) return true;
  return amountsMatch(officialAmount, screenshotAmount);
}

/** CBE VAT receipts may show total debited (transfer + fees) while the official API returns transfer amount. */
function cbeAmountsCompatible(officialAmount, screenshotAmount) {
  if (officialAmount == null || screenshotAmount == null) return true;
  const o = Number(String(officialAmount).replace(/,/g, ''));
  const s = Number(String(screenshotAmount).replace(/,/g, ''));
  if (Number.isNaN(o) || Number.isNaN(s)) return false;
  if (amountsMatch(o, s)) return true;
  if (s > o && s - o <= 2) return true;
  return false;
}

function hasReliableNameForFraudCheck(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/\d/.test(text)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  const alphaLen = text.replace(/[^A-Za-z]/g, '').length;
  return words.length >= 2 && alphaLen >= 6;
}

function hasReliableAccountForFraudCheck(value) {
  const text = String(value || '').trim();
  if (!text) return false;
  const digits = normalizeAccount(text);
  if (!digits) return false;
  if (digits.length >= 8) return true;
  // Handles masked formats like 1********0027.
  if (/\d\*{2,}\d{2,}/.test(text)) return true;
  return false;
}

function hasReliableCbeIdentityText(extracted) {
  return hasReliableNameForFraudCheck(extracted?.senderName)
    && hasReliableNameForFraudCheck(extracted?.receiverName)
    && hasReliableAccountForFraudCheck(extracted?.senderAccount)
    && hasReliableAccountForFraudCheck(extracted?.receiverAccount);
}

function txCodesConflict(qr, screenshot) {
  const qrCode = normalizeTxCode(qr);
  const screenshotCode = normalizeTxCode(screenshot);
  if (!qrCode || !screenshotCode) return false;
  if (txCodesMatch(qrCode, screenshotCode)) return false;
  if (qrCode.startsWith(screenshotCode) || screenshotCode.startsWith(qrCode)) return false;
  return true;
}

function allTxCodesMatch(...candidates) {
  const codes = candidates.map(normalizeTxCode).filter(Boolean);
  if (codes.length <= 1) return true;
  const first = codes[0];
  return codes.every((c) => txCodesMatch(c, first));
}

function fieldMismatch(field, label, a, b, aLabel, bLabel) {
  if (!a || !b) return null;
  const isAccount = field.includes('Account');
  const isAmount = field === 'amount';
  const match = isAmount ? amountsMatch(a, b) : isAccount ? accountsMatch(a, b) : namesMatch(a, b);
  if (match) return null;
  return issue('error', `${field.toUpperCase()}_MISMATCH`, field,
    `${label} error: ${aLabel} shows "${a}" but ${bLabel} shows "${b}".`,
    { leftValue: a, rightValue: b });
}

export function buildDuplicateTxIssue(txCode) {
  return issue('error', 'DUPLICATE_TX', 'transactionCode',
    `Payment ID "${txCode}" was already verified. Each receipt can only be checked once.`,
    { actual: txCode });
}

/** Top-up via payment ID or SMS: official record receiver must match configured account. */
export function validateOfficialTopUpReceiver(official, expectedReceiver, method = '') {
  const issues = [];
  const expectedName = expectedReceiver?.receiverName;
  const expectedAccount = expectedReceiver?.receiverAccount;
  const officialAccount = official?.receiverAccountFull || official?.receiverAccount;

  if (!officialAccount || !topUpReceiverAccountsMatch(method, officialAccount, expectedAccount)) {
    issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
      `Receiver account error: official record shows "${officialAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
      { officialValue: officialAccount, expectedValue: expectedAccount }));
  }
  if (!official?.receiverName || !namesMatch(official.receiverName, expectedName)) {
    issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
      `Receiver name error: official record shows "${official?.receiverName || 'unknown'}" but top-up must be sent to "${expectedName}".`,
      { officialValue: official?.receiverName, expectedValue: expectedName }));
  }
  return issues;
}

function validateTopUpReceiver({
  issues,
  method,
  expectedReceiver,
  extracted,
  qrFields,
  screenshotCropped,
  geminiUsed,
}) {
  const expectedName = expectedReceiver.receiverName;
  const expectedAccount = expectedReceiver.receiverAccount;

  const qrAccount = qrFields.receiverAccountFull || qrFields.receiverAccount;
  const qrName = qrFields.receiverName;
  const shotAccount = extracted?.receiverAccount;
  const shotName = extracted?.receiverName;
  const matchAccount = (value) => topUpReceiverAccountsMatch(method, value, expectedAccount);

  if (screenshotCropped && method === 'telebirr') {
    if (qrFields?.telebirrApiSource) {
      if (!qrFields.receiverAccount || !matchAccount(qrFields.receiverAccount)) {
        issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
          `Receiver account error: official record shows "${qrFields.receiverAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
          { qrValue: qrFields.receiverAccount, expectedValue: expectedAccount }));
      }
      if (qrFields.receiverName && !namesMatch(qrFields.receiverName, expectedName)) {
        issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
          `Receiver name error: official record shows "${qrFields.receiverName}" but top-up must be sent to "${expectedName}".`,
          { qrValue: qrFields.receiverName, expectedValue: expectedName }));
      }
      return;
    }

    if (!qrAccount || !matchAccount(qrAccount)) {
      issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
        `Receiver account error: QR data does not match your registered account "${expectedAccount}".`,
        { qrValue: qrAccount, expectedValue: expectedAccount }));
    }
    if (qrName && !namesMatch(qrName, expectedName)) {
      issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
        `Receiver name error: QR data shows "${qrName}" but top-up must be sent to "${expectedName}".`,
        { qrValue: qrName, expectedValue: expectedName }));
    } else if (shotName && !namesMatch(shotName, expectedName)) {
      issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
        `Receiver name error: receipt shows "${shotName}" but top-up must be sent to "${expectedName}".`,
        { screenshotValue: shotName, expectedValue: expectedName }));
    }
    return;
  }

  if (screenshotCropped && method === 'cbe') {
    if (qrFields?.cbeApiSource) {
      if (!qrFields.receiverAccount || !matchAccount(qrFields.receiverAccount)) {
        issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
          `Receiver account error: QR data does not match your registered account "${expectedAccount}".`,
          { qrValue: qrFields.receiverAccount, expectedValue: expectedAccount }));
      }
      if (qrFields.receiverName && !namesMatch(qrFields.receiverName, expectedName)) {
        issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
          `Receiver name error: QR data shows "${qrFields.receiverName}" but top-up must be sent to "${expectedName}".`,
          { qrValue: qrFields.receiverName, expectedValue: expectedName }));
      }
      return;
    }

    if (!geminiUsed) {
      issues.push(issue('error', 'AI_UNAVAILABLE', null,
        'Could not read receipt screenshot. Upload a clearer image showing receiver details.'));
      return;
    }
    if (!shotAccount || !matchAccount(shotAccount)) {
      issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
        `Receiver account error: receipt shows "${shotAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
        { screenshotValue: shotAccount, expectedValue: expectedAccount }));
    }
    if (!shotName || !namesMatch(shotName, expectedName)) {
      issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
        `Receiver name error: receipt shows "${shotName || 'unknown'}" but top-up must be sent to "${expectedName}".`,
        { screenshotValue: shotName, expectedValue: expectedName }));
    }
    return;
  }

  if (screenshotCropped && method === 'boa') {
    if (qrFields?.boaApiSource || qrFields?.boaQrDecrypted) {
      if (!qrAccount || !matchAccount(qrAccount)) {
        issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
          `Receiver account error: official record shows "${qrAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
          { qrValue: qrAccount, expectedValue: expectedAccount }));
      }
      if (qrName && !namesMatch(qrName, expectedName)) {
        issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
          `Receiver name error: official record shows "${qrName}" but top-up must be sent to "${expectedName}".`,
          { qrValue: qrName, expectedValue: expectedName }));
      }
      return;
    }

    if (!geminiUsed) {
      issues.push(issue('error', 'AI_UNAVAILABLE', null,
        'Could not read receipt screenshot. Upload a clearer image showing receiver details.'));
      return;
    }
    if (!shotAccount || !matchAccount(shotAccount)) {
      issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
        `Receiver account error: receipt shows "${shotAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
        { screenshotValue: shotAccount, expectedValue: expectedAccount }));
    }
    if (!shotName || !namesMatch(shotName, expectedName)) {
      issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
        `Receiver name error: receipt shows "${shotName || 'unknown'}" but top-up must be sent to "${expectedName}".`,
        { screenshotValue: shotName, expectedValue: expectedName }));
    }
    return;
  }

  if (!geminiUsed) {
    issues.push(issue('error', 'AI_UNAVAILABLE', null,
      'Could not read receipt screenshot. Upload a clearer image.'));
    return;
  }

  if (!shotName || !namesMatch(shotName, expectedName)) {
    issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
      `Receiver name error: receipt shows "${shotName || 'unknown'}" but top-up must be sent to "${expectedName}".`,
      { screenshotValue: shotName, expectedValue: expectedName }));
  }
  if (!shotAccount || !matchAccount(shotAccount)) {
    issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
      `Receiver account error: receipt shows "${shotAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
      { screenshotValue: shotAccount, expectedValue: expectedAccount }));
  }

  if (qrAccount && !matchAccount(qrAccount)) {
    issues.push(issue('error', 'RECEIVER_ACCOUNT_QR_MISMATCH', 'receiverAccount',
      `Receiver account error: QR data does not match your registered account "${expectedAccount}".`,
      { qrValue: qrAccount, expectedValue: expectedAccount }));
  }
  if (qrName && !namesMatch(qrName, expectedName)) {
    issues.push(issue('error', 'RECEIVER_NAME_QR_MISMATCH', 'receiverName',
      `Receiver name error: QR data shows "${qrName}" but top-up must be sent to "${expectedName}".`,
      { qrValue: qrName, expectedValue: expectedName }));
  }

  const acctCross = fieldMismatch('receiverAccount', 'Receiver account', shotAccount, qrAccount, 'screenshot', 'QR code');
  if (acctCross && shotAccount && qrAccount
    && !(method === 'boa' && matchAccount(shotAccount) && matchAccount(qrAccount))) {
    issues.push(acctCross);
  }
  const nameCross = fieldMismatch('receiverName', 'Receiver name', shotName, qrName, 'screenshot', 'QR code');
  if (nameCross && shotName && qrName) issues.push(nameCross);
}

function validateFormAgainstQr({ issues, form, qrFields, method }) {
  const formTx = normalizeTxCode(form.transactionCode);
  const qrTx = normalizeTxCode(qrFields.transactionCode);

  if (qrTx && formTx && !txCodesMatch(qrTx, formTx)
    && !(method === 'dashen' && qrFields?.dashenSuperAppSource)) {
    issues.push(issue('error', 'TX_FORM_QR_MISMATCH', 'transactionCode',
      `Payment ID error: you entered "${formTx}" but the QR code shows "${qrTx}".`,
      { formValue: formTx, qrValue: qrTx }));
  }

  const pairs = [
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
  ];

  for (const [field, label] of pairs) {
    const formVal = form[field];
    const qrVal = qrFields[field];
    if (!formVal || !qrVal) continue;
    const mismatch = fieldMismatch(field, label, formVal, qrVal, 'your entry', 'QR code');
    if (mismatch) issues.push(mismatch);
  }

  if (method === 'telebirr' && qrTx && !formTx) {
    issues.push(issue('error', 'TX_CODE_INVALID', 'transactionCode',
      'Payment ID error: could not match your entry with the QR code.'));
  }
}

function validateScreenshotAgainstTruth({ issues, extracted, qrFields, truthLabel = 'QR code' }) {
  const pairs = [
    ['transactionCode', 'Payment ID'],
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
  ];

  for (const [field, label] of pairs) {
    const shotVal = field === 'transactionCode' ? extracted?.transactionCode : extracted?.[field];
    const truthVal = field === 'transactionCode' ? qrFields.transactionCode : qrFields[field];
    if (field === 'amount') {
      const s = shotVal != null ? String(shotVal) : null;
      const q = truthVal != null ? String(truthVal) : null;
      if (!s || !q) continue;
      const mismatch = fieldMismatch(field, label, s, q, 'screenshot', truthLabel);
      if (mismatch) issues.push(mismatch);
      continue;
    }
    if (!shotVal || !truthVal) continue;
    const mismatch = fieldMismatch(field, label, shotVal, truthVal, 'screenshot', truthLabel);
    if (mismatch) issues.push(mismatch);
  }
}

function validateTelebirrReceipt({
  issues,
  extracted,
  qrFields,
  qrFound,
  screenshotCropped,
  geminiUsed,
  telebirrResolve,
}) {
  const hasOfficial = Boolean(qrFields?.telebirrApiSource);
  const screenshotInvoice = extractTelebirrInvoiceFromExtracted(extracted);

  if (!hasOfficial && !qrFound && !screenshotInvoice) {
    issues.push(issue('error', 'TELEBIRR_VERIFY_FAILED', 'transactionCode',
      'Could not verify this Telebirr receipt. Upload a screenshot with the Invoice No. clearly visible, or enter the payment ID directly.'));
    return;
  }

  if (!hasOfficial && screenshotInvoice) {
    issues.push(issue('error', 'TELEBIRR_VERIFY_FAILED', 'transactionCode',
      `Could not verify Telebirr payment "${screenshotInvoice}". The Invoice No. was read from your screenshot but no official record was found. Check the number is correct.`));
    return;
  }

  if (!hasOfficial) return;

  if (telebirrResolve?.screenshotEdited) {
    const shotTx = normalizeTxCode(extracted?.transactionCode);
    const officialTx = normalizeTxCode(telebirrResolve.official?.transactionCode);
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Payment ID error: screenshot shows "${shotTx}" but the official Telebirr record is "${officialTx}". The receipt appears edited.`,
      { screenshotValue: shotTx, qrValue: officialTx }));
  }

  if (screenshotCropped && !extracted?.amount && !extracted?.receiverName) return;

  const shotTx = normalizeTxCode(extracted?.transactionCode);
  const officialTx = normalizeTxCode(qrFields?.transactionCode);
  if (shotTx && officialTx && !txCodesMatch(shotTx, officialTx)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Payment ID error: screenshot shows "${shotTx}" but the official Telebirr record is "${officialTx}". The receipt appears edited.`,
      { screenshotValue: shotTx, qrValue: officialTx }));
  }

  if (extracted?.senderName && qrFields?.senderName
    && !namesMatch(extracted.senderName, qrFields.senderName)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'senderName',
      `Sender name error: screenshot shows "${extracted.senderName}" but the official Telebirr record shows "${qrFields.senderName}". The receipt appears edited.`,
      { screenshotValue: extracted.senderName, qrValue: qrFields.senderName }));
  }

  if (extracted?.receiverName && qrFields?.receiverName
    && !namesMatch(extracted.receiverName, qrFields.receiverName)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'receiverName',
      `Receiver name error: screenshot shows "${extracted.receiverName}" but the official Telebirr record shows "${qrFields.receiverName}". The receipt appears edited.`,
      { screenshotValue: extracted.receiverName, qrValue: qrFields.receiverName }));
  }

  if (extracted?.senderAccount && qrFields?.senderAccount
    && !accountsMatch(extracted.senderAccount, qrFields.senderAccount)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'senderAccount',
      `Sender account error: screenshot shows "${extracted.senderAccount}" but the official Telebirr record shows "${qrFields.senderAccount}". The receipt appears edited.`,
      { screenshotValue: extracted.senderAccount, qrValue: qrFields.senderAccount }));
  }

  if (extracted?.receiverAccount && qrFields?.receiverAccount
    && !accountsMatch(extracted.receiverAccount, qrFields.receiverAccount)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'receiverAccount',
      `Receiver account error: screenshot shows "${extracted.receiverAccount}" but the official Telebirr record shows "${qrFields.receiverAccount}". The receipt appears edited.`,
      { screenshotValue: extracted.receiverAccount, qrValue: qrFields.receiverAccount }));
  }

  if (extracted?.amount != null && qrFields?.amount
    && !telebirrAmountsCompatible(qrFields.amount, extracted.amount, telebirrResolve?.official)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'amount',
      `Amount error: screenshot shows ${extracted.amount} but the official Telebirr record shows ${qrFields.amount}. The receipt appears edited.`,
      { screenshotValue: extracted.amount, qrValue: qrFields.amount }));
  }
}

function validateCbeOfficialReceipt({
  issues,
  extracted,
  qrFields,
  qrFound,
  qrAuthentic,
  screenshotCropped,
  geminiUsed,
}) {
  if (!qrFound) {
    issues.push(issue('error', 'QR_MISSING', 'screenshot',
      'Your CBE receipt screenshot must include the QR code (mobile success screen or VAT/web receipt).'));
    return;
  }

  if (!qrAuthentic) return;

  if (!qrFields?.cbeApiSource) {
    issues.push(issue('error', 'CBE_VERIFY_FAILED', 'transactionCode',
      'Could not load the official CBE record from the QR code. Upload a sharper screenshot with the full QR visible.'));
    return;
  }

  if (screenshotCropped || !geminiUsed) return;

  const shotTx = normalizeTxCode(extracted?.transactionCode);
  const officialTx = normalizeTxCode(qrFields?.transactionCode);
  if (shotTx && officialTx && !txCodesMatch(shotTx, officialTx)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Payment ID error: screenshot shows "${shotTx}" but the official CBE record is "${officialTx}". The receipt appears edited.`,
      { screenshotValue: shotTx, qrValue: officialTx }));
  }

  if (extracted?.amount != null && qrFields?.amount
    && !cbeAmountsCompatible(qrFields.amount, extracted.amount)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'amount',
      `Amount error: screenshot shows ${extracted.amount} but the official CBE record shows ${qrFields.amount}. The receipt appears edited.`,
      { screenshotValue: extracted.amount, qrValue: qrFields.amount }));
  }

  const reliableIdentityText = hasReliableCbeIdentityText(extracted);
  if (!reliableIdentityText) {
    issues.push(issue('warning', 'SCREENSHOT_TEXT_PARTIAL', null,
      'CBE screenshot identity text looks partial or unclear. Name/account checks used the official CBE QR record only.'));
    return;
  }

  for (const [field, label] of [
    ['senderName', 'Sender name'],
    ['receiverName', 'Receiver name'],
  ]) {
    const shotVal = extracted?.[field];
    const truthVal = qrFields?.[field];
    if (shotVal && truthVal && !namesMatch(shotVal, truthVal)) {
      issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', field,
        `${label} error: screenshot shows "${shotVal}" but the official CBE record shows "${truthVal}". The receipt appears edited.`,
        { screenshotValue: shotVal, qrValue: truthVal }));
    }
  }

  for (const [field, label] of [
    ['senderAccount', 'Sender account'],
    ['receiverAccount', 'Receiver account'],
  ]) {
    const shotVal = extracted?.[field];
    const truthVal = qrFields?.[field];
    if (shotVal && truthVal && !accountsMatch(shotVal, truthVal)) {
      issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', field,
        `${label} error: screenshot shows "${shotVal}" but the official CBE record shows "${truthVal}". The receipt appears edited.`,
        { screenshotValue: shotVal, qrValue: truthVal }));
    }
  }
}

function validateScreenshotAgainstQr({ issues, extracted, qrFields }) {
  validateScreenshotAgainstTruth({ issues, extracted, qrFields, truthLabel: 'QR code' });
}

function validateDashenReceipt({
  issues,
  extracted,
  qrFields,
  qrFound,
  qrAuthentic,
  screenshotCropped,
  geminiUsed,
}) {
  const hasOfficial = Boolean(qrFields?.dashenApiSource);
  const hasSuperApp = Boolean(qrFields?.dashenSuperAppSource);

  if (!qrFound && !hasOfficial) {
    issues.push(issue('error', 'QR_MISSING', 'screenshot',
      'Your Dashen Bank receipt screenshot must include the QR code (success screen or VAT receipt).'));
    return;
  }

  if (qrFound && !qrAuthentic) return;

  if (hasSuperApp) return;

  if (!hasOfficial) {
    if (!screenshotCropped) {
      issues.push(issue('error', 'DASHEN_VERIFY_FAILED', 'transactionCode',
        'Could not load the official Dashen Bank record from the QR code. Upload a sharper screenshot with the full QR visible.'));
    }
    return;
  }

  if (screenshotCropped || !geminiUsed) return;

  const shotTx = normalizeTxCode(extracted?.transactionCode);
  const officialTx = normalizeTxCode(qrFields?.transactionCode);
  if (shotTx && officialTx && !txCodesMatch(shotTx, officialTx)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Payment ID error: screenshot shows "${shotTx}" but the official Dashen Bank record is "${officialTx}". The receipt appears edited.`,
      { screenshotValue: shotTx, qrValue: officialTx }));
  }

  if (extracted?.amount != null && qrFields?.amount
    && !amountsMatch(qrFields.amount, extracted.amount)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'amount',
      `Amount error: screenshot shows ${extracted.amount} but the official Dashen Bank record shows ${qrFields.amount}. The receipt appears edited.`,
      { screenshotValue: extracted.amount, qrValue: qrFields.amount }));
  }

  for (const [field, label] of [
    ['senderName', 'Sender name'],
    ['receiverName', 'Receiver name'],
  ]) {
    const shotVal = extracted?.[field];
    const truthVal = qrFields?.[field];
    if (shotVal && truthVal && !namesMatch(shotVal, truthVal)) {
      issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', field,
        `${label} error: screenshot shows "${shotVal}" but the official Dashen Bank record shows "${truthVal}". The receipt appears edited.`,
        { screenshotValue: shotVal, qrValue: truthVal }));
    }
  }
}

function validateBoaOfficialReceipt({
  issues,
  extracted,
  qrFields,
  qrAuthentic,
  qrFound,
  screenshotCropped,
  geminiUsed,
  boaResolve,
}) {
  const hasQrTruth = Boolean(qrFields?.boaQrDecrypted);
  const hasApiTruth = Boolean(qrFields?.boaApiSource && boaResolve?.official);
  const hasTruth = hasQrTruth || hasApiTruth;
  const truthLabel = hasApiTruth
    ? 'official Bank of Abyssinia record'
    : 'QR code';

  if (boaResolve?.screenshotEdited && boaResolve?.official) {
    const shotTx = normalizeTxCode(extracted?.transactionCode);
    const officialTx = normalizeTxCode(boaResolve.official.transactionCode);
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Payment ID error: screenshot shows "${shotTx}" but the official Bank of Abyssinia record is "${officialTx}". The receipt appears edited.`,
      { screenshotValue: shotTx, qrValue: officialTx }));
  }

  if (!qrFound || !qrAuthentic) return;
  if (!geminiUsed) return;

  if (hasTruth) {
    if (!screenshotCropped) {
      const fraudFields = [
        ['transactionCode', extracted?.transactionCode, qrFields?.transactionCode, 'Payment ID'],
        ['amount', extracted?.amount, qrFields?.amount, 'Amount'],
        ['receiverName', extracted?.receiverName, qrFields?.receiverName, 'Receiver name'],
      ];
      for (const [field, shotVal, truthVal, label] of fraudFields) {
        if (shotVal == null || shotVal === '' || !truthVal) continue;
        const mismatch = fieldMismatch(
          field,
          label,
          field === 'amount' ? String(shotVal) : shotVal,
          field === 'amount' ? String(truthVal) : truthVal,
          'screenshot',
          truthLabel,
        );
        if (mismatch) {
          issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', field,
            `${label} error: screenshot shows "${shotVal}" but the ${truthLabel} shows "${truthVal}". The receipt appears edited.`,
            { screenshotValue: shotVal, qrValue: truthVal }));
        }
      }
    }
    return;
  }

  if (!screenshotCropped) {
    issues.push(issue('error', 'BOA_VERIFY_FAILED', 'transactionCode',
      'Could not verify this Bank of Abyssinia receipt. Screenshot payment ID, amount, and receiver name must match the official QR code — the receipt may be edited or invalid.'));
  }
}

function validateFormAgainstScreenshot({ issues, form, extracted }) {
  const pairs = [
    ['transactionCode', 'Payment ID'],
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
  ];

  for (const [field, label] of pairs) {
    const formVal = form[field];
    const shotVal = field === 'transactionCode' ? extracted?.transactionCode : extracted?.[field];
    if (!formVal || shotVal == null || shotVal === '') continue;
    const mismatch = fieldMismatch(
      field,
      label,
      field === 'amount' ? String(formVal) : formVal,
      field === 'amount' ? String(shotVal) : shotVal,
      'your entry',
      'screenshot',
    );
    if (mismatch) issues.push(mismatch);
  }
}

export function validateReceiptSubmission({
  method,
  form,
  extracted,
  qrData,
  geminiUsed = true,
  geminiError = null,
  withDetails = true,
  expectedReceiver = null,
  qrFields: providedQrFields = null,
  boaResolve = null,
  telebirrResolve = null,
}) {
  const issues = [];
  const isTopUp = Boolean(expectedReceiver);

  if (!isSupportedMethod(method)) {
    issues.push(issue('error', 'METHOD_INVALID', 'method',
      `Payment method must be one of: ${['Telebirr', 'CBE', 'Bank of Abyssinia', 'Dashen Bank'].join(', ')}.`));
  }

  const requiredFields = [
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
    ['transactionCode', 'Payment / transaction ID'],
  ];

  if (withDetails && !isTopUp) {
    for (const [field, label] of requiredFields) {
      if (!String(form[field] || '').trim()) {
        issues.push(issue('error', 'FIELD_REQUIRED', field, `${label} is required.`));
      }
    }
  }

  const qrFields = providedQrFields || extractQrReceiptFields(method, qrData);
  const formTx = normalizeTxCode(form.transactionCode);
  const screenshotTx = normalizeTxCode(extracted?.transactionCode);
  const qrTx = normalizeTxCode(qrFields.transactionCode || qrData?.transactionCode);
  const qrFound = Boolean(qrData?.raw);
  const qrAuthenticity = qrFound ? analyzeQrAuthenticity(method, qrData.raw) : null;
  const qrAuthentic = Boolean(qrAuthenticity?.authentic);

  const screenshotCropped = detectScreenshotCropped({
    extracted,
    qrTx,
    screenshotTx,
    qrAuthentic,
    qrFields,
  });

  if (requiresQrCode(method)) {
  if (method === 'telebirr') {
    const telebirrOfficial = Boolean(qrFields?.telebirrApiSource);
    const telebirrScreenshotInvoice = extractTelebirrInvoiceFromExtracted(extracted);

    if (!telebirrOfficial && !qrFound && !telebirrScreenshotInvoice) {
      issues.push(issue('error', 'QR_MISSING', 'screenshot', getQrMissingMessage(method), { qrValue: null }));
    } else if (telebirrOfficial) {
      // Official Telebirr record loaded — QR/OCR optional
    } else if (qrFound && qrAuthenticity && !qrAuthenticity.authentic) {
      const fakeIssue = buildFakeQrIssue(qrAuthenticity, method);
      issues.push(issue('error', fakeIssue.code, fakeIssue.field, fakeIssue.message, { qrFormat: qrAuthenticity.format }));
    } else if (!telebirrOfficial && qrFound && !qrTx && !telebirrScreenshotInvoice) {
      issues.push(issue('error', 'QR_UNREADABLE', 'transactionCode',
        'Could not read the Telebirr Invoice No. from your screenshot. Make sure the full receipt is visible with the Invoice No. text readable — QR code is optional.',
        { qrValue: null }));
    }
  } else if (!qrFound) {
    if (!(method === 'dashen' && qrFields?.dashenApiSource)) {
      issues.push(issue('error', 'QR_MISSING', 'screenshot', getQrMissingMessage(method), { qrValue: null }));
    }
  } else if (qrAuthenticity && !qrAuthenticity.authentic) {
      const fakeIssue = buildFakeQrIssue(qrAuthenticity, method);
      issues.push(issue('error', fakeIssue.code, fakeIssue.field, fakeIssue.message, { qrFormat: qrAuthenticity.format }));
    }
  }

  if (!screenshotCropped && qrTx && screenshotTx && txCodesConflict(qrTx, screenshotTx)
    && !(method === 'telebirr' && qrFields?.telebirrApiSource)
    && !(method === 'boa' && qrFields?.boaApiSource)
    && !(method === 'dashen' && (qrFields?.dashenApiSource || qrFields?.dashenSuperAppSource))) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Payment ID error: screenshot shows "${screenshotTx}" but the QR code shows "${qrTx}".`,
      { screenshotValue: screenshotTx, qrValue: qrTx }));
  }

  if (method === 'boa') {
    validateBoaOfficialReceipt({
      issues,
      extracted,
      qrFields,
      qrAuthentic,
      qrFound,
      screenshotCropped,
      geminiUsed,
      boaResolve,
    });
  } else if (method === 'telebirr') {
    validateTelebirrReceipt({
      issues,
      extracted,
      qrFields,
      qrFound,
      qrAuthentic,
      screenshotCropped,
      geminiUsed,
      telebirrResolve,
    });
  } else if (method === 'cbe') {
    validateCbeOfficialReceipt({
      issues,
      extracted,
      qrFields,
      qrFound,
      qrAuthentic,
      screenshotCropped,
      geminiUsed,
    });
  } else if (method === 'dashen') {
    validateDashenReceipt({
      issues,
      extracted,
      qrFields,
      qrFound,
      qrAuthentic,
      screenshotCropped,
      geminiUsed,
    });
  } else if (!screenshotCropped && geminiUsed && qrAuthentic && hasOfficialQrTruth(qrFields)) {
    const truthLabel = hasOfficialQrTruth(qrFields)
      ? ({
        telebirr: 'official Telebirr record',
        cbe: 'official CBE record',
        dashen: 'official Dashen Bank record',
      }[method] || 'QR code')
      : 'QR code';
    validateScreenshotAgainstTruth({ issues, extracted, qrFields, truthLabel });
  }

  if (method === 'telebirr' && qrFields?.telebirrApiSource && !qrFound) {
    issues.push(issue('warning', 'TELEBIRR_OFFICIAL_VERIFIED', null,
      'Verified via official Telebirr record using Invoice No. from your screenshot.'));
  }

  if (method === 'telebirr' && qrFound && qrAuthentic && !qrFields?.telebirrApiSource && !screenshotCropped) {
    issues.push(issue('warning', 'TELEBIRR_VERIFY_PARTIAL', null,
      'Could not load the official Telebirr receipt page. Verification used the signed QR code and screenshot text only.'));
  }

  const qrVerifiedWithForm = withDetails && !isTopUp && isQrTrustworthyForMethod(method, {
    authenticity: qrAuthenticity,
    transactionCode: qrTx,
    formTx,
    screenshotTx: screenshotCropped ? null : screenshotTx,
  });

  if (isTopUp) {
    validateTopUpReceiver({
      issues,
      method,
      expectedReceiver,
      extracted,
      qrFields,
      screenshotCropped,
      geminiUsed,
    });

    const qrAmount = parseFloat(qrFields.amount);
    const shotAmount = parseFloat(extracted?.amount);
    const topUpAmount = qrAmount || shotAmount;

    if (!topUpAmount || topUpAmount <= 0) {
      issues.push(issue('error', 'AMOUNT_UNREADABLE', 'amount',
        screenshotCropped
          ? 'Amount error: could not read amount from QR code. Upload a clearer screenshot with the QR code visible.'
          : 'Amount error: could not read amount from QR code or screenshot.'));
    } else if (!screenshotCropped && qrFields.amount && extracted?.amount != null
      && !topUpAmountsCompatible(qrFields.amount, extracted.amount)) {
      issues.push(issue('error', 'AMOUNT_QR_SCREENSHOT_MISMATCH', 'amount',
        `Amount error: screenshot shows ${extracted.amount} but QR code shows ${qrFields.amount}.`,
        { screenshotValue: extracted.amount, qrValue: qrFields.amount }));
    }
  } else if (withDetails) {
    if (screenshotCropped) {
      validateFormAgainstQr({ issues, form, qrFields, method });
      if (qrAuthentic) {
        issues.push(issue('warning', 'SCREENSHOT_CROPPED', null,
          'Receipt text appears cut off. Verification used your entered details and the QR code only.'));
      }
    } else {
      validateFormAgainstScreenshot({ issues, form, extracted });
      validateFormAgainstQr({ issues, form, qrFields, method });

      if (qrTx && screenshotTx && formTx && !allTxCodesMatch(formTx, screenshotTx, qrTx)
        && !(method === 'dashen' && qrFields?.dashenSuperAppSource)) {
        issues.push(issue('error', 'TX_CODE_MISMATCH', 'transactionCode',
          `Payment ID error: form "${formTx}", screenshot "${screenshotTx}", and QR "${qrTx}" do not all match.`,
          { formValue: formTx, screenshotValue: screenshotTx, qrValue: qrTx }));
      }

    if (qrVerifiedWithForm) {
      issues.push(issue('warning', 'QR_VERIFIED', 'transactionCode',
        method === 'telebirr'
          ? `QR code verified — payment ID ${formTx || qrTx} matches your form.`
          : `Official ${getMethodLabel(method)} QR verified — payment ID ${formTx} matches the receipt.`));

      if (!screenshotCropped && geminiUsed) {
        const partial = ['transactionCode', 'senderName', 'senderAccount', 'receiverName', 'receiverAccount', 'amount']
          .some((field) => {
            const fv = field === 'transactionCode' ? form[field] : form[field];
            const sv = field === 'transactionCode' ? extracted?.transactionCode : extracted?.[field];
            if (!fv || sv == null || sv === '') return false;
            return fieldMismatch(field, field, fv, sv, 'your entry', 'screenshot');
          });
        if (partial) {
          issues.push(issue('warning', 'SCREENSHOT_TEXT_PARTIAL', null,
            'Some receipt text was unclear, but verification passed using your form and the QR code.'));
        }
      }
    }
    }
  } else {
    if (screenshotCropped) {
      if (qrAuthentic) {
        const cropMsg = qrFields?.telebirrApiSource
          ? 'Receipt text appears cut off. Transaction details were loaded from the official Telebirr receipt.'
          : qrFields?.cbeApiSource
          ? 'Receipt text appears cut off. Transaction details were loaded from the official CBE QR code.'
          : qrFields?.dashenApiSource
            ? 'Receipt text appears cut off. Transaction details were loaded from the official Dashen Bank receipt.'
            : qrFields?.dashenSuperAppSource
              ? 'Receipt text appears cut off. Verification used the official Dashen Super App QR code only.'
              : qrFields?.boaApiSource
              ? 'Receipt text appears cut off. Transaction details were loaded from the official Bank of Abyssinia QR code.'
              : qrFields?.boaQrDecrypted
                ? 'Receipt text appears cut off. Transaction details were loaded from the official Bank of Abyssinia QR code.'
              : `Receipt text appears cut off. Verification used the official ${getMethodLabel(method)} QR code only.`;
        issues.push(issue('warning', 'SCREENSHOT_CROPPED', null, cropMsg));
      }
      const amt = parseFloat(qrFields.amount);
      if (!amt || amt <= 0) {
        issues.push(issue('error', 'AMOUNT_UNREADABLE', 'amount',
          method === 'telebirr' && qrFields?.telebirrApiSource
            ? 'Amount error: could not read amount from the official Telebirr record.'
            : 'Amount error: could not read amount from QR code. Upload a clearer screenshot with the full QR code visible.'));
      }
    } else if (geminiUsed) {
      if (method === 'boa') {
        // validateBoaOfficialReceipt handles non-cropped BOA cross-check
      }

      const amt = parseFloat(qrFields.amount) || parseFloat(extracted?.amount);
      if (!amt || amt <= 0) {
        issues.push(issue('error', 'AMOUNT_UNREADABLE', 'amount',
          'Amount error: could not read amount from screenshot or QR code.'));
      }
    } else if (!geminiUsed) {
      issues.push(issue('warning', 'AI_UNAVAILABLE', null,
        `${geminiError || 'AI screenshot reading was unavailable.'} QR code was still checked.`));
    }
  }

  if (!isTopUp && !withDetails && !screenshotCropped && !geminiUsed) {
    issues.push(issue('warning', 'AI_UNAVAILABLE', null,
      `${geminiError || 'AI screenshot reading was unavailable.'} QR code was still checked.`));
  }

  if ((qrAuthentic || qrFields?.telebirrApiSource) && !isTopUp
    && !(method === 'boa' && !qrFields?.boaApiSource && !qrFields?.boaQrDecrypted)
    && !(method === 'telebirr' && !qrFields?.telebirrApiSource && !qrAuthentic)) {
    issues.push(issue('warning', 'QR_VERIFIED', 'transactionCode',
      `Official ${getMethodLabel(method)} QR code verified — not fake.`));
  }

  const txCode = (method === 'boa' && (qrFields?.boaApiSource || qrFields?.boaQrDecrypted) && qrFields?.transactionCode)
    ? qrFields.transactionCode
    : (qrTx || screenshotTx || (withDetails ? formTx : null));
  if (!txCode && !(isTopUp && qrAuthentic && method === 'cbe' && qrData?.verificationToken)
    && !(qrAuthentic && method === 'dashen' && (qrFields?.dashenApiSource || qrFields?.dashenSuperAppSource || qrData?.dashenReceiptToken))) {
    issues.push(issue('error', 'TX_CODE_INVALID', 'transactionCode',
      withDetails
        ? 'Payment ID error: could not determine a valid payment ID from your form, screenshot, or QR code.'
        : 'Payment ID error: could not read payment ID from screenshot or QR code.'));
  }

  const preferQr = screenshotCropped || isTopUp || (
    !extracted?.senderName && Boolean(qrFields?.senderName)
  ) || qrFields?.telebirrApiSource || qrFields?.cbeApiSource || qrFields?.dashenApiSource || qrFields?.dashenSuperAppSource || qrFields?.boaApiSource || qrFields?.boaQrDecrypted;
  const merged = mergeReceiptSources({
    extracted,
    qrFields,
    form: withDetails ? form : {},
    preferQr,
  });

  const qrAmountVal = parseFloat(qrFields.amount);
  const shotAmountVal = parseFloat(extracted?.amount);

  const resolvedDetails = isTopUp
    ? {
        senderName: merged.senderName || extracted?.senderName || '',
        senderAccount: merged.senderAccount || extracted?.senderAccount || '',
        receiverName: expectedReceiver.receiverName,
        receiverAccount: expectedReceiver.receiverAccount,
        amount: String(qrAmountVal || shotAmountVal || ''),
        transactionCode: txCode || qrData?.verificationToken || '',
      }
    : withDetails
      ? {
          senderName: form.senderName || merged.senderName || '',
          senderAccount: form.senderAccount || merged.senderAccount || '',
          receiverName: form.receiverName || merged.receiverName || '',
          receiverAccount: form.receiverAccount || merged.receiverAccount || '',
          amount: form.amount != null ? String(form.amount) : (merged.amount || ''),
          transactionCode: txCode || '',
        }
      : {
          senderName: merged.senderName || '',
          senderAccount: merged.senderAccount || '',
          receiverName: merged.receiverName || '',
          receiverAccount: merged.receiverAccount || '',
          amount: merged.amount || '',
          transactionCode: txCode || qrData?.verificationToken || '',
        };

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  const hasFraud = errors.some((i) => i.code === 'FRAUD_EDITED_RECEIPT');
  const filteredErrors = hasFraud
    ? errors.filter((i) => !['TX_FORM_QR_MISMATCH', 'TX_CODE_MISMATCH', 'TX_FORM_SCREENSHOT_MISMATCH'].includes(i.code))
    : errors;

  return {
    passed: filteredErrors.length === 0,
    txCode: txCode || (method === 'cbe' ? qrData?.verificationToken : null),
    issues,
    errors: filteredErrors.map((i) => i.message),
    warnings: warnings.map((i) => i.message),
    extracted,
    qrData,
    qrFields,
    qrAuthenticity,
    geminiUsed,
    withDetails,
    screenshotCropped,
    resolvedDetails,
  };
}
