import fs from 'fs/promises';
import {
  extractTelebirrOcrFromBuffer,
  isGeminiQuotaBlocked,
} from './geminiService.js';
import {
  buildQrDataFromRaw,
  decodeQrFromBuffer,
} from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { extractTelebirrInvoiceFromPayload } from './qrService.js';
import {
  mergeTelebirrApiIntoQrFields,
  fetchTelebirrReceipt,
  normalizeTelebirrInvoiceId,
} from './telebirrReceiptService.js';
import { extractTelebirrInvoiceFromExtracted } from '../utils/telebirrInvoice.js';

/** QR is backup only — skip heavy Jimp if OCR already has Invoice No. */
const QR_BACKUP_MS = Number(process.env.TELEBIRR_QR_BUDGET_MS) || 800;

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};

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

/**
 * Telebirr screenshot: OCR Invoice No. → official Petros lookup (same as payment ID).
 * QR is only used if OCR misses the invoice. No sequential Gemini fallbacks.
 */
export async function verifyTelebirrReceipt({ buffer, mime = 'image/jpeg', screenshotPath }) {
  if (!buffer && screenshotPath) {
    buffer = await fs.readFile(screenshotPath);
  }
  if (!buffer?.length) {
    throw new Error('Telebirr verification requires a screenshot buffer');
  }

  const started = Date.now();
  console.log('[Telebirr] verify', buffer.length, 'bytes', mime);

  const ocr = isGeminiQuotaBlocked()
    ? { ...EMPTY_EXTRACTED }
    : await extractTelebirrOcrFromBuffer(buffer, mime);

  let extracted = { ...EMPTY_EXTRACTED, ...ocr };
  let invoice = extractTelebirrInvoiceFromExtracted(extracted);
  let source = invoice ? 'ocr' : null;
  let qrData = buildQrDataFromRaw(null);
  let geminiUsed = Boolean(invoice);
  let geminiError = isGeminiQuotaBlocked()
    ? 'Gemini quota exceeded — verified via QR and official Telebirr lookup only'
    : null;

  if (!invoice) {
    qrData = await decodeQrFromBuffer(buffer, { maxMs: QR_BACKUP_MS }).catch((err) => {
      console.warn('[Telebirr] QR backup error:', err.message);
      return buildQrDataFromRaw(null);
    });
    invoice = resolveQrInvoice(qrData);
    source = invoice ? 'qr' : null;
  }

  let officialHit = await officialFromInvoice(invoice, source || 'fast');

  let qrFields = extractQrReceiptFields('telebirr', qrData);
  let telebirrOfficial = officialHit?.official || null;
  let telebirrResolve = null;

  if (telebirrOfficial) {
    qrFields = mergeTelebirrApiIntoQrFields(qrFields, telebirrOfficial);
    if (!extracted.transactionCode) {
      extracted.transactionCode = telebirrOfficial.transactionCode;
    }
    const shotInvoice = extractTelebirrInvoiceFromExtracted(extracted);
    telebirrResolve = {
      official: telebirrOfficial,
      matchedInvoice: telebirrOfficial.transactionCode,
      qrInvoice: resolveQrInvoice(qrData),
      screenshotInvoice: shotInvoice,
      qrMisread: false,
      screenshotEdited: Boolean(
        shotInvoice && shotInvoice !== telebirrOfficial.transactionCode,
      ),
      verifiedVia: officialHit.source === 'qr' ? 'qr_invoice' : 'screenshot_invoice',
    };
    console.log(
      '[Telebirr] Official record:',
      telebirrOfficial.transactionCode,
      'via',
      officialHit.source,
      'amount',
      telebirrOfficial.amount,
    );
  } else {
    const scanned = invoice;
    if (scanned) {
      console.warn('[Telebirr] No official record for invoice:', scanned);
    } else {
      console.warn('[Telebirr] No invoice ID for official lookup');
    }
    telebirrResolve = {
      official: null,
      matchedInvoice: null,
      qrInvoice: resolveQrInvoice(qrData),
      screenshotInvoice: extractTelebirrInvoiceFromExtracted(extracted),
      qrMisread: false,
      screenshotEdited: false,
      verifiedVia: null,
    };
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

export { decodeQrFromBuffer as decodeTelebirrQrFromBuffer };
