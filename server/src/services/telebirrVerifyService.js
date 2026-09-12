import fs from 'fs/promises';
import {
  extractTelebirrOcrFromBuffer,
  isGeminiQuotaBlocked,
} from './geminiService.js';
import { prepareOcrBuffer } from '../utils/prepareOcrBuffer.js';
import { buildQrDataFromRaw } from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import {
  mergeTelebirrApiIntoQrFields,
  fetchTelebirrReceipt,
} from './telebirrReceiptService.js';
import { extractTelebirrInvoiceFromExtracted } from '../utils/telebirrInvoice.js';

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};

/**
 * Telebirr screenshot (fast path): OCR Invoice/Transaction No. → official API.
 * No QR scan — payment ID from OCR only, then display official API result.
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

  const qrData = buildQrDataFromRaw(null);
  let geminiUsed = false;
  let geminiError = isGeminiQuotaBlocked()
    ? 'Gemini quota exceeded — cannot read Telebirr invoice from screenshot'
    : null;

  let extracted = { ...EMPTY_EXTRACTED };

  if (!isGeminiQuotaBlocked()) {
    try {
      const { buffer: ocrBuffer, mime: ocrMime } = await prepareOcrBuffer(buffer, mime);
      const ocr = await extractTelebirrOcrFromBuffer(ocrBuffer, ocrMime, { skipOcrPrep: true });
      extracted = { ...EMPTY_EXTRACTED, ...ocr };
      geminiUsed = Boolean(ocr?.transactionCode || ocr?.amount);
    } catch (err) {
      geminiError = err.message;
      console.warn('[Telebirr] OCR error:', err.message);
    }
  }

  if (extracted.amount != null) {
    const n = Math.abs(parseFloat(extracted.amount));
    extracted.amount = Number.isFinite(n) && n > 0 ? n : extracted.amount;
  }

  const invoice = extractTelebirrInvoiceFromExtracted(extracted);
  let telebirrOfficial = null;
  let telebirrResolve = null;
  let qrFields = extractQrReceiptFields('telebirr', qrData);

  if (invoice) {
    telebirrOfficial = await fetchTelebirrReceipt(invoice);
  }

  if (telebirrOfficial) {
    qrFields = mergeTelebirrApiIntoQrFields(qrFields, telebirrOfficial);
    if (!extracted.transactionCode) {
      extracted.transactionCode = telebirrOfficial.transactionCode;
    }
    const shotInvoice = extractTelebirrInvoiceFromExtracted(extracted);
    telebirrResolve = {
      official: telebirrOfficial,
      matchedInvoice: telebirrOfficial.transactionCode,
      qrInvoice: null,
      screenshotInvoice: shotInvoice,
      qrMisread: false,
      screenshotEdited: Boolean(
        shotInvoice && shotInvoice !== telebirrOfficial.transactionCode,
      ),
      verifiedVia: 'screenshot_invoice',
    };
    console.log(
      '[Telebirr] Official record:',
      telebirrOfficial.transactionCode,
      'via ocr',
      'amount',
      telebirrOfficial.amount,
    );
  } else {
    if (invoice) {
      console.warn('[Telebirr] No official record for invoice:', invoice);
    } else {
      console.warn('[Telebirr] No invoice ID for official lookup');
    }
    telebirrResolve = {
      official: null,
      matchedInvoice: null,
      qrInvoice: null,
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
      || telebirrResolve?.screenshotInvoice
      || extractTelebirrInvoiceFromExtracted(extracted),
  };
}
