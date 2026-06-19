import { PDFParse } from 'pdf-parse';
import { normalizeTxCode } from '../utils/txCode.js';

const DETAIL_LABELS = new Set([
  'Transaction Amount',
  'Service Charge',
  'Excise Tax (15%)',
  'DRRF Fee',
  'VAT (15%)',
  'Penalty Fee',
  'Income Tax Fee',
  'Tax',
  'Interest Fee',
  'Stamp Duty',
  'Discount Amount',
  'Total',
]);

const HEADER_STOP_LINES = new Set([
  'Dashen Bank',
  'Transaction Details',
  'Terms & Conditions',
  'For any support: please call us at',
  'Dashen Bank S.C.',
  'Always One Step Ahead!',
]);

function parseAmount(value) {
  if (!value) return null;
  const cleaned = String(value).replace(/ETB/gi, '').replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return Number.isNaN(n) || n < 0 ? null : n;
}

function snakeCaseLabel(label) {
  return label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[()%]/g, '').replace(/%/g, '');
}

function extractFieldsFromLines(lines) {
  const fields = {};
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (lower.startsWith('amount in words')) {
      const inline = line.includes(':') ? line.split(':').slice(1).join(':').trim() : '';
      const valueLines = inline ? [inline] : [];
      i += 1;
      while (i < lines.length) {
        const nxt = lines[i];
        if (nxt.endsWith(':') || DETAIL_LABELS.has(nxt) || nxt.startsWith('ETB') || HEADER_STOP_LINES.has(nxt)) break;
        valueLines.push(nxt);
        i += 1;
      }
      fields.amount_in_words = valueLines.join(' ').trim();
      continue;
    }

    let matchedDetail = false;
    for (const label of DETAIL_LABELS) {
      if (line === label && i + 1 < lines.length && lines[i + 1].startsWith('ETB')) {
        fields[snakeCaseLabel(label)] = lines[i + 1];
        i += 2;
        matchedDetail = true;
        break;
      }
      const tabbed = line.match(new RegExp(`^${label.replace(/[()]/g, '\\$&')}\\s+ETB\\s+(.+)$`, 'i'));
      if (tabbed?.[1]) {
        fields[snakeCaseLabel(label)] = `ETB ${tabbed[1].trim()}`;
        i += 1;
        matchedDetail = true;
        break;
      }
    }
    if (matchedDetail) continue;

    if (line.endsWith(':')) {
      const rawKey = line.slice(0, -1).trim().toLowerCase().replace(/\s+/g, '_').replace(/\./g, '');
      const valueLines = [];
      i += 1;
      while (i < lines.length) {
        const nxt = lines[i];
        if (
          nxt.endsWith(':')
          || DETAIL_LABELS.has(nxt)
          || nxt.toLowerCase().startsWith('amount in words')
          || HEADER_STOP_LINES.has(nxt)
        ) break;
        valueLines.push(nxt);
        i += 1;
      }
      fields[rawKey] = valueLines.join(' ').trim();
      continue;
    }

    const inlineHeader = line.match(/^([A-Za-z][A-Za-z\s.()%-]+):\s*(.+)$/);
    if (inlineHeader) {
      const rawKey = inlineHeader[1].trim().toLowerCase().replace(/\s+/g, '_').replace(/\./g, '');
      fields[rawKey] = inlineHeader[2].trim();
      i += 1;
      continue;
    }

    i += 1;
  }

  return fields;
}

function mapDashenFields(rawFields) {
  const txRef = rawFields.transaction_reference || rawFields.transaction_ref;
  const amount = parseAmount(rawFields.transaction_amount);
  if (!txRef || amount == null) return null;

  return {
    transactionCode: normalizeTxCode(txRef),
    amount: String(amount),
    senderName: rawFields.sender_name || null,
    senderAccount: rawFields.sender_account_number || null,
    receiverName: rawFields.receiver_name || null,
    receiverAccount: rawFields.receiver_account_number || null,
    source: 'dashen_official_pdf',
  };
}

