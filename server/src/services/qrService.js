import fs from 'fs/promises';
import { Jimp } from 'jimp';
import jsQR from 'jsqr';

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
      if (/^DFC[A-Z0-9]{7}/i.test(ascii)) {
        return ascii.slice(0, 10).toUpperCase();
      }
      const telebirr = ascii.match(/^(DFC[A-Z0-9]{7})(?=[a-z]|[^A-Za-z0-9]|$)/i);
      if (telebirr) return telebirr[1].toUpperCase();
      const inv = ascii.match(/^([A-Z]{2,4}[A-Z0-9]{6,10})(?=[a-z]|[^A-Za-z0-9]|$)/i);
      if (inv) return inv[1].toUpperCase();
    }
  }

  const direct = text.match(/\b(DFC[A-Z0-9]{6,14})\b/i)
    || text.match(/\b([A-Z]{2,4}[A-Z0-9]{6,14})\b/);
  if (direct) return direct[1].toUpperCase();

  return null;
}

export function parseTransactionFromQr(qrText) {
  if (!qrText || typeof qrText !== 'string') return null;

  const trimmed = qrText.trim();

  // CBE QR encodes an official verification URL — FT reference is on the receipt text.
  if (/^https?:\/\/mbreciept\.cbe\.com\.et\/v2-/i.test(trimmed)) {
    return null;
  }

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
    /\b(\d{3}IPSS[A-Z0-9]{10,})\b/i,
    /\b(IPSS\d+[A-Z0-9]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }

  if (trimmed.startsWith('http')) return null;

  return trimmed.length >= 8 && trimmed.length <= 32 ? trimmed.toUpperCase() : null;
}

export function parseQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) {
    return { transactionCode: null, verificationUrl: null, verificationToken: null };
  }

  const cbeMatch = text.match(/^https?:\/\/mbreciept\.cbe\.com\.et\/(v2-[a-z0-9]+)/i);
  if (cbeMatch) {
    return {
      transactionCode: null,
      verificationUrl: text,
      verificationToken: cbeMatch[1],
    };
  }

  return {
    transactionCode: parseTransactionFromQr(text),
    verificationUrl: /^https?:\/\//i.test(text) ? text : null,
    verificationToken: null,
  };
}

function scanBitmap(bitmap) {
  const { data, width, height } = bitmap;
  return jsQR(new Uint8ClampedArray(data), width, height);
}

async function buildScanVariants(image) {
  const { width, height } = image.bitmap;
  const bottomY = Math.floor(height * 0.42);
  const bottomH = height - bottomY;

  return [
    image.clone().scale(2),
    image.clone().scale(3),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).scale(2),
    image.clone().crop({ x: 0, y: bottomY, w: width, h: bottomH }).scale(3),
    image.clone().contrast(0.25).scale(2),
    image.clone().greyscale().scale(2),
  ];
}

export async function decodeQrFromImage(imagePath) {
  try {
    const buffer = await fs.readFile(imagePath);
    const image = await Jimp.read(buffer);
    const variants = await buildScanVariants(image);

    for (const variant of variants) {
      const code = scanBitmap(variant.bitmap);
      if (!code?.data) continue;

      const parsed = parseQrPayload(code.data);
      return {
        raw: code.data,
        transactionCode: parsed.transactionCode,
        verificationUrl: parsed.verificationUrl,
        verificationToken: parsed.verificationToken,
        decodedPayload: extractTelebirrInvoiceFromPayload(code.data)
          ? Buffer.from(code.data, 'base64').toString('ascii')
          : code.data,
      };
    }

    return {
      raw: null,
      transactionCode: null,
      verificationUrl: null,
      verificationToken: null,
      decodedPayload: null,
    };
  } catch {
    return {
      raw: null,
      transactionCode: null,
      verificationUrl: null,
      verificationToken: null,
      decodedPayload: null,
    };
  }
}
