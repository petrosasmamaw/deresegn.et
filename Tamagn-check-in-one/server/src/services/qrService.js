import fs from 'fs/promises';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import jsQRRaw from 'jsqr';
import { Jimp } from 'jimp';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
} from '@zxing/library';
import { TELEBIRR_INVOICE_RE } from '../utils/telebirrInvoice.js';
import { isWorkersRuntime } from '../config/runtime.js';

const jsQR = typeof jsQRRaw === 'function' ? jsQRRaw : (jsQRRaw?.default || jsQRRaw?.jsQR || jsQRRaw);

const IS_WORKERS = isWorkersRuntime();
const QR_SCAN_MAX_DIM = IS_WORKERS
  ? Number(process.env.QR_SCAN_MAX_DIM) || 1400
  : Number(process.env.QR_SCAN_MAX_DIM) || 2200;
const QR_SCAN_MIN_DIM = 400;
const WORKERS_QR_VARIANT_CAP = 2;

const DEFAULT_QR_MAX_MS = IS_WORKERS
  ? Number(process.env.QR_MAX_MS) || 3500
  : Number(process.env.QR_MAX_MS) || 9000;

let cachedZxingReader = null;
let cachedZxingHints = null;

function getZxingReader() {
  if (!cachedZxingReader) {
    cachedZxingHints = new Map();
    cachedZxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
    cachedZxingHints.set(DecodeHintType.TRY_HARDER, true);
    cachedZxingReader = new MultiFormatReader();
    cachedZxingReader.setHints(cachedZxingHints);
  }
  return cachedZxingReader;
}

function matchTelebirrInvoice(text) {
  const hit = String(text).match(/\b([A-Z]{2,3}[A-Z0-9]{7,8})\b/i)?.[1];
  return hit && TELEBIRR_INVOICE_RE.test(hit) ? hit.toUpperCase() : null;
}

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
      const exact = matchTelebirrInvoice(ascii);
      if (exact) return exact;
      if (/^[A-Z]{2,3}[A-Z0-9]{7,8}/i.test(ascii)) {
        return ascii.slice(0, 10).toUpperCase();
      }
      const telebirr = ascii.match(/^([A-Z]{2,3}[A-Z0-9]{7,8})(?=[^A-Z0-9]|$)/i);
      if (telebirr) return telebirr[1].toUpperCase();
    }
  }

  const direct = matchTelebirrInvoice(text);
  if (direct) return direct;

  const chunks = [text];
  if (/^[A-Za-z0-9+/=]+$/.test(text) && text.length > 16) {
    try {
      const decoded = Buffer.from(text, 'base64');
      chunks.push(decoded.toString('ascii'), decoded.toString('utf8'), decoded.toString('hex'));
    } catch {
      // ignore
    }
  }
  for (const chunk of chunks) {
    const hits = [...String(chunk).matchAll(/\b([A-Z]{2,3}[A-Z0-9]{7,8})\b/gi)];
    for (const hit of hits) {
      const normalized = matchTelebirrInvoice(hit[1]);
      if (normalized) return normalized;
    }
  }

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
    if (allDigits.length >= 9) {
      for (let i = 0; i <= allDigits.length - 9; i += 1) {
        const slice = allDigits.slice(i, i + 9);
        if (slice.startsWith('9') && /^\d{9}$/.test(slice)) {
          return `0${slice}`;
        }
      }
    }
  }

  return null;
}

