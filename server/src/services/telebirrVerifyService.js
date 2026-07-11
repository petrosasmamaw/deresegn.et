import fs from 'fs/promises';
import {
  extractPaymentFromBuffer,
  extractTelebirrInvoiceFromBuffer,
  isGeminiQuotaBlocked,
} from './geminiService.js';
import {
  buildQrDataFromRaw,
  prepareQrScanImage,
  scanImageForQrValidated,
  decodeQrFromBuffer,
} from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { analyzeQrAuthenticity } from './qrAuthenticityService.js';
import { extractTelebirrInvoiceFromPayload } from './qrService.js';
import {
  resolveTelebirrOfficialReceipt,
  mergeTelebirrApiIntoQrFields,
  fetchTelebirrReceipt,
  normalizeTelebirrInvoiceId,
} from './telebirrReceiptService.js';
import { extractTelebirrInvoiceFromExtracted } from '../utils/telebirrInvoice.js';
import { prepareOcrBuffer } from '../utils/prepareOcrBuffer.js';

const QR_BUDGET_MS = 6000;

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};

function isTelebirrQrPayload(raw) {
  if (!raw) return false;
  if (analyzeQrAuthenticity('telebirr', raw).authentic) return true;
  return Boolean(extractTelebirrInvoiceFromPayload(raw));
}

function resolveQrInvoice(qr) {
  return normalizeTelebirrInvoiceId(
    extractTelebirrInvoiceFromPayload(qr?.raw) || qr?.transactionCode,
  );
}

async function officialFromInvoice(invoiceId, source) {
  if (!invoiceId) return null;
  const official = await fetchTelebirrReceipt(invoiceId);
  return official ? { invoiceId, official, source } : null;
}

function buildExtractedFromOfficial(hit) {
  return {
    ...EMPTY_EXTRACTED,
    transactionCode: hit.invoiceId,
    amount: Number(hit.official.amount) || null,
    senderName: hit.official.senderName,
    senderAccount: hit.official.senderAccount,
    receiverName: hit.official.receiverName,
    receiverAccount: hit.official.receiverAccount,
  };
}

/** Full Telebirr QR scan — validated payloads only. */
async function decodeTelebirrQrFromBuffer(buffer, { maxMs = QR_BUDGET_MS, preparedImage = null } = {}) {
  const prepared = preparedImage || await prepareQrScanImage(buffer);
  const deadline = Date.now() + maxMs;
  const shouldStop = () => Date.now() >= deadline;

  const quick = await decodeQrFromBuffer(buffer, { maxMs: Math.min(maxMs, 4000), image: prepared });
  const quickInvoice = resolveQrInvoice(quick);
  if (quickInvoice) {
    console.log('[Telebirr] QR decoded (generic):', quickInvoice);
    return quick;
  }

  try {
    const h = prepared.bitmap.height;
    const w = prepared.bitmap.width;
    for (const cut of [0.3, 0.45, 0.55, 0.65]) {
      if (shouldStop()) break;
      const y = Math.floor(h * cut);
      const crops = [
        prepared.clone().crop({ x: 0, y, w, h: h - y }).scale(3),
        prepared.clone().crop({ x: 0, y, w, h: h - y }).greyscale().invert().scale(4),
        prepared.clone().crop({ x: 0, y, w, h: h - y }).scale(5),
      ];
      for (const variant of crops) {
        if (shouldStop()) break;
        const raw = scanImageForQrValidated(variant, shouldStop, isTelebirrQrPayload);
        if (raw) {
          const invoice = extractTelebirrInvoiceFromPayload(raw);
          console.log('[Telebirr] QR decoded (focused):', invoice || 'payload found');
          return buildQrDataFromRaw(raw);
        }
      }
    }
  } catch (err) {
    console.warn('[Telebirr] QR scan error:', err.message);
  }

  if (quick?.raw && isTelebirrQrPayload(quick.raw)) {
    console.log('[Telebirr] QR decoded (unvalidated payload)');
    return quick;
  }

  return buildQrDataFromRaw(null);
}

/**
 * Telebirr verify — QR + official lookup first (no Gemini required).
 * Gemini 2.5 Flash-Lite only when QR/OCR cannot read the invoice.
 */
