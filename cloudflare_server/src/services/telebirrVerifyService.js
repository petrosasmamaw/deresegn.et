import fs from 'fs/promises';
import {
  extractTelebirrOcrFromBuffer,
  isGeminiQuotaBlocked,
} from './geminiService.js';
import {
  buildQrDataFromRaw,
  decodeQrFromBuffer,
} from './qrService.js';
import { isWorkersRuntime } from '../config/runtime.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { extractTelebirrInvoiceFromPayload } from './qrService.js';
import {
  mergeTelebirrApiIntoQrFields,
  fetchTelebirrReceipt,
  normalizeTelebirrInvoiceId,
} from './telebirrReceiptService.js';
import { extractTelebirrInvoiceFromExtracted } from '../utils/telebirrInvoice.js';

/** QR is backup only — skip heavy Jimp if OCR already has Invoice No. */
const QR_BACKUP_MS = isWorkersRuntime()
  ? Number(process.env.TELEBIRR_QR_BUDGET_MS) || 2000
  : Number(process.env.TELEBIRR_QR_BUDGET_MS) || 800;

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
 * Telebirr screenshot: OCR Invoice/Transaction No. → official Petros lookup.
 * QR starts in parallel with OCR so classic invoice screens stay fast when OCR
 * is slow/misses; Transaction Detail screens (no QR) still rely on OCR alone.
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

  // Kick off QR decode immediately — cancelled/ignored if OCR finds the invoice.
  const qrPromise = decodeQrFromBuffer(buffer, { maxMs: QR_BACKUP_MS }).catch((err) => {
    console.warn('[Telebirr] QR backup error:', err.message);
    return buildQrDataFromRaw(null);
  });

  const ocr = isGeminiQuotaBlocked()
    ? { ...EMPTY_EXTRACTED }
    : await extractTelebirrOcrFromBuffer(buffer, mime);

  let extracted = { ...EMPTY_EXTRACTED, ...ocr };
  // Normalize negative amounts from "Transaction Detail" screens (-50.00 ETB).
  if (extracted.amount != null) {
    const n = Math.abs(parseFloat(extracted.amount));
    extracted.amount = Number.isFinite(n) && n > 0 ? n : extracted.amount;
  }

  let invoice = extractTelebirrInvoiceFromExtracted(extracted);
  let source = invoice ? 'ocr' : null;
  let qrData = buildQrDataFromRaw(null);
  let geminiUsed = Boolean(invoice);
  let geminiError = isGeminiQuotaBlocked()
    ? 'Gemini quota exceeded — verified via QR and official Telebirr lookup only'
    : null;

  if (!invoice) {
    qrData = await qrPromise;
    invoice = resolveQrInvoice(qrData);
    source = invoice ? 'qr' : null;
  } else {
    // OCR already won — don't block on QR; still attach if it finishes quickly.
    qrData = await Promise.race([
      qrPromise,
      new Promise((resolve) => setTimeout(() => resolve(buildQrDataFromRaw(null)), 50)),
    ]);
  }

  let officialHit = await officialFromInvoice(invoice, source || 'fast');

  // If OCR invoice was wrong/stale and official miss, try QR invoice once.
  if (!officialHit && source === 'ocr') {
    qrData = await qrPromise;
    const qrInvoice = resolveQrInvoice(qrData);
    if (qrInvoice && qrInvoice !== invoice) {
      officialHit = await officialFromInvoice(qrInvoice, 'qr');
      if (officialHit) {
        invoice = qrInvoice;
        source = 'qr';
      }
    }
  }

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
