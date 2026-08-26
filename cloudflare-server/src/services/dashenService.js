/**
 * Unified Dashen Bank verification — success screen + VAT receipt.
 * Inspired by https://github.com/NahomAl/ethiobank_receipts/blob/main/ethiobank_receipts/extractors/dashen.py
 * Fast path: parallel QR scan + Gemini OCR; VAT falls back to official PDF by IPSS reference.
 */
import fs from 'fs/promises';
import {
  parseQrPayload,
  buildQrDataFromRaw,
  prepareQrScanImage,
  scanImageForQrValidated,
} from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { analyzeQrAuthenticity } from './qrAuthenticityService.js';
import { extractPaymentFromBuffer } from './geminiService.js';
import { normalizeTxCode } from '../utils/txCode.js';
import { isWorkersRuntime } from '../config/runtime.js';
import { outboundFetch, BANK_FETCH_TIMEOUT_MS, BANK_FETCH_RETRIES } from '../utils/outboundFetch.js';

const RECEIPT_BASE = 'https://receipt.dashensuperapp.com/receipt';
const DASHEN_REF_RE = /\b(\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i;
const QR_BUDGET_MS = isWorkersRuntime() ? 3500 : 9000;
const DASHEN_PDF_TIMEOUT_MS = isWorkersRuntime() ? 5000 : 6000;
const PDF_TIMEOUT_MS = BANK_FETCH_TIMEOUT_MS;
const SUPERAPP_OCR_GRACE_MS = 800;

const inflightPdfFetches = new Map();

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};

/** Python ethiobank_receipts field patterns — https://github.com/NahomAl/ethiobank_receipts/blob/main/ethiobank_receipts/extractors/dashen.py */
const PDF_PYTHON_RES = {
  account_holder_names: /Account Holder Name:\s*(.+?)(?:\n|$)/gi,
  account_numbers: /Account Number:\s*([0-9*]+)/gi,
  transfer_reference: /Transfer Reference:\s*(.+?)(?:\n|$)/i,
  transaction_ref: /Transaction Ref:\s*(.+?)(?:\n|$)/i,
  amount: /Transaction Amount\s*([\d,.]+)\s*ETB/i,
  total: /Total\s*([\d,.]+)\s*ETB/i,
};

/** Python-style PDF field patterns (flat text fallback). */
const PDF_FIELD_RES = {
  sender_name: /Sender Name:\s*(.+?)(?:\n|$)/i,
  sender_account: /Sender Account(?: Number)?:\s*([0-9*]+)/i,
  receiver_name: /Receiver Name:\s*(.+?)(?:\n|$)/i,
  receiver_account: /Receiver Account(?: Number)?:\s*([0-9*]+)/i,
  transaction_reference: /Transaction Reference:\s*([A-Z0-9]+)/i,
  transfer_reference: /Transfer Reference:\s*([A-Z0-9]+)/i,
  transaction_date: /Transaction Date:\s*(.+?)(?:\n|$)/i,
  amount: /Transaction Amount\s+ETB\s+([\d,.]+)/i,
  total: /Total\s+ETB\s+([\d,.]+)/i,
};

export function isDashenSuperAppReceiptToken(value) {
  return /^superappreceipt_/i.test(String(value || '').trim());
}

export function isAcceptedDashenQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length < 16 || text === '{}' || text === '[]') return false;
  if (/^superappreceipt_/i.test(text)) return true;
  if (/receipt\.dashensuperapp\.com/i.test(text)) return true;
  if (DASHEN_REF_RE.test(text)) return true;
  return analyzeQrAuthenticity('dashen', text).authentic;
}

export function extractDashenReferenceFromText(...parts) {
  for (const part of parts) {
    if (!part) continue;
    const match = String(part).match(DASHEN_REF_RE);
    if (match?.[1]) return normalizeTxCode(match[1]);
  }
  return null;
}