export async function verifyTelebirrReceipt({ buffer, mime = 'image/jpeg', screenshotPath }) {
  if (!buffer && screenshotPath) {
    buffer = await fs.readFile(screenshotPath);
  }
  if (!buffer?.length) {
    throw new Error('Telebirr verification requires a screenshot buffer');
  }

  const started = Date.now();
  const preparedInput = await prepareOcrBuffer(buffer, mime);
  buffer = preparedInput.buffer;
  mime = preparedInput.mime;
  console.log('[Telebirr] verify', buffer.length, 'bytes', mime);

  const prepared = await prepareQrScanImage(buffer);

  let qrData = await decodeTelebirrQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS, preparedImage: prepared });
  let officialHit = await officialFromInvoice(resolveQrInvoice(qrData), 'qr');

  let geminiUsed = false;
  let geminiError = null;
  let extracted = officialHit
    ? buildExtractedFromOfficial(officialHit)
    : { ...EMPTY_EXTRACTED };

  if (!officialHit && !isGeminiQuotaBlocked()) {
    const focusedInvoice = await extractTelebirrInvoiceFromBuffer(buffer, mime);
    if (focusedInvoice) {
      officialHit = await officialFromInvoice(focusedInvoice, 'focused');
      if (officialHit) {
        extracted = buildExtractedFromOfficial(officialHit);
      }
    }
  }

  if (!officialHit && !isGeminiQuotaBlocked()) {
    try {
      geminiUsed = true;
      const data = await extractPaymentFromBuffer(buffer, 'telebirr', mime);
      extracted = data;
      const geminiInvoice = extractTelebirrInvoiceFromExtracted(data);
      officialHit = await officialFromInvoice(geminiInvoice, 'screenshot');
    } catch (err) {
      geminiError = err.message;
      geminiUsed = false;
      console.warn('[Gemini]', geminiError);
    }
  } else if (!officialHit && isGeminiQuotaBlocked()) {
    geminiError = 'Gemini quota exceeded — verified via QR and official Telebirr lookup only';
    console.warn('[Gemini]', geminiError);
  }

  if (!officialHit && !resolveQrInvoice(qrData)) {
    const retryQr = await decodeTelebirrQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS, preparedImage: prepared });
    if (resolveQrInvoice(retryQr)) {
      qrData = retryQr;
      officialHit = await officialFromInvoice(resolveQrInvoice(retryQr), 'qr');
      if (officialHit) {
        extracted = buildExtractedFromOfficial(officialHit);
      }
    }
  }

  let qrFields = extractQrReceiptFields('telebirr', qrData);
  let telebirrOfficial = officialHit?.official || null;
  let telebirrResolve = null;

  if (telebirrOfficial) {
    qrFields = mergeTelebirrApiIntoQrFields(qrFields, telebirrOfficial);
    if (!extracted.transactionCode) {
      extracted = buildExtractedFromOfficial(officialHit);
    }
    telebirrResolve = {
      official: telebirrOfficial,
      matchedInvoice: telebirrOfficial.transactionCode,
      qrInvoice: resolveQrInvoice(qrData),
      screenshotInvoice: extractTelebirrInvoiceFromExtracted(extracted),
      qrMisread: false,
      screenshotEdited: Boolean(
        extractTelebirrInvoiceFromExtracted(extracted)
        && extractTelebirrInvoiceFromExtracted(extracted) !== telebirrOfficial.transactionCode,
      ),
      verifiedVia: officialHit.source === 'qr'
        ? 'qr_invoice'
        : officialHit.source === 'focused'
          ? 'screenshot_invoice'
          : 'screenshot_invoice',
    };
    console.log('[Telebirr] Official record:', telebirrOfficial.transactionCode,
      'via', officialHit.source, 'amount', telebirrOfficial.amount);
  } else {
    telebirrResolve = await resolveTelebirrOfficialReceipt({ qrData, extracted });
    if (telebirrResolve?.official) {
      telebirrOfficial = telebirrResolve.official;
      qrFields = mergeTelebirrApiIntoQrFields(qrFields, telebirrOfficial);
      extracted = buildExtractedFromOfficial({
        invoiceId: telebirrOfficial.transactionCode,
        official: telebirrOfficial,
        source: telebirrResolve.verifiedVia,
      });
      console.log('[Telebirr] Official record:', telebirrOfficial.transactionCode,
        'amount', telebirrOfficial.amount);
    } else {
      const scanned = telebirrResolve?.qrInvoice || telebirrResolve?.screenshotInvoice;
      if (scanned) {
        console.warn('[Telebirr] No official record for invoice:', scanned);
      } else if (qrData?.raw) {
        console.warn('[Telebirr] QR found but invoice ID could not be resolved');
      } else {
        console.warn('[Telebirr] No invoice ID for official lookup');
      }
    }
  }

  console.log('[Telebirr] done in', Date.now() - started, 'ms');

  return {
    extracted,
    geminiUsed,
    geminiError,
    qrData,
    qrFields,
    telebirrResolve,
    telebirrOfficial,
    invoiceId: telebirrResolve?.matchedInvoice
      || telebirrResolve?.qrInvoice
      || telebirrResolve?.screenshotInvoice
      || extractTelebirrInvoiceFromExtracted(extracted),
  };
}

export { decodeTelebirrQrFromBuffer };
