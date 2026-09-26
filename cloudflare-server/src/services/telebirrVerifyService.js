import fs from 'fs/promises';
import {
  extractTelebirrOcrFromBuffer,
  isGeminiQuotaBlocked,
} from './geminiService.js';
import { prepareReceiptWork } from '../utils/prepareReceiptWork.js';
import { buildQrDataFromRaw, decodeQrFromBuffer } from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import {
  mergeTelebirrApiIntoQrFields,
  resolveTelebirrOfficialReceipt,
  collectTelebirrInvoiceCandidates,
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
 * Telebirr screenshot verification:
 * Parallel QR scan + Gemini OCR → resolve candidate Invoice No. → official API.
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

  let geminiUsed = false;
  let geminiError = isGeminiQuotaBlocked()
    ? 'Gemini quota exceeded — reading via QR / official lookup'
    : null;

  const workPromise = prepareReceiptWork(buffer, mime);

  const qrPromise = workPromise
    .then(({ qrImage }) => (
      decodeQrFromBuffer(buffer, { maxMs: 4000, image: qrImage })
    ))
    .catch((err) => {
      console.warn('[Telebirr] QR decode error:', err.message);
      return buildQrDataFromRaw(null);
    });

  const ocrPromise = (async () => {
    if (isGeminiQuotaBlocked()) return { ...EMPTY_EXTRACTED };
    try {
      const { ocrBuffer, ocrMime } = await workPromise;
      const ocr = await extractTelebirrOcrFromBuffer(ocrBuffer, ocrMime, { skipOcrPrep: true });
      return { ...EMPTY_EXTRACTED, ...ocr };
    } catch (err) {
      geminiError = err.message;
      console.warn('[Telebirr] OCR error:', err.message);
      return { ...EMPTY_EXTRACTED };
    }
  })();

  const [qrDataRaw, extractedRaw] = await Promise.all([qrPromise, ocrPromise]);

  const qrData = qrDataRaw || buildQrDataFromRaw(null);
  const extracted = extractedRaw || { ...EMPTY_EXTRACTED };
  if (extracted.transactionCode || extracted.amount) {
    geminiUsed = true;
  }

  if (extracted.amount != null) {
    const n = Math.abs(parseFloat(extracted.amount));
    extracted.amount = Number.isFinite(n) && n > 0 ? n : extracted.amount;
  }

  let qrFields = extractQrReceiptFields('telebirr', qrData);

  // Resolve official receipt using all candidate invoices from both QR and OCR
  const telebirrResolve = await resolveTelebirrOfficialReceipt({ qrData, extracted });
  const telebirrOfficial = telebirrResolve?.official || null;

  if (telebirrOfficial) {
    qrFields = mergeTelebirrApiIntoQrFields(qrFields, telebirrOfficial);
    if (!extracted.transactionCode) {
      extracted.transactionCode = telebirrOfficial.transactionCode;
    }
    if (!extracted.amount) {
      extracted.amount = telebirrOfficial.amount;
    }
    console.log(
      '[Telebirr] Official record:',
      telebirrOfficial.transactionCode,
      'via',
      telebirrResolve.verifiedVia || 'official',
      'amount',
      telebirrOfficial.amount,
    );
  } else {
    const candidates = collectTelebirrInvoiceCandidates(qrData, extracted);
    console.warn('[Telebirr] No official record for candidates:', candidates.candidates);
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
      || telebirrResolve?.qrInvoice
      || extractTelebirrInvoiceFromExtracted(extracted),
  };
}