export function extractDashenReferenceFromQr(qrData) {
  const raw = String(qrData?.raw || '').trim();
  if (!raw) return null;

  const urlMatch = raw.match(/receipt\.dashensuperapp\.com\/receipt\/([A-Z0-9]+)/i);
  if (urlMatch?.[1] && !urlMatch[1].startsWith('superappreceipt')) {
    return normalizeTxCode(urlMatch[1]);
  }

  const refMatch = raw.match(DASHEN_REF_RE);
  if (refMatch?.[1]) return normalizeTxCode(refMatch[1]);

  return normalizeTxCode(qrData?.dashenReference);
}

function parseAmount(value) {
  if (!value) return null;
  const n = parseFloat(String(value).replace(/ETB/gi, '').replace(/,/g, '').trim());
  return Number.isNaN(n) || n < 0 ? null : n;
}

function mapPdfFields(rawFields) {
  const txRef = rawFields.transaction_reference || rawFields.transaction_ref;
  const amount = parseAmount(rawFields.transaction_amount || rawFields.amount);
  if (!txRef || amount == null) return null;
  const total = parseAmount(rawFields.total);

  return {
    transactionCode: normalizeTxCode(txRef),
    amount: String(amount),
    total: total != null ? String(total) : null,
    senderName: rawFields.sender_name || null,
    senderAccount: rawFields.sender_account_number || rawFields.sender_account || null,
    receiverName: rawFields.receiver_name || null,
    receiverAccount: rawFields.receiver_account_number || rawFields.receiver_account || null,
    source: 'dashen_official_pdf',
  };
}

function parseDashenPdfPythonStyle(text) {
  const blob = String(text || '');
  const holderNames = [...blob.matchAll(PDF_PYTHON_RES.account_holder_names)].map((m) => m[1].trim());
  const accountNumbers = [...blob.matchAll(PDF_PYTHON_RES.account_numbers)].map((m) => m[1].trim());

  const senderName = blob.match(/Sender Name:\s*(.+?)(?:\n|$)/i)?.[1]?.trim()
    || holderNames[0] || null;
  const receiverName = blob.match(/Receiver Name:\s*(.+?)(?:\n|$)/i)?.[1]?.trim()
    || holderNames[1] || null;
  const senderAccount = blob.match(/Sender Account(?: Number)?:\s*([0-9*]+)/i)?.[1]?.trim()
    || accountNumbers[0] || null;
  const receiverAccount = blob.match(/Receiver Account(?: Number)?:\s*([0-9*]+)/i)?.[1]?.trim()
    || accountNumbers[1] || null;

  const txRef = blob.match(PDF_PYTHON_RES.transaction_ref)?.[1]?.trim()
    || blob.match(PDF_FIELD_RES.transaction_reference)?.[1]?.trim()
    || blob.match(PDF_PYTHON_RES.transfer_reference)?.[1]?.trim()
    || blob.match(PDF_FIELD_RES.transfer_reference)?.[1]?.trim();

  const amountRaw = blob.match(PDF_PYTHON_RES.amount)?.[1]
    || blob.match(PDF_PYTHON_RES.total)?.[1]
    || blob.match(PDF_FIELD_RES.amount)?.[1];

  const totalRaw = blob.match(PDF_PYTHON_RES.total)?.[1]
    || blob.match(PDF_FIELD_RES.total)?.[1];

  return mapPdfFields({
    transaction_reference: txRef,
    sender_name: senderName,
    sender_account: senderAccount,
    receiver_name: receiverName,
    receiver_account: receiverAccount,
    amount: amountRaw,
    total: totalRaw,
  });
}

function parseDashenPdfRegex(text) {
  const fields = {};
  for (const [key, re] of Object.entries(PDF_FIELD_RES)) {
    const m = text.match(re);
    if (m?.[1]) fields[key] = m[1].trim();
  }
  return mapPdfFields({
    transaction_reference: fields.transaction_reference,
    sender_name: fields.sender_name,
    sender_account: fields.sender_account,
    receiver_name: fields.receiver_name,
    receiver_account: fields.receiver_account,
    amount: fields.amount,
    total: fields.total,
  });
}