export function extractCbeMbReceiptToken(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^v2-[A-Za-z0-9_-]{8,80}$/i.test(raw)) return raw;

  const hostPath = raw.match(/mbreciept\.cbe\.com\.et\/(?:receipt\/)?(v2-[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,80})/i);
  if (hostPath?.[1]) return hostPath[1];

  const urlMatch = raw.match(/[?&]id=([^&#\s]+)/i);
  if (urlMatch?.[1]) {
    try {
      const decoded = decodeURIComponent(urlMatch[1]);
      if (/^v2-[A-Za-z0-9_-]{8,80}$/i.test(decoded) || decoded.length >= 16) return decoded;
    } catch {
      return urlMatch[1];
    }
  }

  const tokenInPath = raw.match(/\/receipt\/([^/?#\s]+)/i);
  if (tokenInPath?.[1] && (/^v2-/i.test(tokenInPath[1]) || tokenInPath[1].length >= 16)) {
    return tokenInPath[1];
  }

  return null;
}

export function isCbeMbReceiptQrUrl(value) {
  if (!value) return false;
  const raw = String(value).trim();
  if (raw.startsWith('v2-') && raw.length >= 16) return true;
  return /mbreciept\.cbe\.com\.et/i.test(raw);
}

function parseTransactionFromQr(raw) {
  const telebirrInvoice = extractTelebirrInvoiceFromPayload(raw);
  if (telebirrInvoice) return telebirrInvoice;

  const boaTrx = raw.match(/[?&]trx=([A-Z0-9]+)/i);
  if (boaTrx?.[1]) return boaTrx[1].toUpperCase();

  const cbeUrl = raw.match(/https?:\/\/[^\s]+/i);
  if (cbeUrl) {
    const idParam = cbeUrl[0].match(/[?&]id=([^&#]+)/i);
    if (idParam?.[1]) return idParam[1];
  }

  const parts = raw.split(/[:;,|]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (/^[A-Z0-9]{8,20}$/.test(trimmed) && !/^\d+$/.test(trimmed)) {
      return trimmed.toUpperCase();
    }
  }

  const txMatch = raw.match(/\b([A-Z0-9]{8,20})\b/);
  return txMatch ? txMatch[1].toUpperCase() : null;
}

export function parseQrPayload(raw) {
  if (!raw) return null;
  const text = raw.trim();

  const telebirrInvoice = extractTelebirrInvoiceFromPayload(text);
  if (telebirrInvoice) {
    return {
      transactionCode: telebirrInvoice,
      verificationUrl: /^https?:\/\//i.test(text) ? text : null,
      verificationToken: null,
      dashenReference: null,
      dashenReceiptToken: null,
    };
  }

  const cbeToken = extractCbeMbReceiptToken(text);
  if (cbeToken || isCbeMbReceiptQrUrl(text)) {
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
  const luminance = new Uint8ClampedArray(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    luminance[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
  }
  return { luminance, width, height };
}

function scanJsQR(bitmap, inversionAttempts = 'dontInvert') {
  const { data, width, height } = bitmap;
  const raw = jsQRRaw;
  const fn = (typeof raw === 'function' ? raw : null)
    || (typeof raw?.default === 'function' ? raw.default : null)
    || (typeof raw?.jsQR === 'function' ? raw.jsQR : null)
    || (typeof jsQR === 'function' ? jsQR : null);
  if (!fn) {
    return null;
  }
  try {
    return fn(new Uint8ClampedArray(data), width, height, { inversionAttempts });
  } catch {
    return null;
  }
}

function scanZXingFromLuminance(luminance, width, height, Binarizer = HybridBinarizer) {
  const source = new RGBLuminanceSource(luminance, width, height);
  const binaryBitmap = new BinaryBitmap(new Binarizer(source));
  try {
    return getZxingReader().decode(binaryBitmap).getText();
  } catch {
    return null;
  }
}

function scanBitmap(bitmap) {
  if (!bitmap?.data || !bitmap.width || !bitmap.height) return null;

  const jsResult = scanJsQR(bitmap, 'dontInvert') || scanJsQR(bitmap, 'attemptBoth');
  if (jsResult?.data) return jsResult.data;

  if (IS_WORKERS) return null;

  const { luminance, width, height } = luminanceFromBitmap(bitmap);
  const zxingHybrid = scanZXingFromLuminance(luminance, width, height, HybridBinarizer);
  if (zxingHybrid) return zxingHybrid;

  return scanZXingFromLuminance(luminance, width, height, GlobalHistogramBinarizer);
}

function cropBitmap(bitmap, x, y, w, h) {
  const srcW = bitmap.width;
  const out = new Uint8ClampedArray(w * h * 4);
  const srcData = bitmap.data;
  for (let row = 0; row < h; row++) {
    const srcIdx = ((y + row) * srcW + x) * 4;
    const dstIdx = row * w * 4;
    out.set(srcData.subarray(srcIdx, srcIdx + w * 4), dstIdx);
  }
  return { data: out, width: w, height: h };
}

export function decodeImageToBitmap(buffer) {
  if (!buffer || buffer.length === 0) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  try {
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      const raw = jpeg.decode(buf, { useTArray: true });
      return { data: raw.data, width: raw.width, height: raw.height };
    }
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const png = PNG.sync.read(buf);
      return { data: png.data, width: png.width, height: png.height };
    }
    try {
      const raw = jpeg.decode(buf, { useTArray: true });
      return { data: raw.data, width: raw.width, height: raw.height };
    } catch {}
    const png = PNG.sync.read(buf);
    return { data: png.data, width: png.width, height: png.height };
  } catch (err) {
    console.warn('[Image Decode] Fast decode failed:', err.message);
    return null;
  }
}

function scaleBitmap(bitmap, factor) {
  if (factor === 1 || !factor || factor <= 0) return bitmap;
  const newW = Math.max(1, Math.round(bitmap.width * factor));
  const newH = Math.max(1, Math.round(bitmap.height * factor));
  const out = new Uint8ClampedArray(newW * newH * 4);
  const src = bitmap.data;
  const srcW = bitmap.width;

  for (let y = 0; y < newH; y += 1) {
    const srcY = Math.min(bitmap.height - 1, Math.floor(y / factor));
    for (let x = 0; x < newW; x += 1) {
      const srcX = Math.min(srcW - 1, Math.floor(x / factor));
      const srcIdx = (srcY * srcW + srcX) * 4;
      const dstIdx = (y * newW + x) * 4;
      out[dstIdx] = src[srcIdx];
      out[dstIdx + 1] = src[srcIdx + 1];
      out[dstIdx + 2] = src[srcIdx + 2];
      out[dstIdx + 3] = src[srcIdx + 3];
    }
  }
  return { data: out, width: newW, height: newH };
}

function greyscaleBitmap(bitmap) {
  const out = {
    data: new Uint8ClampedArray(bitmap.data),
    width: bitmap.width,
    height: bitmap.height,
  };
  for (let i = 0; i < out.data.length; i += 4) {
    const lum = (out.data[i] * 0.299 + out.data[i + 1] * 0.587 + out.data[i + 2] * 0.114) | 0;
    out.data[i] = out.data[i + 1] = out.data[i + 2] = lum;
  }
  return out;
}

function invertBitmap(bitmap) {
  const out = {
    data: new Uint8ClampedArray(bitmap.data),
    width: bitmap.width,
    height: bitmap.height,
  };
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = 255 - out.data[i];
    out.data[i + 1] = 255 - out.data[i + 1];
    out.data[i + 2] = 255 - out.data[i + 2];
  }
  return out;
}

function createLightBitmapWrapper(initialBitmap) {
  const createWrapper = (b) => ({
    bitmap: b,
    clone() {
      return createWrapper({
        data: new Uint8ClampedArray(b.data),
        width: b.width,
        height: b.height,
      });
    },
    crop({ x = 0, y = 0, w = b.width, h = b.height } = {}) {
      return createWrapper(cropBitmap(
        b,
        Math.max(0, Math.floor(x)),
        Math.max(0, Math.floor(y)),
        Math.min(b.width, Math.floor(w)),
        Math.min(b.height, Math.floor(h)),
      ));
    },
    scale(factor) {
      return createWrapper(scaleBitmap(b, factor));
    },
    greyscale() {
      return createWrapper(greyscaleBitmap(b));
    },
    invert() {
      return createWrapper(invertBitmap(b));
    },
  });

  return createWrapper(initialBitmap);
}

async function prepareQrScanImageLight(buffer) {
  let bitmap = decodeImageToBitmap(buffer);
  if (!bitmap) return null;

  const maxDim = Math.max(bitmap.width, bitmap.height);
  if (maxDim > QR_SCAN_MAX_DIM) {
    bitmap = scaleBitmap(bitmap, QR_SCAN_MAX_DIM / maxDim);
  }

  return createLightBitmapWrapper(bitmap);
}

async function prepareQrScanImageJimp(buffer) {
  let image = await Jimp.read(buffer);
  const { width, height } = image.bitmap;
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);

  if (maxDim > QR_SCAN_MAX_DIM) {
    image = image.clone().scale(QR_SCAN_MAX_DIM / maxDim);
  } else if (minDim < QR_SCAN_MIN_DIM) {
    const factor = Math.min(Math.max(QR_SCAN_MIN_DIM / minDim, 400 / width, 400 / height, 1), 3);
    image = image.clone().scale(factor);
  }

  return image;
}

/** Normalize image size for QR passes — Jimp on Node, lightweight decoder on Workers. */
export async function prepareQrScanImage(buffer) {
  if (IS_WORKERS) {
    return prepareQrScanImageLight(buffer);
  }
  return prepareQrScanImageJimp(buffer);
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

function* iterScanVariants(image) {
  const { width, height } = image.bitmap;
  const bottomY = Math.floor(height * 0.42);
  const bottomH = height - bottomY;
  const bottom55 = Math.floor(height * 0.55);
  const midY = Math.floor(height * 0.35);

  const variants = [
    image,
    image.clone().scale(2),
    image.clone().scale(3),
    image.clone().crop({ x: 0, y: bottom55, w: width, h: height - bottom55 }).scale(2),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).scale(2),
    image.clone().greyscale().scale(2),
    image.clone().crop({ x: 0, y: midY, w: width, h: height - midY }).scale(3),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).scale(3),
    image.clone().crop({ x: 0, y: bottom55, w: width, h: height - bottom55 }).scale(3),
    image.clone().greyscale().scale(3),
    image.clone().crop({ x: 0, y: bottom55, w: width, h: height - bottom55 }).greyscale().invert().scale(4),
    image.clone().crop({ x: Math.floor(width * 0.05), y: bottom55, w: Math.floor(width * 0.9), h: height - bottom55 }).greyscale().invert().scale(4),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).greyscale().scale(4),
  ];

  const cap = IS_WORKERS ? WORKERS_QR_VARIANT_CAP : variants.length;
  for (let i = 0; i < cap; i += 1) {
    yield variants[i];
  }
}

function quickScanLight(image, shouldStop = () => false, validate = () => true) {
  if (!image?.bitmap) return null;
  const direct = scanBitmap(image.bitmap);
  if (direct && validate(direct)) return direct;

  const { width, height } = image.bitmap;
  const midY = Math.floor(height * 0.18);
  const midH = Math.floor(height * 0.64);
  const midCrop = cropBitmap(image.bitmap, 0, midY, width, midH);
  const hitMid = scanBitmap(midCrop);
  if (hitMid && validate(hitMid)) return hitMid;

  if (shouldStop()) return null;

  const bottomY = Math.floor(height * 0.50);
  const bottomH = height - bottomY;
  const bottomCrop = cropBitmap(image.bitmap, 0, bottomY, width, bottomH);
  const hitBottom = scanBitmap(bottomCrop);
  if (hitBottom && validate(hitBottom)) return hitBottom;

  return null;
}

function quickScan(image, shouldStop = () => false, validate = () => true) {
  if (IS_WORKERS) {
    return quickScanLight(image, shouldStop, validate);
  }

  for (const variant of iterScanVariants(image)) {
    if (shouldStop()) break;
    const data = scanBitmap(variant.bitmap);
    if (data && validate(data)) return data;
  }
  return null;
}

export function scanImageForQr(image, shouldStop = () => false) {
  return quickScan(image, shouldStop);
}

export function scanImageForQrValidated(image, shouldStop = () => false, validate = () => true) {
  return quickScan(image, shouldStop, validate);
}

/** Shared bitmap decoder for bank-specific QR scanners (jsQR + ZXing). */
export function scanBitmapForData(bitmap) {
  return scanBitmap(bitmap);
}

export { buildQrDataFromRaw };

export async function decodeQrFromBuffer(buffer, { maxMs = DEFAULT_QR_MAX_MS, image: preparedImage = null } = {}) {
  try {
    const image = preparedImage || await prepareQrScanImage(buffer);
    if (!image) return buildQrDataFromRaw(null);
    const deadline = Date.now() + maxMs;
    const data = quickScan(image, () => Date.now() >= deadline);
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
