/**
 * Unified Dashen Bank verification — success screen + VAT receipt.
 * Inspired by https://github.com/NahomAl/ethiobank_receipts/blob/main/ethiobank_receipts/extractors/dashen.py
 * Fast path: parallel QR scan + Gemini OCR; VAT falls back to official PDF by IPSS reference.
 */
import fs from 'fs/promises';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import { PDFParse } from 'pdf-parse';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import { parseQrPayload, decodeQrFromBuffer, buildQrDataFromRaw } from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { analyzeQrAuthenticity } from './qrAuthenticityService.js';
import { extractPaymentFromBuffer } from './geminiService.js';
import { normalizeTxCode } from '../utils/txCode.js';

const RECEIPT_BASE = 'https://receipt.dashensuperapp.com/receipt';
const DASHEN_REF_RE = /\b(\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i;
const QR_BUDGET_MS = 15000;
const QR_RETRY_MS = 8000;

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
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

  return {
    transactionCode: normalizeTxCode(txRef),
    amount: String(amount),
    senderName: rawFields.sender_name || null,
    senderAccount: rawFields.sender_account_number || rawFields.sender_account || null,
    receiverName: rawFields.receiver_name || null,
    receiverAccount: rawFields.receiver_account_number || rawFields.receiver_account || null,
    source: 'dashen_official_pdf',
  };
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
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const textResult = await parser.getText();
    const text = String(textResult.text || '');
    return parseDashenPdfRegex(text) || parseDashenPdfLines(text);
  } finally {
    await parser.destroy();
  }
}