function parseDashenPdfLines(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fields = {};
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const tabAmount = line.match(/^Transaction Amount\s+ETB\s+([\d,.]+)$/i);
    if (tabAmount) {
      fields.amount = tabAmount[1];
      continue;
    }
    if (line === 'Transaction Amount' && lines[i + 1]?.startsWith('ETB')) {
      fields.amount = lines[i + 1].replace(/^ETB\s*/i, '').trim();
      i += 1;
      continue;
    }
    const inline = line.match(/^([A-Za-z][^:]{2,40}):\s*(.+)$/);
    if (inline) {
      const key = inline[1].trim().toLowerCase().replace(/\s+/g, '_');
      fields[key] = inline[2].trim();
    }
  }
  return mapPdfFields({
    transaction_reference: fields.transaction_reference,
    sender_name: fields.sender_name,
    sender_account_number: fields.sender_account_number,
    receiver_name: fields.receiver_name,
    receiver_account_number: fields.receiver_account_number,
    transaction_amount: fields.amount,
  });
}

export async function parseDashenPdfBuffer(pdfBuffer) {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: pdfBuffer });
    try {
      const textResult = await parser.getText();
      const text = String(textResult.text || '');
      return parseDashenPdfPythonStyle(text)
        || parseDashenPdfRegex(text)
        || parseDashenPdfLines(text);
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  } catch (err) {
    console.warn('[Dashen] PDF parse error:', err.message);
    return null;
  }
}

export async function fetchDashenTransactionByReference(reference) {
  const ref = normalizeTxCode(reference);
  if (!ref) return null;

  if (inflightPdfFetches.has(ref)) {
    return inflightPdfFetches.get(ref);
  }

  const fetchPromise = (async () => {
    const url = `${RECEIPT_BASE}/${ref}`;
    try {
      const response = await outboundFetch(url, {
        timeoutMs: DASHEN_PDF_TIMEOUT_MS,
        retries: isWorkersRuntime() ? 0 : 1,
        headers: { Accept: 'application/pdf,*/*' },
      });

      if (!response.ok) {
        console.warn('[Dashen] PDF HTTP', response.status, ref);
        return null;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.slice(0, 4).toString() !== '%PDF') {
        console.warn('[Dashen] Non-PDF response for', ref);
        return null;
      }

      return parseDashenPdfBuffer(buffer);
    } catch (err) {
      console.warn('[Dashen] PDF fetch failed:', err.message);
      return null;
    } finally {
      inflightPdfFetches.delete(ref);
    }
  })();

  inflightPdfFetches.set(ref, fetchPromise);
  return fetchPromise;
}

function buildQrResult(raw, { successScreen = false } = {}) {
  const parsed = parseQrPayload(raw);
  return {
    raw,
    transactionCode: parsed.transactionCode,
    verificationUrl: parsed.verificationUrl,
    verificationToken: parsed.verificationToken,
    dashenReference: parsed.dashenReference,
    dashenReceiptToken: parsed.dashenReceiptToken,
    decodedPayload: raw,
    dashenSuccessScreen: successScreen || isDashenSuperAppReceiptToken(raw),
  };
}

function buildOfficialFallbackQr(reference, officialFields) {
  const url = `${RECEIPT_BASE}/${reference}`;
  return {
    raw: url,
    transactionCode: reference,
    verificationUrl: url,
    verificationToken: null,
    dashenReference: reference,
    dashenReceiptToken: null,
    decodedPayload: url,
    officialReceiptFallback: true,
    officialFields,
  };
}

function tryVariant(image, mode) {
  const deadline = Date.now() + QR_BUDGET_MS;
  const raw = scanImageForQrValidated(
    image,
    () => Date.now() >= deadline,
    (payload) => Boolean(acceptRaw(payload, mode)),
  );
  return acceptRaw(raw, mode);
}

