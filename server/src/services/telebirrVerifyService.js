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

const QR_BUDGET_MS = 9000;
const OCR_GRACE_MS = 800;

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

/** Aggressive QR scan — generic decoder first, then targeted crops with remaining budget. */
async function decodeTelebirrQrFromBuffer(buffer, { maxMs = QR_BUDGET_MS, preparedImage = null } = {}) {
  const prepared = preparedImage || await prepareQrScanImage(buffer);
  const deadline = Date.now() + maxMs;
  const shouldStop = () => Date.now() >= deadline;
  const remaining = () => Math.max(0, deadline - Date.now());

  const quick = await decodeQrFromBuffer(buffer, { maxMs: Math.min(maxMs, 8000), image: prepared });
  if (quick?.raw && isTelebirrQrPayload(quick.raw)) {
    console.log('[Telebirr] QR decoded (generic)');
    return quick;
  }

  const left = remaining();
  if (left < 1500) return quick?.raw ? quick : buildQrDataFromRaw(null);

  try {
    let image = prepared;
    const { width, height } = image.bitmap;
    if (width < 500 || height < 500) {
      const factor = Math.max(500 / width, 500 / height, 1);
      image = image.clone().scale(Math.min(factor, 3));
    }

    const h = image.bitmap.height;
    const w = image.bitmap.width;
    const qrFocusedCrop = height / width < 0.75;

    const variants = [];
    if (qrFocusedCrop) {
      for (const scale of [4, 6]) {
        variants.push(image.clone().scale(scale));
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

    const bottomCuts = qrFocusedCrop ? [0, 0.35] : [0.5, 0.6, 0.7];
    for (const cut of bottomCuts) {
      if (shouldStop()) break;
      const y = Math.floor(h * cut);
      const crops = [
        image.clone().crop({ x: 0, y, w, h: h - y }).scale(4),
        image.clone().crop({ x: 0, y, w, h: h - y }).greyscale().invert().scale(5),
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

  const started = Date.now();
  console.log('[Telebirr] verify', buffer.length, 'bytes', mime);

  let geminiUsed = true;
  let geminiError = null;

  const preparedPromise = prepareQrScanImage(buffer);

  const geminiPromise = extractPaymentFromBuffer(buffer, 'telebirr', mime)
    .then((data) => ({ data }))
    .catch((err) => {
      geminiError = err.message;
      geminiUsed = false;
      return { data: { ...EMPTY_EXTRACTED } };
    });

  const screenshotPrefetchPromise = geminiPromise.then(async (outcome) => {
    const id = normalizeTelebirrInvoiceId(outcome.data?.transactionCode);
    if (!id) return null;
    const official = await fetchTelebirrReceipt(id);
    return official ? { invoiceId: id, official } : null;
  });

  const qrPromise = preparedPromise.then(async (prepared) => {
    const prefetch = await screenshotPrefetchPromise;
    if (prefetch?.official) return buildQrDataFromRaw(null);
    const invoiceFromOcr = await geminiPromise.then(
      (outcome) => normalizeTelebirrInvoiceId(outcome.data?.transactionCode),
    );
    if (invoiceFromOcr) return buildQrDataFromRaw(null);
    return decodeTelebirrQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS, preparedImage: prepared });
  });

  const qrPrefetchPromise = qrPromise.then(async (qrData) => {
    const id = normalizeTelebirrInvoiceId(
      extractTelebirrInvoiceFromPayload(qrData?.raw) || qrData?.transactionCode,
    );
    if (!id) return null;
    const official = await fetchTelebirrReceipt(id);
    return official ? { invoiceId: id, official } : null;
  });

  const fullPipelinePromise = Promise.all([
    geminiPromise,
    qrPromise,
    screenshotPrefetchPromise,
    qrPrefetchPromise,
  ]).then(([geminiOutcome, qrData, screenshotPrefetch, qrPrefetch]) => ({
    geminiOutcome,
    qrData,
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

    qrPromise.then(async (qrData) => {
      if (!qrData?.raw || !isTelebirrQrPayload(qrData.raw)) return;
      const geminiOutcome = await Promise.race([
        geminiPromise,
        new Promise((r) => setTimeout(() => r({ data: { ...EMPTY_EXTRACTED } }), OCR_GRACE_MS)),
      ]);
      finish({ geminiOutcome, qrData, screenshotPrefetch: null, qrPrefetch: null });
    });

    screenshotPrefetchPromise.then(async (prefetch) => {
      if (!prefetch?.official) return;
      const geminiOutcome = await geminiPromise;
      finish({
        geminiOutcome,
        qrData: buildQrDataFromRaw(null),
        screenshotPrefetch: prefetch,
        qrPrefetch: null,
      });
    });

    fullPipelinePromise.then(finish);
  });

  const { geminiOutcome, qrData, screenshotPrefetch, qrPrefetch } = outcome;
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

  console.log('[Telebirr] done in', Date.now() - started, 'ms');

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
