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

/** Decode Telebirr QR binary payload — invoice is hex-encoded after 0A marker. */
export function extractTelebirrInvoiceFromPayload(payload) {
  if (!payload || typeof payload !== 'string') return null;

  let text = payload.trim();

  if (/^[A-Za-z0-9+/=]+$/.test(text) && text.length > 16) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('ascii');
      if (decoded && decoded.length > 8) text = decoded;
    } catch {
      // keep original
    }
  }

  const markerIdx = text.indexOf('0A');
  if (markerIdx >= 0) {
    const after = text.slice(markerIdx + 2);
    let hex = '';
    for (let i = 0; i < after.length - 1; i += 2) {
      const pair = after.slice(i, i + 2);
      if (!/^[0-9A-Fa-f]{2}$/.test(pair)) break;
      hex += pair;
    }
    if (hex.length >= 10) {
      const ascii = Buffer.from(hex, 'hex').toString('ascii');
      const exact = ascii.match(/\b(DFC[A-Z0-9]{7}|DF[A-Z0-9]{8})\b/i);
      if (exact) return exact[1].toUpperCase();
      if (/^DFC[A-Z0-9]{7}/i.test(ascii)) {
        return ascii.slice(0, 10).toUpperCase();
      }
      const telebirr = ascii.match(/^(DFC[A-Z0-9]{7})(?=[^A-Z0-9]|$)/i)
        || ascii.match(/^(DF[A-Z0-9]{8})(?=[^A-Z0-9]|$)/i);
      if (telebirr) return telebirr[1].toUpperCase();
    }
  }

  const direct = text.match(/\b(DFC[A-Z0-9]{7})\b/i)
    || text.match(/\b(DF[A-Z0-9]{8})\b/i)
    || text.match(/\b(DFC[A-Z0-9]{6,7})\b/i)
    || text.match(/\b(DF[A-Z0-9]{7,8})\b/i);
  if (direct) return direct[1].toUpperCase();

  return null;
}

/** Best-effort phone extraction from Telebirr signed QR payload (not available for CBE URL QRs). */
export function extractPhoneFromQrPayload(qrData) {
  const chunks = [qrData?.decodedPayload, qrData?.raw].filter(Boolean);

  for (const chunk of chunks) {
    const text = String(chunk);
    const patterns = text.match(/\b(?:251)?9\d{8}\b/g) || [];
    for (const hit of patterns) {
      let digits = hit.replace(/\D/g, '');
      if (digits.startsWith('251') && digits.length >= 12) digits = `0${digits.slice(3)}`;
      if (digits.startsWith('9') && digits.length === 9) digits = `0${digits}`;
      if (/^09\d{8}$/.test(digits)) return digits;
    }

    const allDigits = text.replace(/[^\d]/g, '');
    const local = allDigits.match(/09\d{8}/);
    if (local) return local[0];
    const intl = allDigits.match(/2519\d{8}/);
    if (intl) return `0${intl[0].slice(3)}`;
  }

  return null;
}