function acceptRaw(raw, mode) {
  if (!raw || !isAcceptedDashenQrPayload(raw)) return null;
  if (mode === 'success') {
    if (isDashenSuperAppReceiptToken(raw) || /receipt\.dashensuperapp\.com/i.test(raw)) {
      return buildQrResult(raw, { successScreen: true });
    }
    return null;
  }
  if (mode === 'vat') {
    if (DASHEN_REF_RE.test(raw) || /receipt\.dashensuperapp\.com/i.test(raw)) {
      return buildQrResult(raw);
    }
    return null;
  }
  if (isDashenSuperAppReceiptToken(raw) || /receipt\.dashensuperapp\.com/i.test(raw)) {
    return buildQrResult(raw, { successScreen: isDashenSuperAppReceiptToken(raw) });
  }
  if (DASHEN_REF_RE.test(raw)) return buildQrResult(raw);
  return null;
}

function prepareImage(image) {
  const { width, height } = image.bitmap;
  const minDim = Math.min(width, height);
  if (minDim < 500) {
    return image.clone().scale(Math.min(2.5, 500 / minDim));
  }
  return image;
}


/** VAT receipts — QR at bottom center. */
function scanDashenVatBottomQr(prepared) {
  if (!prepared?.bitmap) return null;
  const hit = tryVariant(prepared, 'vat');
  if (hit) return hit;

  const { width, height } = prepared.bitmap;
  const bottomY = Math.floor(height * 0.55);
  const bottomH = height - bottomY;
  const bottomCrop = prepared.crop({ x: 0, y: bottomY, w: width, h: bottomH });
  return tryVariant(bottomCrop, 'vat');
}

/** Success screen — QR centered on tall mobile screenshots. */
function scanDashenSuccessQr(prepared) {
  if (!prepared?.bitmap) return null;
  const hit = tryVariant(prepared, 'success');
  if (hit) return hit;

  const { width, height } = prepared.bitmap;
  const midY = Math.floor(height * 0.20);
  const midH = Math.floor(height * 0.60);
  const midCrop = prepared.crop({ x: 0, y: midY, w: width, h: midH });
  return tryVariant(midCrop, 'success');
}

/**
 * Dashen QR decode — full variant scan (success screen + VAT crops).
 */
async function decodeDashenQrFromBuffer(buffer, { maxMs = QR_BUDGET_MS, preparedImage = null } = {}) {
  try {
    const prepared = preparedImage || await prepareQrScanImage(buffer);
    if (!prepared) return buildQrDataFromRaw(null);

    const deadline = Date.now() + maxMs;
    const shouldStop = () => Date.now() >= deadline;

    const immediate = tryVariant(prepared, 'any');
    if (immediate) {
      console.log('[Dashen] QR decoded (immediate)');
      return immediate;
    }

    if (shouldStop()) return buildQrDataFromRaw(null);

    const hitSuccess = scanDashenSuccessQr(prepared);
    if (hitSuccess) return hitSuccess;

    if (shouldStop()) return buildQrDataFromRaw(null);

    const hitVat = scanDashenVatBottomQr(prepared);
    if (hitVat) return hitVat;
  } catch (err) {
    console.warn('[Dashen] QR scan error:', err.message);
  }

  return buildQrDataFromRaw(null);
}

export function detectDashenReceiptType(extracted, qrData) {
  if (isDashenSuperAppReceiptToken(qrData?.raw)) return 'success_screen';
  if (extractDashenReferenceFromText(extracted?.transactionCode)) return 'vat_receipt';
  if (qrData?.dashenReference && !isDashenSuperAppReceiptToken(qrData?.raw)) return 'vat_receipt';
  if (extracted?.transactionCode && DASHEN_REF_RE.test(extracted.transactionCode)) return 'vat_receipt';
  if (extracted?.amount && !extracted?.transactionCode) return 'success_screen';
  return null;
}

function enrichOcrFallbackFields(qrData, qrFields, extracted, reference) {
  const amount = extracted?.amount != null ? String(extracted.amount) : qrFields.amount;
  return {
    ...qrFields,
    transactionCode: reference || qrFields.transactionCode,
    amount: amount || qrFields.amount,
    senderName: extracted?.senderName || qrFields.senderName,
    senderAccount: extracted?.senderAccount || qrFields.senderAccount,
    receiverName: extracted?.receiverName || qrFields.receiverName,
    receiverAccount: extracted?.receiverAccount || qrFields.receiverAccount,
    dashenOcrSource: true,
  };
}