const DASHEN_REF_PATTERN = /\b(\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i;

export function extractDashenReferenceFromText(...parts) {
  for (const part of parts) {
    if (!part) continue;
    const match = String(part).match(DASHEN_REF_PATTERN);
    if (match?.[1]) return normalizeTxCode(match[1]);
  }
  return null;
}

export function extractDashenReferenceFromQr(qrData) {
  const raw = String(qrData?.raw || '').trim();
  if (!raw) return null;

  const urlMatch = raw.match(/receipt\.dashensuperapp\.com\/receipt\/([A-Z0-9]+)/i);
  if (urlMatch?.[1] && !urlMatch[1].startsWith('superappreceipt')) {
    return normalizeTxCode(urlMatch[1]);
  }

  const refMatch = raw.match(/\b(\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,})\b/i);
  if (refMatch?.[1]) return normalizeTxCode(refMatch[1]);

  return normalizeTxCode(qrData?.dashenReference);
}

export async function parseDashenPdfBuffer(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const textResult = await parser.getText();
    const lines = String(textResult.text || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return mapDashenFields(extractFieldsFromLines(lines));
  } finally {
    await parser.destroy();
  }
}

export async function fetchDashenTransactionByReference(reference) {
  const ref = normalizeTxCode(reference);
  if (!ref) return null;

  const url = `https://receipt.dashensuperapp.com/receipt/${ref}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/pdf,*/*',
      },
    });

    if (!response.ok) {
      console.warn('[Dashen PDF] HTTP', response.status, 'for', ref);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!contentType.includes('pdf') && buffer.slice(0, 4).toString() !== '%PDF') {
      console.warn('[Dashen PDF] Non-PDF response for', ref);
      return null;
    }

    return parseDashenPdfBuffer(buffer);
  } catch (err) {
    console.warn('[Dashen PDF]', err.message);
    return null;
  }
}

export async function fetchDashenTransactionFromQr(qrData, { screenshotReference = null } = {}) {
  const reference = extractDashenReferenceFromQr(qrData)
    || extractDashenReferenceFromText(screenshotReference);

  if (!reference) return null;
  return fetchDashenTransactionByReference(reference);
}

/**
 * When the QR image is too small/blurry to scan (common on VAT receipts),
 * confirm the payment via the official Dashen PDF using the transaction reference
 * visible on the screenshot.
 */
export async function resolveDashenQrData(qrData, extracted) {
  if (qrData?.raw) return qrData;

  const reference = extractDashenReferenceFromText(
    extracted?.transactionCode,
    extracted?.senderName,
    extracted?.receiverName,
    JSON.stringify(extracted ?? {}),
  );
  if (!reference) return qrData;

  const official = await fetchDashenTransactionByReference(reference);
  if (!official) return qrData;

  const url = `https://receipt.dashensuperapp.com/receipt/${reference}`;
  console.log('[Dashen] QR unreadable — verified via official receipt PDF:', reference);

  return {
    raw: url,
    transactionCode: reference,
    verificationUrl: url,
    verificationToken: null,
    dashenReference: reference,
    dashenReceiptToken: null,
    decodedPayload: url,
    officialReceiptFallback: true,
    officialFields: official,
  };
}

export function mergeDashenApiIntoQrFields(qrFields, dashenFields) {
  if (!dashenFields) return qrFields;

  return {
    ...qrFields,
    transactionCode: dashenFields.transactionCode || qrFields.transactionCode,
    amount: dashenFields.amount || qrFields.amount,
    senderName: dashenFields.senderName || qrFields.senderName,
    senderAccount: dashenFields.senderAccount || qrFields.senderAccount,
    receiverName: dashenFields.receiverName || qrFields.receiverName,
    receiverAccount: dashenFields.receiverAccount || qrFields.receiverAccount,
    dashenApiSource: true,
  };
}
