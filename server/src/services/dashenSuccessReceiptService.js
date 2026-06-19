import fs from 'fs/promises';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
} from '@zxing/library';
import { parseQrPayload, decodeQrFromBuffer, buildQrDataFromRaw } from './qrService.js';
import { analyzeQrAuthenticity } from './qrAuthenticityService.js';

export function isAcceptedDashenQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length < 16) return false;
  if (text === '{}' || text === '[]') return false;
  if (/^superappreceipt_/i.test(text)) return true;
  if (/receipt\.dashensuperapp\.com/i.test(text)) return true;
  if (/\b\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,}\b/i.test(text)) return true;
  return analyzeQrAuthenticity('dashen', text).authentic;
}

export function isDashenSuperAppReceiptToken(value) {
  return /^superappreceipt_/i.test(String(value || '').trim());
}

function luminanceFromBitmap(bitmap) {
  const { data, width, height } = bitmap;
  const rgba = new Uint8ClampedArray(data);
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 1) {
    luminance[j] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
  }
  return { luminance, width, height };
}

function scanBitmap(bitmap) {
  const { data, width, height } = bitmap;
  const jsResult = jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
  if (jsResult?.data) return jsResult.data;

  const { luminance, width: w, height: h } = luminanceFromBitmap(bitmap);
  const source = new RGBLuminanceSource(luminance, w, h);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);

  for (const Binarizer of [HybridBinarizer, GlobalHistogramBinarizer]) {
    try {
      return reader.decode(new BinaryBitmap(new Binarizer(source))).getText();
    } catch {
      // try next binarizer
    }
  }
  return null;
}

function buildQrResult(raw) {
  const parsed = parseQrPayload(raw);
  return {
    raw,
    transactionCode: parsed.transactionCode,
    verificationUrl: parsed.verificationUrl,
    verificationToken: parsed.verificationToken,
    dashenReference: parsed.dashenReference,
    dashenReceiptToken: parsed.dashenReceiptToken,
    decodedPayload: raw,
    dashenSuccessScreen: true,
  };
}

function scanDashenSuccessImage(image, shouldStop = () => false) {
  const { width, height } = image.bitmap;

  for (const scale of [2, 3, 4]) {
    if (shouldStop()) break;
    const fullVariants = [
      image.clone().scale(scale),
      image.clone().greyscale().invert().scale(scale),
      image.clone().greyscale().scale(scale),
    ];
    for (const variant of fullVariants) {
      if (shouldStop()) break;
      const raw = scanBitmap(variant.bitmap);
      if (!raw || !isAcceptedDashenQrPayload(raw)) continue;
      if (isDashenSuperAppReceiptToken(raw) || /receipt\.dashensuperapp\.com/i.test(raw)) {
        return buildQrResult(raw);
      }
    }
  }

  const regions = [
    { x: 0, y: Math.floor(height * 0.45), w: width, h: height - Math.floor(height * 0.45) },
    { x: Math.floor(width * 0.05), y: Math.floor(height * 0.55), w: Math.floor(width * 0.9), h: Math.floor(height * 0.42) },
    { x: Math.floor(width * 0.1), y: Math.floor(height * 0.6), w: Math.floor(width * 0.8), h: Math.floor(height * 0.35) },
  ];

  for (const region of regions) {
    if (shouldStop()) break;
    if (region.h < 40 || region.w < 40) continue;
    const base = image.clone().crop(region);

    for (const scale of [3, 4, 5]) {
      if (shouldStop()) break;
      const variants = [
        base.clone().greyscale().invert().scale(scale),
        base.clone().greyscale().scale(scale),
        base.clone().scale(scale),
        base.clone().contrast(0.35).greyscale().invert().scale(scale),
      ];

      for (const variant of variants) {
        if (shouldStop()) break;
        const raw = scanBitmap(variant.bitmap);
        if (!raw || !isAcceptedDashenQrPayload(raw)) continue;
        if (isDashenSuperAppReceiptToken(raw) || /receipt\.dashensuperapp\.com/i.test(raw)) {
          return buildQrResult(raw);
        }
      }
    }
  }

  return null;
}

export async function decodeDashenSuccessQrFromBuffer(buffer, { maxMs = 18000 } = {}) {
  try {
    const image = prepareDashenImage(await Jimp.read(buffer));
    const deadline = Date.now() + maxMs;
    return scanDashenSuccessImage(image, () => Date.now() >= deadline);
  } catch (err) {
    console.warn('[Dashen success QR]', err.message);
    return null;
  }
}

export async function decodeDashenSuccessQrFromImage(imagePath) {
  try {
    const buffer = await fs.readFile(imagePath);
    return decodeDashenSuccessQrFromBuffer(buffer);
  } catch (err) {
    console.warn('[Dashen success QR]', err.message);
    return null;
  }
}

function prepareDashenImage(image) {
  const { width, height } = image.bitmap;
  const minDim = Math.min(width, height);
  if (minDim < 400) {
    const factor = Math.min(3, 400 / minDim);
    return image.clone().scale(factor);
  }
  return image;
}

/** Success-screen scan first, then generic — less CPU than parallel double-read. */
export async function decodeDashenUploadQr(buffer, { maxMs = 45000, vatMode = false } = {}) {
  try {
    if (vatMode) {
      const generic = await decodeQrFromBuffer(buffer, { maxMs });
      if (generic?.raw && isAcceptedDashenQrPayload(generic.raw)) return generic;
      return buildQrDataFromRaw(null);
    }

    const half = Math.max(15000, Math.floor(maxMs / 2));
    const success = await decodeDashenSuccessQrFromBuffer(buffer, { maxMs: half });
    if (success?.raw && isAcceptedDashenQrPayload(success.raw)) {
      console.log('[Dashen] Success-screen QR decoded');
      return success;
    }

    const generic = await decodeQrFromBuffer(buffer, { maxMs: half });
    if (generic?.raw && isAcceptedDashenQrPayload(generic.raw)) {
      console.log('[Dashen] QR decoded via generic scan');
      return generic;
    }

    return buildQrDataFromRaw(null);
  } catch (err) {
    console.warn('[Dashen upload QR]', err.message);
    return buildQrDataFromRaw(null);
  }
}

export async function decodeDashenUploadQrFromPath(imagePath, options = {}) {
  const buffer = await fs.readFile(imagePath);
  return decodeDashenUploadQr(buffer, options);
}

/** Copy visible receipt text into QR fields when the success-screen token cannot hit the PDF API. */
export function enrichDashenSuccessReceiptFields(qrData, extracted, qrFields) {
  if (!isDashenSuperAppReceiptToken(qrData?.raw)) return qrFields;

  const pick = (qrVal, shotVal) => {
    const q = qrVal == null || qrVal === '' ? null : qrVal;
    const s = shotVal == null || shotVal === '' ? null : shotVal;
    return q ?? s ?? null;
  };

  return {
    ...qrFields,
    transactionCode: qrFields.transactionCode || qrData?.dashenReceiptToken || qrData?.verificationToken || null,
    amount: pick(qrFields.amount, extracted?.amount != null ? String(extracted.amount) : null),
    senderName: pick(qrFields.senderName, extracted?.senderName),
    senderAccount: pick(qrFields.senderAccount, extracted?.senderAccount),
    receiverName: pick(qrFields.receiverName, extracted?.receiverName),
    receiverAccount: pick(qrFields.receiverAccount, extracted?.receiverAccount),
    dashenSuperAppSource: true,
  };
}