function enrichSuccessFields(qrData, qrFields, extracted = null) {
  if (!isDashenSuperAppReceiptToken(qrData?.raw)) return qrFields;

  const enriched = {
    ...qrFields,
    transactionCode: qrFields.transactionCode || qrData?.dashenReceiptToken || qrData?.verificationToken || null,
    dashenSuperAppSource: true,
  };
  if (!enriched.amount && extracted?.amount != null) {
    enriched.amount = String(extracted.amount);
  }
  return enriched;
}

export function mergeDashenOfficialFields(qrFields, official) {
  if (!official) return qrFields;
  return {
    ...qrFields,
    transactionCode: official.transactionCode || qrFields.transactionCode,
    amount: official.amount || qrFields.amount,
    senderName: official.senderName || qrFields.senderName,
    senderAccount: official.senderAccount || qrFields.senderAccount,
    receiverName: official.receiverName || qrFields.receiverName,
    receiverAccount: official.receiverAccount || qrFields.receiverAccount,
    dashenApiSource: true,
  };
}

/**
 * Main Dashen pipeline — QR + OCR + official PDF all in parallel.
 */
export async function verifyDashenReceipt({ buffer, mime = 'image/jpeg', screenshotPath }) {
  if (!buffer && screenshotPath) {
    buffer = await fs.readFile(screenshotPath);
  }
  if (!buffer?.length) {
    throw new Error('Dashen verification requires a screenshot buffer');
  }

  const started = Date.now();
  console.log('[Dashen] verify', buffer.length, 'bytes', mime);

  let geminiUsed = false;
  let geminiError = null;

  const qrPromise = decodeDashenQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS });
  const geminiPromise = extractPaymentFromBuffer(buffer, 'dashen', mime)
    .then((data) => ({ data, used: true }))
    .catch((err) => ({ data: { ...EMPTY_EXTRACTED }, used: false, error: err.message }));

  const [qrDataRaw, geminiOutcome] = await Promise.all([qrPromise, geminiPromise]);

  let qrData = qrDataRaw;
  const extracted = geminiOutcome.data;
  geminiUsed = geminiOutcome.used;
  geminiError = geminiOutcome.error || null;
  if (geminiError) console.warn('[Gemini]', geminiError);

  const refFromQr = extractDashenReferenceFromQr(qrData);
  const refFromText = extractDashenReferenceFromText(extracted?.transactionCode);
  const officialRef = refFromQr || refFromText;

  let officialFields = null;
  if (officialRef && !isDashenSuperAppReceiptToken(qrData?.raw)) {
    officialFields = await fetchDashenTransactionByReference(officialRef);
  }

  if (officialFields && !qrData?.raw) {
    qrData = buildOfficialFallbackQr(officialRef, officialFields);
  } else if (!qrData?.raw && refFromText && extracted?.amount != null) {
    qrData = buildOfficialFallbackQr(refFromText, {
      transactionCode: refFromText,
      amount: String(extracted.amount),
    });
  }

  let qrFields = extractQrReceiptFields('dashen', qrData);
  if (isDashenSuperAppReceiptToken(qrData?.raw)) {
    qrFields = enrichSuccessFields(qrData, qrFields, extracted);
  } else if (officialFields) {
    qrFields = mergeDashenOfficialFields(qrFields, officialFields);
    if (qrData?.officialReceiptFallback) {
      console.log('[Dashen] Official PDF fields merged:', officialFields.transactionCode);
    }
  } else if (!officialFields && refFromText && extracted?.amount != null) {
    qrFields = enrichOcrFallbackFields(qrData, qrFields, extracted, refFromText);
    console.log('[Dashen] OCR fallback fields:', refFromText, extracted.amount);
  }

  const receiptType = detectDashenReceiptType(extracted, qrData);
  console.log('[Dashen] done in', Date.now() - started, 'ms');
  return {
    extracted,
    geminiUsed,
    geminiError,
    qrData,
    qrFields,
    receiptType,
  };
}