export function parseTransactionFromQr(qrText) {
  if (!qrText || typeof qrText !== 'string') return null;

  const trimmed = qrText.trim();

  if (/^https?:\/\/mbreciept\.cbe\.com\.et\//i.test(trimmed)) {
    return null;
  }

  const dashenRef = trimmed.match(/receipt\.dashensuperapp\.com\/receipt\/([A-Z0-9]+)/i)?.[1];
  if (dashenRef && !dashenRef.startsWith('superappreceipt')) {
    return dashenRef.toUpperCase();
  }

  const boaRef = trimmed.match(/[?&]trx=([A-Z0-9]+)/i)?.[1];
  if (boaRef) return boaRef.toUpperCase();

  const telebirr = extractTelebirrInvoiceFromPayload(qrText);
  if (telebirr) return telebirr;

  try {
    const json = JSON.parse(trimmed);
    const code = json.transactionCode || json.txnId || json.invoiceNo || json.reference || json.ref;
    if (code) return String(code).toUpperCase();
  } catch {
    // not JSON
  }

  const patterns = [
    /(?:invoice|txn|transaction|reference|ref)[:\s#-]*([A-Z0-9]{8,20})/i,
    /\b(DFC[A-Z0-9]{6,14})\b/i,
    /\b(FT[A-Z0-9]{8,14})\b/i,
    /\b(\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i,
    /\b(IPSS\d+[A-Z0-9]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  if (trimmed.startsWith('http')) return null;
  if (/^superappreceipt_/i.test(trimmed)) return null;

  return trimmed.length >= 8 && trimmed.length <= 32 ? trimmed.toUpperCase() : null;
}

/** Token from CBE mbreciept QR — mobile success uses v2-…, VAT/web receipt uses opaque id. */
export function extractCbeMbReceiptToken(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^https?:\/\/mbreciept\.cbe\.com\.et\/([^/?#]+)/i);
  if (!match?.[1]) return null;
  const token = decodeURIComponent(match[1]).trim();
  if (!token || token.length < 8) return null;
  return token;
}

export function parseQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return {
      transactionCode: null,
      verificationUrl: null,
      verificationToken: null,
      dashenReference: null,
      dashenReceiptToken: null,
    };
  }

  const cbeToken = extractCbeMbReceiptToken(text);
  if (cbeToken) {
    return {
      transactionCode: null,
      verificationUrl: text,
      verificationToken: cbeToken,
      dashenReference: null,
      dashenReceiptToken: null,
    };
  }

  const dashenUrlMatch = text.match(/^https?:\/\/receipt\.dashensuperapp\.com\/receipt\/([A-Z0-9]+)/i);
  if (dashenUrlMatch) {
    const ref = dashenUrlMatch[1];
    const isToken = ref.startsWith('superappreceipt');
    return {
      transactionCode: isToken ? null : ref.toUpperCase(),
      verificationUrl: text,
      verificationToken: isToken ? ref : null,
      dashenReference: isToken ? null : ref.toUpperCase(),
      dashenReceiptToken: isToken ? ref : null,
    };
  }

  if (/^superappreceipt_/i.test(text)) {
    return {
      transactionCode: null,
      verificationUrl: null,
      verificationToken: text,
      dashenReference: null,
      dashenReceiptToken: text,
    };
  }

  const boaUrlMatch = text.match(/^https?:\/\/cs\.bankofabyssinia\.com\/slip\/\?trx=([A-Z0-9]+)/i);
  if (boaUrlMatch) {
    return {
      transactionCode: boaUrlMatch[1].toUpperCase(),
      verificationUrl: text,
      verificationToken: null,
      dashenReference: null,
      dashenReceiptToken: null,
    };
  }

  const dashenRef = text.match(/\b(\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i)?.[1];

  return {
    transactionCode: parseTransactionFromQr(text),
    verificationUrl: /^https?:\/\//i.test(text) ? text : null,
    verificationToken: null,
    dashenReference: dashenRef ? dashenRef.toUpperCase() : null,
    dashenReceiptToken: null,
  };
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

function scanJsQR(bitmap) {
  const { data, width, height } = bitmap;
  return jsQR(new Uint8ClampedArray(data), width, height, { inversionAttempts: 'attemptBoth' });
}

function scanZXing(bitmap, Binarizer = HybridBinarizer) {
  const { luminance, width, height } = luminanceFromBitmap(bitmap);
  const source = new RGBLuminanceSource(luminance, width, height);
  const binaryBitmap = new BinaryBitmap(new Binarizer(source));
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  try {
    return reader.decode(binaryBitmap).getText();
  } catch {
    return null;
  }
}

function scanBitmap(bitmap) {
  const jsResult = scanJsQR(bitmap);
  if (jsResult?.data) return jsResult.data;

  const zxingHybrid = scanZXing(bitmap, HybridBinarizer);
  if (zxingHybrid) return zxingHybrid;

  const zxingGlobal = scanZXing(bitmap, GlobalHistogramBinarizer);
  if (zxingGlobal) return zxingGlobal;

  return null;
}

function buildQrDataFromRaw(data) {
  if (!data) {
    return {
      raw: null,
      transactionCode: null,
      verificationUrl: null,
      verificationToken: null,
      dashenReference: null,
      dashenReceiptToken: null,
      decodedPayload: null,
    };
  }

  const parsed = parseQrPayload(data);
  return {
    raw: data,
    transactionCode: parsed.transactionCode,
    verificationUrl: parsed.verificationUrl,
    verificationToken: parsed.verificationToken,
    dashenReference: parsed.dashenReference,
    dashenReceiptToken: parsed.dashenReceiptToken,
    decodedPayload: extractTelebirrInvoiceFromPayload(data)
      ? Buffer.from(data, 'base64').toString('ascii')
      : data,
  };
}

async function quickScan(image, shouldStop = () => false) {
  const { width, height } = image.bitmap;
  const bottomY = Math.floor(height * 0.42);
  const bottomH = height - bottomY;
  const bottom55 = Math.floor(height * 0.55);
  const midY = Math.floor(height * 0.35);
  const targets = [
    image.clone().scale(2),
    image.clone().scale(3),
    image.clone().crop({ x: 0, y: bottom55, w: width, h: height - bottom55 }).greyscale().invert().scale(4),
    image.clone().crop({ x: Math.floor(width * 0.05), y: bottom55, w: Math.floor(width * 0.9), h: height - bottom55 }).greyscale().invert().scale(4),
    image.clone().crop({ x: 0, y: midY, w: width, h: height - midY }).scale(3),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).scale(3),
    image.clone().crop({ x: 0, y: bottom55, w: width, h: height - bottom55 }).scale(3),
    image.clone().greyscale().scale(3),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).greyscale().scale(4),
  ];

  for (const variant of targets) {
    if (shouldStop()) break;
    const data = scanBitmap(variant.bitmap);
    if (data) return data;
  }
  return null;
}

export function scanImageForQr(image, shouldStop = () => false) {
  return quickScan(image, shouldStop);
}

export function scanImageForQrValidated(image, shouldStop = () => false, validate = () => true) {
  const { width, height } = image.bitmap;
  const bottomY = Math.floor(height * 0.42);
  const bottomH = height - bottomY;
  const bottom55 = Math.floor(height * 0.55);
  const midY = Math.floor(height * 0.35);
  const targets = [
    image.clone().scale(2),
    image.clone().scale(3),
    image.clone().crop({ x: 0, y: bottom55, w: width, h: height - bottom55 }).greyscale().invert().scale(4),
    image.clone().crop({ x: Math.floor(width * 0.05), y: bottom55, w: Math.floor(width * 0.9), h: height - bottom55 }).greyscale().invert().scale(4),
    image.clone().crop({ x: 0, y: midY, w: width, h: height - midY }).scale(3),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).scale(3),
    image.clone().crop({ x: 0, y: bottom55, w: width, h: height - bottom55 }).scale(3),
    image.clone().greyscale().scale(3),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).greyscale().scale(4),
  ];

  for (const variant of targets) {
    if (shouldStop()) break;
    const data = scanBitmap(variant.bitmap);
    if (data && validate(data)) return data;
  }
  return null;
}

export { buildQrDataFromRaw };

export async function decodeQrFromBuffer(buffer, { maxMs = 14000 } = {}) {
  try {
    let image = await Jimp.read(buffer);
    const { width, height } = image.bitmap;
    if (width < 400 || height < 400) {
      const factor = Math.max(400 / width, 400 / height, 1);
      image = image.clone().scale(Math.min(factor, 3));
    }
    const deadline = Date.now() + maxMs;
    const data = await quickScan(image, () => Date.now() >= deadline);
    return buildQrDataFromRaw(data);
  } catch (err) {
    console.warn('[QR decode]', err.message);
    return buildQrDataFromRaw(null);
  }
}

export async function decodeQrFromImage(imagePath) {
  try {
    const buffer = await fs.readFile(imagePath);
    return decodeQrFromBuffer(buffer);
  } catch (err) {
    console.warn('[QR decode]', err.message);
    return buildQrDataFromRaw(null);
  }
}
