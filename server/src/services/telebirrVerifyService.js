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

/** Keep QR short — payment ID from invoice OCR or quick QR, then Petros. */
const QR_BUDGET_MS = Number(process.env.TELEBIRR_QR_BUDGET_MS) || 2500;

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

  const quick = await decodeQrFromBuffer(buffer, { maxMs: Math.min(maxMs, 1800), image: prepared });
  const quickInvoice = resolveQrInvoice(quick);
  if (quickInvoice) {
    console.log('[Telebirr] QR decoded (generic):', quickInvoice);
    return quick;
  }

  try {
    const h = prepared.bitmap.height;
    const w = prepared.bitmap.width;
    for (const cut of [0.45, 0.55]) {
      if (shouldStop()) break;
      const y = Math.floor(h * cut);
      const crops = [
        prepared.clone().crop({ x: 0, y, w, h: h - y }).scale(3),
        prepared.clone().crop({ x: 0, y, w, h: h - y }).greyscale().invert().scale(4),
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
 * Race quick QR vs Gemini invoice OCR — resolve as soon as either finds Invoice No.
 * `ocrPromise` may already be running (started during image prep).
 */
async function resolveInvoiceFast(buffer, mime, prepared, ocrPromise = null) {
  let settled = false;
  let qrData = buildQrDataFromRaw(null);

  return new Promise((resolve) => {
    const finish = (invoice, source, qr = null) => {
      if (settled || !invoice) return;
      settled = true;
      if (qr) qrData = qr;
      resolve({ invoice, source, qrData });
    };

    const qrTask = decodeTelebirrQrFromBuffer(buffer, {
      maxMs: QR_BUDGET_MS,
      preparedImage: prepared,
    }).then((qr) => {
      qrData = qr || qrData;
      const invoice = resolveQrInvoice(qr);
      if (invoice) {
        console.log('[Telebirr] fast path invoice from QR:', invoice);
        finish(invoice, 'qr', qr);
      }
      return qr;
    }).catch((err) => {
      console.warn('[Telebirr] QR race error:', err.message);
      return null;
    });

    const ocrTask = (ocrPromise
      || (isGeminiQuotaBlocked()
        ? Promise.resolve(null)
        : extractTelebirrInvoiceFromBuffer(buffer, mime)))
      .then((invoice) => {
        if (invoice) {
          console.log('[Telebirr] fast path invoice from OCR:', invoice);
          finish(invoice, 'focused', qrData);
        }
        return invoice;
      })
      .catch((err) => {
        console.warn('[Telebirr] OCR race error:', err.message);
        return null;
      });

    Promise.all([qrTask, ocrTask]).then(([qr, focusedInvoice]) => {
      if (settled) return;
      const fromQr = resolveQrInvoice(qr);
      if (fromQr) {
        finish(fromQr, 'qr', qr);
        return;
      }
      if (focusedInvoice) {
        finish(focusedInvoice, 'focused', qr || qrData);
        return;
      }
      settled = true;
      resolve({ invoice: null, source: null, qrData: qr || qrData });
    });
  });
}

/**
 * Telebirr screenshot verify — extract Invoice No. fast, then Petros (same as payment ID).
 * Skips full Gemini receipt OCR when Petros succeeds.
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

  // Start invoice OCR immediately on original bytes (overlaps Jimp prep).
  const ocrPromise = isGeminiQuotaBlocked()
    ? Promise.resolve(null)
    : extractTelebirrInvoiceFromBuffer(buffer, mime);

  const preparedInput = await prepareOcrBuffer(buffer, mime);
  buffer = preparedInput.buffer;
  mime = preparedInput.mime;
  const prepared = await prepareQrScanImage(buffer);
  const fast = await resolveInvoiceFast(buffer, mime, prepared, ocrPromise);
  let qrData = fast.qrData || buildQrDataFromRaw(null);

  let officialHit = await officialFromInvoice(fast.invoice, fast.source || 'fast');
  let geminiUsed = false;
  let geminiError = null;
  let extracted = officialHit
    ? buildExtractedFromOfficial(officialHit)
    : { ...EMPTY_EXTRACTED };

  // Slow path only when invoice still unknown / Petros miss
  if (!officialHit && !isGeminiQuotaBlocked()) {
    try {
      geminiUsed = true;
      console.log('[Telebirr] falling back to full Gemini extract');
      const data = await extractPaymentFromBuffer(buffer, 'telebirr', mime);
      extracted = data;
      const geminiInvoice = extractTelebirrInvoiceFromExtracted(data);
      officialHit = await officialFromInvoice(geminiInvoice, 'screenshot');
      if (officialHit) {
        extracted = buildExtractedFromOfficial(officialHit);
      }
    } catch (err) {
      geminiError = err.message;
      geminiUsed = false;
      console.warn('[Gemini]', geminiError);
    }
  } else if (!officialHit && isGeminiQuotaBlocked()) {
    geminiError = 'Gemini quota exceeded — verified via QR and official Telebirr lookup only';
    console.warn('[Gemini]', geminiError);
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
