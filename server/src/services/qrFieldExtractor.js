import {
  extractTelebirrInvoiceFromPayload,
  extractPhoneFromQrPayload,
} from './qrService.js';
import { normalizeTxCode } from '../utils/txCode.js';

function getDecodedChunks(qrData) {
  const chunks = [];
  const raw = qrData?.raw;
  if (!raw) return chunks;

  chunks.push(String(raw));

  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length > 16) {
    try {
      const ascii = Buffer.from(raw, 'base64').toString('ascii');
      if (ascii) chunks.push(ascii);
    } catch {
      // ignore
    }
  }

  if (qrData?.decodedPayload) chunks.push(String(qrData.decodedPayload));
  return [...new Set(chunks)];
}

function parseAmount(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

export function extractAmountFromPayloadText(text) {
  if (!text) return null;

  const etbPatterns = [
    /ETB\s*([\d,]+\.?\d*)/gi,
    /([\d,]+\.\d{2})\s*ETB/gi,
    /amount[^\d]{0,20}([\d,]+\.?\d{2})/gi,
    /settled[^\d]{0,20}([\d,]+\.?\d{2})/gi,
  ];

  for (const pattern of etbPatterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      const amt = parseAmount(match[1]);
      if (amt) return amt;
    }
  }

  const decimals = [...String(text).matchAll(/\b(\d{1,7}\.\d{2})\b/g)]
    .map((m) => parseAmount(m[1]))
    .filter((a) => a && a < 1_000_000);

  return decimals[0] ?? null;
}

