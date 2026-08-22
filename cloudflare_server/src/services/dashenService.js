/**
 * Unified Dashen Bank verification — success screen + VAT receipt.
 * Inspired by https://github.com/NahomAl/ethiobank_receipts/blob/main/ethiobank_receipts/extractors/dashen.py
 * Fast path: parallel QR scan + Gemini OCR; VAT falls back to official PDF by IPSS reference.
 */
import fs from 'fs/promises';
import {
  parseQrPayload,
  decodeQrFromBuffer,
  buildQrDataFromRaw,
  prepareQrScanImage,
  scanBitmapForData,
} from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { analyzeQrAuthenticity } from './qrAuthenticityService.js';
import { extractPaymentFromBuffer } from './geminiService.js';
import { normalizeTxCode } from '../utils/txCode.js';
import { outboundFetch, BANK_FETCH_TIMEOUT_MS, BANK_FETCH_RETRIES } from '../utils/outboundFetch.js';

const RECEIPT_BASE = 'https://receipt.dashensuperapp.com/receipt';
const DASHEN_REF_RE = /\b(\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i;
const QR_BUDGET_MS = 9000;
const QR_FAST_MS = 2500;
const SUCCESS_QR_MS = 5000;
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
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const textResult = await parser.getText();
    const text = String(textResult.text || '');
    return parseDashenPdfPythonStyle(text)
      || parseDashenPdfRegex(text)
      || parseDashenPdfLines(text);
  } finally {
    await parser.destroy();
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
        timeoutMs: PDF_TIMEOUT_MS,
        retries: BANK_FETCH_RETRIES,
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
  const raw = scanBitmapForData(image.bitmap);
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


/** VAT receipts — tiny QR at bottom center; zoom bottom bands aggressively. */
function scanDashenVatBottomQr(prepared, maxMs = 8000, { quick = false } = {}) {
  const deadline = Date.now() + maxMs;
  const expired = () => Date.now() >= deadline;
  const base = prepareImage(prepared);
  const { width, height } = base.bitmap;

  const bands = quick
    ? [
      { y: 0.74, h: 0.24, x: 0.22, w: 0.56 },
      { y: 0.78, h: 0.18, x: 0.30, w: 0.40 },
      { y: 0.82, h: 0.14, x: 0.34, w: 0.32 },
    ]
    : [
      { y: 0.66, h: 0.34, x: 0.12, w: 0.76 },
      { y: 0.70, h: 0.28, x: 0.18, w: 0.64 },
      { y: 0.74, h: 0.24, x: 0.22, w: 0.56 },
      { y: 0.77, h: 0.20, x: 0.28, w: 0.44 },
      { y: 0.80, h: 0.16, x: 0.32, w: 0.36 },
      { y: 0.83, h: 0.13, x: 0.36, w: 0.28 },
    ];
  const scales = quick ? [5, 8, 10] : [4, 5, 6, 8, 10, 12, 14];

  for (const band of bands) {
    if (expired()) break;
    const crop = base.clone().crop({
      x: Math.floor(width * band.x),
      y: Math.floor(height * band.y),
      w: Math.max(48, Math.floor(width * band.w)),
      h: Math.max(48, Math.floor(height * band.h)),
    });
    for (const scale of scales) {
      if (expired()) break;
      for (const variant of [
        crop.clone().scale(scale),
        crop.clone().greyscale().scale(scale),
        crop.clone().greyscale().invert().scale(scale),
        crop.clone().greyscale().contrast(0.35).scale(scale),
      ]) {
        if (expired()) break;
        const hit = tryVariant(variant, 'any');
        if (hit) {
          console.log('[Dashen] QR decoded (VAT bottom)');
          return hit;
        }
      }
    }
  }
  return null;
}

/** Success screen — QR is larger and centered on tall mobile screenshots. */
function scanDashenSuccessQr(prepared, maxMs = 8000) {
  const deadline = Date.now() + maxMs;
  const expired = () => Date.now() >= deadline;
  const base = prepareImage(prepared);
  const { width, height } = base.bitmap;
  const midY = Math.floor(height * 0.30);
  const midH = Math.floor(height * 0.50);

  const variants = [
    base,
    base.clone().scale(2),
    base.clone().scale(3),
    base.clone().greyscale().scale(2),
    base.clone().greyscale().invert().scale(3),
    base.clone().crop({ x: 0, y: midY, w: width, h: midH }).scale(3),
    base.clone().crop({ x: Math.floor(width * 0.08), y: midY, w: Math.floor(width * 0.84), h: midH }).scale(4),
    base.clone().crop({ x: Math.floor(width * 0.08), y: midY, w: Math.floor(width * 0.84), h: midH }).greyscale().invert().scale(4),
  ];

  for (const variant of variants) {
    if (expired()) break;
    const hit = tryVariant(variant, 'success');
    if (hit) {
      console.log('[Dashen] QR decoded (success)');
      return hit;
    }
  }
  return null;
}

/** Fast QR-only pass — full image + scale, no heavy crop loop. */
function scanDashenQrFast(image, deadline) {
  const expired = () => Date.now() >= deadline;
  const base = prepareImage(image);
  const { width, height } = base.bitmap;
  const qrCrop = height / width < 0.75;

  const variants = [
    base,
    base.clone().scale(2),
    base.clone().scale(3),
    base.clone().greyscale().scale(2),
    base.clone().greyscale().invert().scale(2),
  ];

  if (qrCrop) {
    for (const scale of [3, 4, 5]) {
      variants.push(base.clone().scale(scale));
      variants.push(base.clone().greyscale().invert().scale(scale));
    }
  } else {
    const bottomY = Math.floor(height * 0.5);
    variants.push(
      base.clone().crop({ x: 0, y: bottomY, w: width, h: height - bottomY }).scale(3),
      base.clone().crop({ x: 0, y: bottomY, w: width, h: height - bottomY }).greyscale().invert().scale(4),
    );
  }

  for (const variant of variants) {
    if (expired()) break;
    const hit = tryVariant(variant, 'any');
    if (hit) return hit;
  }
  return null;
}

/**
 * Dashen QR decode — generic decoder first (success screen), then targeted crops.
 * Runs in parallel with Gemini/OCR like Telebirr.
 */
async function decodeDashenQrFromBuffer(buffer, { maxMs = QR_BUDGET_MS, preparedImage = null } = {}) {
  const deadline = Date.now() + maxMs;
  const remaining = () => Math.max(0, deadline - Date.now());

  try {
    const prepared = preparedImage || await prepareQrScanImage(buffer);

    const immediate = tryVariant(prepared, 'any');
    if (immediate) {
      console.log('[Dashen] QR decoded (immediate)');
      return immediate;
    }

    const genericBudget = Math.min(8000, maxMs);
    const generic = await decodeQrFromBuffer(buffer, { maxMs: genericBudget, image: prepared });
    if (generic?.raw && isAcceptedDashenQrPayload(generic.raw)) {
      console.log('[Dashen] QR decoded (generic)');
      return buildQrResult(generic.raw, { successScreen: isDashenSuperAppReceiptToken(generic.raw) });
    }

    const left = remaining();
    if (left < 1500) return buildQrDataFromRaw(null);

    const fastBudget = Math.min(QR_FAST_MS, left);
    if (fastBudget >= 1200) {
      const fastHit = scanDashenQrFast(prepared, Date.now() + fastBudget);
      if (fastHit) {
        console.log('[Dashen] QR decoded (fast)');
        return fastHit;
      }
    }

    const cropBudget = remaining();
    if (cropBudget >= 1500) {
      const half = Math.floor(cropBudget / 2);
      const [successQr, vatQr] = await Promise.all([
        Promise.resolve(scanDashenSuccessQr(prepared, Math.min(half, SUCCESS_QR_MS))),
        Promise.resolve(scanDashenVatBottomQr(prepared, Math.min(half, 4000), { quick: true })),
      ]);
      if (successQr?.raw) return successQr;
      if (vatQr?.raw) return vatQr;
    }
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

function enrichSuccessFields(qrData, qrFields) {
  if (!isDashenSuperAppReceiptToken(qrData?.raw)) return qrFields;

  return {
    ...qrFields,
    transactionCode: qrFields.transactionCode || qrData?.dashenReceiptToken || qrData?.verificationToken || null,
    dashenSuperAppSource: true,
  };
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
 * Main Dashen pipeline — QR + OCR + official PDF all in parallel (Telebirr-style).
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

  const preparedPromise = prepareQrScanImage(buffer);

  const geminiPromise = extractPaymentFromBuffer(buffer, 'dashen', mime)
    .then((data) => ({ data, used: true }))
    .catch((err) => ({ data: { ...EMPTY_EXTRACTED }, used: false, error: err.message }));

  const qrPromise = preparedPromise.then(async (prepared) => {
    const ipss = await geminiPromise.then(
      (outcome) => extractDashenReferenceFromText(outcome.data?.transactionCode),
    );
    if (ipss) return buildQrDataFromRaw(null);
    return decodeDashenQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS, preparedImage: prepared });
  });

  const screenshotPrefetchPromise = geminiPromise.then(async (outcome) => {
    const ref = extractDashenReferenceFromText(outcome.data?.transactionCode);
    if (!ref) return null;
    const official = await fetchDashenTransactionByReference(ref);
    return official ? { ref, official } : null;
  });

  const qrPrefetchPromise = qrPromise.then(async (qrData) => {
    if (isDashenSuperAppReceiptToken(qrData?.raw)) return null;
    const ref = extractDashenReferenceFromQr(qrData);
    if (!ref) return null;
    const official = await fetchDashenTransactionByReference(ref);
    return official ? { ref, official } : null;
  });

  const fullPipelinePromise = Promise.all([
    geminiPromise,
    qrPromise,
    screenshotPrefetchPromise,
    qrPrefetchPromise,
  ]).then(([geminiOutcome, qrDataRaw, screenshotPrefetch, qrPrefetch]) => ({
    geminiOutcome,
    qrDataRaw,
    screenshotPrefetch,
    qrPrefetch,
  }));

  const outcome = await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    qrPromise.then(async (qrDataRaw) => {
      if (!isDashenSuperAppReceiptToken(qrDataRaw?.raw)) return;
      const geminiOutcome = await Promise.race([
        geminiPromise,
        new Promise((r) => setTimeout(
          () => r({ data: { ...EMPTY_EXTRACTED }, used: false }),
          SUPERAPP_OCR_GRACE_MS,
        )),
      ]);
      finish({
        geminiOutcome,
        qrDataRaw,
        screenshotPrefetch: null,
        qrPrefetch: null,
      });
    });

    screenshotPrefetchPromise.then(async (prefetch) => {
      if (!prefetch?.official) return;
      const geminiOutcome = await geminiPromise;
      const ipss = extractDashenReferenceFromText(geminiOutcome.data?.transactionCode);
      if (!ipss) return;
      finish({
        geminiOutcome,
        qrDataRaw: buildOfficialFallbackQr(ipss, prefetch.official),
        screenshotPrefetch: prefetch,
        qrPrefetch: null,
      });
    });

    fullPipelinePromise.then(finish);
  });

  const { geminiOutcome, qrDataRaw, screenshotPrefetch, qrPrefetch } = outcome;

  const extracted = geminiOutcome.data;
  const geminiUsed = geminiOutcome.used;
  const geminiError = geminiOutcome.error || null;
  if (geminiError) console.warn('[Gemini]', geminiError);

  const ipssFromText = extractDashenReferenceFromText(extracted?.transactionCode);
  let qrData = qrDataRaw;
  let officialFields = screenshotPrefetch?.official || qrPrefetch?.official || null;

  if (!qrData?.raw && officialFields && ipssFromText) {
    qrData = buildOfficialFallbackQr(ipssFromText, officialFields);
    console.log('[Dashen] Verified via official PDF:', ipssFromText, `(${Date.now() - started}ms)`);
  } else if (!qrData?.raw && !officialFields) {
    const receiptType = detectDashenReceiptType(extracted, qrData);
    console.warn('[Dashen] QR not found', receiptType === 'vat_receipt' ? '(VAT)' : '(success screen)');
  }

  const receiptType = detectDashenReceiptType(extracted, qrData);
  let qrFields = extractQrReceiptFields('dashen', qrData);

  if (isDashenSuperAppReceiptToken(qrData?.raw)) {
    qrFields = enrichSuccessFields(qrData, qrFields);
    console.log('[Dashen] Success token verified:', qrData.dashenReceiptToken?.slice(0, 40));
  } else if (officialFields) {
    qrFields = mergeDashenOfficialFields(qrFields, officialFields);
    if (qrData?.officialReceiptFallback) {
      console.log('[Dashen] Official PDF fields merged:', officialFields.transactionCode);
    }
  }

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