export async function fetchDashenTransactionByReference(reference) {
  const ref = normalizeTxCode(reference);
  if (!ref) return null;

  const url = `${RECEIPT_BASE}/${ref}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/pdf,*/*',
      },
    });
    clearTimeout(timer);

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
  }
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

function scanJsQr(bitmap) {
  const { data, width, height } = bitmap;
  const hit = jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
  return hit?.data || null;
}

function scanZxing(bitmap) {
  const { data, width, height } = bitmap;
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    luminance[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }
  const source = new RGBLuminanceSource(luminance, width, height);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  try {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(source))).getText();
  } catch {
    return null;
  }
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

function tryVariant(image, mode, useZxing) {
  const raw = scanJsQr(image.bitmap) || (useZxing ? scanZxing(image.bitmap) : null);
  return acceptRaw(raw, mode);
}

function prepareImage(image) {
  const { width, height } = image.bitmap;
  const minDim = Math.min(width, height);
  if (minDim < 500) {
    return image.clone().scale(Math.min(2.5, 500 / minDim));
  }
  return image;
}

/**
 * QR scan — generic decoder first (~7s on most uploads), then crop variants for hard cases.
 */
async function scanDashenQr(buffer, maxMs = QR_BUDGET_MS, { aggressive = false } = {}) {
  const started = Date.now();
  const deadline = started + maxMs;
  const expired = () => Date.now() >= deadline;
  const remaining = () => Math.max(0, deadline - Date.now());

  try {
    const genericBudget = Math.min(aggressive ? 12000 : 10000, maxMs - 2000);
    if (genericBudget >= 3000) {
      const generic = await decodeQrFromBuffer(buffer, { maxMs: genericBudget });
      if (generic?.raw && isAcceptedDashenQrPayload(generic.raw)) {
        console.log('[Dashen] QR decoded (generic)');
        return buildQrResult(generic.raw, { successScreen: isDashenSuperAppReceiptToken(generic.raw) });
      }
    }

    const base = prepareImage(await Jimp.read(buffer));
    const { width, height } = base.bitmap;

    const fullScales = aggressive ? [2, 3] : [2];
    for (const scale of fullScales) {
      if (expired()) break;
      for (const variant of [
        base.clone().greyscale().invert().scale(scale),
        base.clone().greyscale().scale(scale),
        base.clone().scale(scale),
      ]) {
        if (expired()) break;
        const hit = tryVariant(variant, 'any', true);
        if (hit) {
          console.log('[Dashen] QR decoded (full image crop)');
          return hit;
        }
      }
    }

    const regions = [
      { x: 0, y: Math.floor(height * 0.45), w: width, h: height - Math.floor(height * 0.45) },
      { x: Math.floor(width * 0.1), y: Math.floor(height * 0.55), w: Math.floor(width * 0.8), h: Math.floor(height * 0.4) },
      { x: Math.floor(width * 0.15), y: Math.floor(height * 0.55), w: Math.floor(width * 0.7), h: Math.floor(height * 0.38) },
    ];

    for (const region of regions) {
      if (expired() || region.h < 40 || region.w < 40) continue;
      const crop = base.clone().crop(region);

      for (const scale of [2, 3, aggressive ? 4 : 3]) {
        if (expired()) break;
        for (const variant of [
          crop.clone().greyscale().invert().scale(scale),
          crop.clone().greyscale().scale(scale),
          crop.clone().scale(scale),
        ]) {
          if (expired()) break;
          const hit = tryVariant(variant, 'any', true);
          if (hit) {
            console.log('[Dashen] QR decoded (region)');
            return hit;
          }
        }
      }
    }

    const left = remaining();
    if (left >= 3000) {
      const retry = await decodeQrFromBuffer(buffer, { maxMs: left });
      if (retry?.raw && isAcceptedDashenQrPayload(retry.raw)) {
        console.log('[Dashen] QR decoded (generic retry)');
        return buildQrResult(retry.raw, { successScreen: isDashenSuperAppReceiptToken(retry.raw) });
      }
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
 * Main Dashen pipeline — parallel QR + Gemini, PDF fallback for VAT, crop-aware.
 */
export async function verifyDashenReceipt({ buffer, mime = 'image/jpeg', screenshotPath }) {
  if (!buffer && screenshotPath) {
    buffer = await fs.readFile(screenshotPath);
  }
  if (!buffer?.length) {
    throw new Error('Dashen verification requires a screenshot buffer');
  }

  console.log('[Dashen] verify', buffer.length, 'bytes', mime);

  const geminiPromise = extractPaymentFromBuffer(buffer, 'dashen', mime)
    .then((data) => ({ data, used: true }))
    .catch((err) => ({ data: { ...EMPTY_EXTRACTED }, used: false, error: err.message }));

  const qrPromise = scanDashenQr(buffer, QR_BUDGET_MS);

  let [qrData, geminiOutcome] = await Promise.all([qrPromise, geminiPromise]);
  const extracted = geminiOutcome.data;
  const geminiUsed = geminiOutcome.used;
  const geminiError = geminiOutcome.error || null;

  if (geminiError) console.warn('[Gemini]', geminiError);

  const receiptType = detectDashenReceiptType(extracted, qrData);
  let officialFields = qrData?.officialFields || null;

  const ipssRef = extractDashenReferenceFromQr(qrData)
    || extractDashenReferenceFromText(extracted?.transactionCode);

  if (!isDashenSuperAppReceiptToken(qrData?.raw) && ipssRef) {
    if (!officialFields) {
      officialFields = await fetchDashenTransactionByReference(ipssRef);
    }
    if (officialFields) {
      if (!qrData?.raw) {
        qrData = buildOfficialFallbackQr(ipssRef, officialFields);
        console.log('[Dashen] Verified via official PDF:', ipssRef);
      }
    }
  }

  if (!qrData?.raw) {
    const retry = await scanDashenQr(buffer, QR_RETRY_MS, { aggressive: true });
    if (retry?.raw) qrData = retry;
    else console.warn('[Dashen] QR not found', receiptType === 'vat_receipt' ? '(VAT)' : '(success screen)');
  }

  let qrFields = extractQrReceiptFields('dashen', qrData);

  if (isDashenSuperAppReceiptToken(qrData?.raw)) {
    qrFields = enrichSuccessFields(qrData, qrFields);
    console.log('[Dashen] Success token verified:', qrData.dashenReceiptToken?.slice(0, 40));
  } else if (officialFields) {
    qrFields = mergeDashenOfficialFields(qrFields, officialFields);
  } else if (qrData?.raw) {
    const ref = extractDashenReferenceFromQr(qrData);
    if (ref) {
      const fetched = await fetchDashenTransactionByReference(ref);
      if (fetched) qrFields = mergeDashenOfficialFields(qrFields, fetched);
    }
  }

  return {
    extracted,
    geminiUsed,
    geminiError,
    qrData,
    qrFields,
    receiptType,
  };
}