function extractNameFromPayloadText(text, kind = 'receiver') {
  if (!text) return null;
  const label = kind === 'receiver'
    ? /(?:credited party|receiver|recipient|to)[:\s]+([A-Za-z][A-Za-z\s'.-]{2,60})/i
    : /(?:payer|sender|from|debited)[:\s]+([A-Za-z][A-Za-z\s'.-]{2,60})/i;
  const match = text.match(label);
  return match?.[1]?.trim() || null;
}

/**
 * Best-effort structured fields from authentic bank QR payloads.
 */
export function extractQrReceiptFields(method, qrData) {
  const fields = {
    transactionCode: normalizeTxCode(qrData?.transactionCode),
    amount: null,
    senderName: null,
    senderAccount: null,
    receiverName: null,
    receiverAccount: null,
    verificationUrl: qrData?.verificationUrl || null,
    verificationToken: qrData?.verificationToken || null,
  };

  if (!qrData?.raw) return fields;

  const chunks = getDecodedChunks(qrData);

  if (method === 'telebirr') {
    fields.transactionCode = fields.transactionCode
      || normalizeTxCode(extractTelebirrInvoiceFromPayload(qrData.raw));
    fields.receiverAccount = extractPhoneFromQrPayload(qrData);

    for (const chunk of chunks) {
      fields.amount = fields.amount || extractAmountFromPayloadText(chunk);
      fields.receiverName = fields.receiverName || extractNameFromPayloadText(chunk, 'receiver');
      fields.senderName = fields.senderName || extractNameFromPayloadText(chunk, 'sender');
      fields.senderAccount = fields.senderAccount || extractPhoneFromQrPayload({ raw: chunk, decodedPayload: chunk });
    }
  }

  if (method === 'cbe') {
    for (const chunk of chunks) {
      const ft = chunk.match(/\b(FT[A-Z0-9]{8,14})\b/i);
      if (ft) fields.transactionCode = normalizeTxCode(ft[1]);
      fields.amount = fields.amount || extractAmountFromPayloadText(chunk);
      fields.receiverName = fields.receiverName || extractNameFromPayloadText(chunk, 'receiver');
      fields.receiverAccount = fields.receiverAccount || chunk.match(/\b(1\d{11,14})\b/)?.[1] || null;
    }
  }

  if (method === 'dashen') {
    fields.verificationUrl = qrData?.verificationUrl || fields.verificationUrl;
    fields.dashenReceiptToken = qrData?.dashenReceiptToken || null;
    
    for (const chunk of chunks) {
      // Extract amount - simple numeric extraction
      if (!fields.amount) {
        const amount = extractAmountFromPayloadText(chunk);
        if (amount) fields.amount = amount;
      }

      // Extract Dashen transaction reference (pattern: 110IPSS2616900WO)
      if (!fields.transactionCode) {
        const dashenRef = chunk.match(/\b(\d{2,3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i);
        if (dashenRef) {
          fields.transactionCode = normalizeTxCode(dashenRef[1]);
        }
      }

      // Extract sender/receiver from labeled fields
      fields.receiverName = fields.receiverName || extractNameFromPayloadText(chunk, 'receiver');
      fields.receiverAccount = fields.receiverAccount
        || chunk.match(/receiver\s*account[^\d]{0,20}([0-9*]+)/i)?.[1]
        || chunk.match(/\b(1\d{11,14})\b/)?.[1]
        || null;
      
      fields.senderName = fields.senderName || extractNameFromPayloadText(chunk, 'sender');
      fields.senderAccount = fields.senderAccount
        || chunk.match(/sender\s*account[^\d]{0,20}([0-9*]+)/i)?.[1]
        || null;
    }
  }

  if (method === 'boa') {
    for (const chunk of chunks) {
      fields.amount = fields.amount || extractAmountFromPayloadText(chunk);
      fields.transactionCode = fields.transactionCode
        || normalizeTxCode(chunk.match(/[?&]trx=([A-Z0-9]+)/i)?.[1])
        || normalizeTxCode(chunk.match(/\b(FT[A-Z0-9]{8,14})\b/i)?.[1]);
      fields.receiverName = fields.receiverName || extractNameFromPayloadText(chunk, 'receiver');
      fields.receiverAccount = fields.receiverAccount || chunk.match(/\b(1\d{11,14})\b/)?.[1] || null;
      fields.senderName = fields.senderName || extractNameFromPayloadText(chunk, 'sender');
    }
  }

  if (fields.amount != null) fields.amount = String(fields.amount);
  return fields;
}

/** True when QR fields were loaded from an official bank source (API, PDF, decrypt, web). */
export function hasOfficialQrTruth(qrFields) {
  return Boolean(
    qrFields?.telebirrApiSource
    || qrFields?.cbeApiSource
    || qrFields?.dashenApiSource
    || qrFields?.boaApiSource
    || qrFields?.boaQrDecrypted,
  );
}

export function detectScreenshotCropped({
  extracted,
  qrTx,
  screenshotTx,
  qrAuthentic,
  qrFields,
}) {
  if (!qrAuthentic) return false;

  if (screenshotTx && qrTx) {
    const s = normalizeTxCode(screenshotTx);
    const q = normalizeTxCode(qrTx);
    if (s && q && s !== q && (q.startsWith(s) || s.startsWith(q))) return true;
  }

  if (qrTx && !screenshotTx && !extracted?.transactionCode) {
    if (/^SUPERAPPRECEIPT_/i.test(normalizeTxCode(qrTx))) return false;
    return true;
  }

  if (extracted?.amount == null && qrFields?.amount) return true;

  if (!extracted?.senderName && qrFields?.senderName) return true;
  if (!extracted?.senderAccount && qrFields?.senderAccount) return true;

  return false;
}

export function mergeReceiptSources({ extracted, qrFields, form, preferQr = false }) {
  const pick = (qrVal, shotVal, formVal) => {
    const q = qrVal == null || qrVal === '' ? null : qrVal;
    const s = shotVal == null || shotVal === '' ? null : shotVal;
    const f = formVal == null || formVal === '' ? null : formVal;
    if (preferQr) return q ?? s ?? f ?? '';
    if (q && !s) return q;
    return s ?? q ?? f ?? '';
  };

  return {
    senderName: pick(qrFields?.senderName, extracted?.senderName, form?.senderName),
    senderAccount: pick(qrFields?.senderAccount, extracted?.senderAccount, form?.senderAccount),
    receiverName: pick(qrFields?.receiverName, extracted?.receiverName, form?.receiverName),
    receiverAccount: pick(qrFields?.receiverAccount, extracted?.receiverAccount, form?.receiverAccount),
    amount: pick(qrFields?.amount, extracted?.amount != null ? String(extracted.amount) : null, form?.amount != null ? String(form.amount) : null),
    transactionCode: pick(qrFields?.transactionCode, extracted?.transactionCode, form?.transactionCode),
  };
}
