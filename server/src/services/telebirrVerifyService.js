import fs from 'fs/promises';
import { extractPaymentFromBuffer } from './geminiService.js';
import {
  decodeQrFromBuffer,
  buildQrDataFromRaw,
  prepareQrScanImage,
  scanImageForQrValidated,
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

const QR_BUDGET_MS = 18000;

function isTelebirrQrPayload(raw) {
  if (!raw) return false;
  if (analyzeQrAuthenticity('telebirr', raw).authentic) return true;
  return Boolean(extractTelebirrInvoiceFromPayload(raw));
}

/** Aggressive QR scan — full image for QR-only crops, bottom-focused for full receipts. */
async function decodeTelebirrQrFromBuffer(buffer, { maxMs = QR_BUDGET_MS, preparedImage = null } = {}) {
  const prepared = preparedImage || await prepareQrScanImage(buffer);
  const quick = await decodeQrFromBuffer(buffer, { maxMs: Math.min(maxMs, 10000), image: prepared });
  if (quick?.raw && isTelebirrQrPayload(quick.raw)) return quick;

  try {
    let image = prepared;
    const { width, height } = image.bitmap;
    if (width < 500 || height < 500) {
      const factor = Math.max(500 / width, 500 / height, 1);
      image = image.clone().scale(Math.min(factor, 3));
    }

    const deadline = Date.now() + maxMs;
    const shouldStop = () => Date.now() >= deadline;
    const h = image.bitmap.height;
    const w = image.bitmap.width;
    const qrFocusedCrop = height / width < 0.75;

    const variants = [];
    if (qrFocusedCrop) {
      for (const scale of [4, 5, 6, 8]) {
        variants.push(image.clone().scale(scale));
        variants.push(image.clone().greyscale().scale(scale));
        variants.push(image.clone().greyscale().invert().scale(scale));
      }
    }

    for (const variant of variants) {
      if (shouldStop()) break;
      const raw = scanImageForQrValidated(variant, shouldStop, isTelebirrQrPayload);
      if (raw) {
        console.log('[Telebirr] QR decoded (QR-focused full scan)');
        return buildQrDataFromRaw(raw);
      }
    }

    const validated = scanImageForQrValidated(image, shouldStop, isTelebirrQrPayload);
    if (validated) return buildQrDataFromRaw(validated);

    const bottomCuts = qrFocusedCrop ? [0, 0.2, 0.35] : [0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75];
    for (const cut of bottomCuts) {
      if (shouldStop()) break;
      const y = Math.floor(h * cut);
      const crops = [
        image.clone().crop({ x: 0, y, w, h: h - y }).scale(4),
        image.clone().crop({ x: 0, y, w, h: h - y }).greyscale().invert().scale(5),
        image.clone().crop({ x: Math.floor(w * 0.05), y, w: Math.floor(w * 0.9), h: h - y }).scale(5),
      ];
      for (const variant of crops) {
        if (shouldStop()) break;
        const raw = scanImageForQrValidated(variant, shouldStop, isTelebirrQrPayload);
        if (raw) {
          console.log('[Telebirr] QR decoded (focused scan)');
          return buildQrDataFromRaw(raw);
        }
      }
    }
  } catch (err) {
    console.warn('[Telebirr] QR scan error:', err.message);
  }

  return quick?.raw ? quick : buildQrDataFromRaw(null);
}

/**
 * Telebirr pipeline: aggressive QR scan + OCR + official web receipt by invoice ID.
 * When QR cannot be read, official Telebirr page still verifies via invoice from text.
 */
export async function verifyTelebirrReceipt({ buffer, mime = 'image/jpeg', screenshotPath }) {
  if (!buffer && screenshotPath) {
    buffer = await fs.readFile(screenshotPath);
  }
  if (!buffer?.length) {
    throw new Error('Telebirr verification requires a screenshot buffer');
  }

  let geminiUsed = true;
  let geminiError = null;

  const preparedPromise = prepareQrScanImage(buffer);

  const geminiPromise = extractPaymentFromBuffer(buffer, 'telebirr', mime)
    .then((data) => ({ data }))
    .catch((err) => {
      geminiError = err.message;
      geminiUsed = false;
      return {
        data: {
          senderName: null,
          senderAccount: null,
          receiverName: null,
          receiverAccount: null,
          amount: null,
          date: null,
          transactionCode: null,
        },
      };
    });

  const qrPromise = preparedPromise.then((prepared) =>
    decodeTelebirrQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS, preparedImage: prepared }),
  );

  const screenshotPrefetchPromise = geminiPromise.then(async (outcome) => {
    const id = normalizeTelebirrInvoiceId(outcome.data?.transactionCode);
    if (!id) return null;
    const official = await fetchTelebirrReceipt(id);
    return official ? { invoiceId: id, official } : null;
  });

  const qrPrefetchPromise = qrPromise.then(async (qrData) => {
    const id = normalizeTelebirrInvoiceId(
      extractTelebirrInvoiceFromPayload(qrData?.raw) || qrData?.transactionCode,
    );
    if (!id) return null;
    const official = await fetchTelebirrReceipt(id);
    return official ? { invoiceId: id, official } : null;
  });

  const [geminiOutcome, qrData, screenshotPrefetch, qrPrefetch] = await Promise.all([
    geminiPromise,
    qrPromise,
    screenshotPrefetchPromise,
    qrPrefetchPromise,
  ]);
  const extracted = geminiOutcome.data;
  if (geminiError) console.warn('[Gemini]', geminiError);

  let qrFields = extractQrReceiptFields('telebirr', qrData);
  const telebirrResolve = await resolveTelebirrOfficialReceipt({
    qrData,
    extracted,
    screenshotPrefetch,
    qrPrefetch,
  });

  if (telebirrResolve?.official) {
    qrFields = mergeTelebirrApiIntoQrFields(qrFields, telebirrResolve.official);
    if (telebirrResolve.qrMisread) {
      console.log('[Telebirr] Official record:', telebirrResolve.official.transactionCode,
        '(QR parse corrected from', telebirrResolve.qrInvoice, ')');
    } else {
      console.log('[Telebirr] Official record:', telebirrResolve.official.transactionCode,
        'amount', telebirrResolve.official.amount);
    }
  } else {
    const scanned = telebirrResolve?.qrInvoice || telebirrResolve?.screenshotInvoice;
    if (scanned) {
      console.warn('[Telebirr] No official record for invoice:', scanned);
    } else if (qrData?.raw) {
      console.warn('[Telebirr] QR found but invoice ID could not be resolved');
    } else {
      console.warn('[Telebirr] QR not found and no invoice ID for official lookup');
    }
  }

  if (qrData?.raw && !telebirrResolve?.official) {
    console.log('[Telebirr] QR payload length:', qrData.raw.length);
  }

  return {
    extracted,
    geminiUsed,
    geminiError,
    qrData,
    qrFields,
    telebirrResolve,
    invoiceId: telebirrResolve?.matchedInvoice || telebirrResolve?.qrInvoice || telebirrResolve?.screenshotInvoice,
  };
}

export { decodeTelebirrQrFromBuffer };
