import { PDFParse } from 'pdf-parse';
import { normalizeTxCode } from '../utils/txCode.js';
import { extractCbeMbReceiptToken } from './qrService.js';

const CBE_RECEIPT_BASE = 'https://apps.cbe.com.et:100/?id=';

const CBE_API_HEADERS = {
  'X-App-ID': 'd1292e42-7400-49de-a2d3-9731caa4c819',
  'X-App-Version': '0a01980b-9859-1369-8198-59f403820000',
};

function mapCbeApiResponse(data) {
  if (!data?.id) return null;

  const amount = parseFloat(data.amountCredited ?? data.amountDebited);
  return {
    transactionCode: normalizeTxCode(data.id),
    amount: Number.isNaN(amount) || amount <= 0 ? null : String(amount),
    senderName: data.debitAccountHolder || null,
    senderAccount: data.debitAccountNo || null,
    receiverName: data.creditAccountHolder || null,
    receiverAccount: data.creditAccountNo || null,
    source: 'cbe_official_api',
  };
}

export async function fetchCbeTransactionFromQr(qrData) {
  const token = qrData?.verificationToken
    || extractCbeMbReceiptToken(qrData?.raw)
    || extractCbeMbReceiptToken(qrData?.verificationUrl);
  if (!token) return null;

  const url = `https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/${token}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: CBE_API_HEADERS,
    });

    if (!response.ok) {
      console.warn('[CBE API] HTTP', response.status, 'for token', token);
      return null;
    }

    const data = await response.json();
    return mapCbeApiResponse(data);
  } catch (err) {
    console.warn('[CBE API]', err.message);
    return null;
  }
}

function parseCbeAmount(raw) {
  if (!raw) return null;
  const n = parseFloat(String(raw).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function mapCbePdfFields({ transactionCode, amount, senderName, senderAccount, receiverName, receiverAccount }) {
  const tx = normalizeTxCode(transactionCode);
  const amt = parseCbeAmount(amount);
  if (!tx || !amt) return null;
  return {
    transactionCode: tx,
    amount: String(amt),
    senderName: senderName || null,
    senderAccount: senderAccount || null,
    receiverName: receiverName || null,
    receiverAccount: receiverAccount || null,
    source: 'cbe_official_pdf',
  };
}

function parseCbePdfText(text) {
  const blob = String(text || '');
  const inline = blob.replace(/\s+/g, ' ');

  const transactionCode = inline.match(/(?:Transaction\s+Reference|Transaction\s+ID|Reference\s+No\.?)\s*[:.]?\s*(FT[A-Z0-9]+)/i)?.[1]
    || blob.match(/\b(FT[A-Z0-9]{10,})\b/i)?.[1];
  const amount = inline.match(/(?:Transferred\s+Amount|Transaction\s+Amount|Amount\s+Transferred)\s*[:.]?\s*(?:ETB\s*)?([\d,]+\.?\d*)/i)?.[1]
    || blob.match(/ETB\s*([\d,]+\.?\d*)/i)?.[1];
  const senderName = inline.match(/(?:Customer\s+Name|Payer(?:'s)?\s+Name)\s*[:.]?\s*([A-Za-z][A-Za-z\s]{1,60})/i)?.[1]?.trim();
  const senderAccount = inline.match(/(?:Payer(?:'s)?\s+Account|Debit\s+Account|From\s+Account)\s*[:.]?\s*([\d\*xX]{4,20})/i)?.[1]
    || blob.match(/Account\s+([\d\*xX]{8,20})/i)?.[1];
  const receiverName = inline.match(/(?:Receiver(?:'s)?\s+Name|Beneficiary\s+Name|Credited\s+Party)\s*[:.]?\s*([A-Za-z][A-Za-z\s]{1,60})/i)?.[1]?.trim();
  const receiverAccount = inline.match(/(?:Receiver(?:'s)?\s+Account|Beneficiary\s+Account|Credit\s+Account)\s*[:.]?\s*([\d\*xX]{4,20})/i)?.[1];

  return mapCbePdfFields({
    transactionCode,
    amount,
    senderName,
    senderAccount,
    receiverName,
    receiverAccount,
  });
}

async function parseCbePdfBuffer(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText();
    return parseCbePdfText(textResult.text || '');
  } finally {
    await parser.destroy();
  }
}

/** Reference-only CBE verify: FT + last 8 digits of payer account (apps.cbe.com.et PDF). */
export async function fetchCbeTransactionByReference(ftNumber, accountSuffix) {
  const ft = normalizeTxCode(ftNumber);
  const digits = String(accountSuffix || '').replace(/\D/g, '');
  if (!ft || !/^FT[A-Z0-9]{8,}$/i.test(ft) || digits.length < 8) return null;

  const last8 = digits.slice(-8);
  const url = `${CBE_RECEIPT_BASE}${encodeURIComponent(`${ft}${last8}`)}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        Accept: 'application/pdf,*/*',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      console.warn('[CBE PDF] HTTP', response.status, ft);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.slice(0, 4).toString() !== '%PDF') {
      console.warn('[CBE PDF] Non-PDF response for', ft);
      return null;
    }

    return parseCbePdfBuffer(buffer);
  } catch (err) {
    console.warn('[CBE PDF] fetch failed:', err.message);
    return null;
  }
}

export function mergeCbeApiIntoQrFields(qrFields, cbeApiFields) {
  if (!cbeApiFields) return qrFields;

  return {
    ...qrFields,
    transactionCode: cbeApiFields.transactionCode || qrFields.transactionCode,
    amount: cbeApiFields.amount || qrFields.amount,
    senderName: cbeApiFields.senderName || qrFields.senderName,
    senderAccount: cbeApiFields.senderAccount || qrFields.senderAccount,
    receiverName: cbeApiFields.receiverName || qrFields.receiverName,
    receiverAccount: cbeApiFields.receiverAccount || qrFields.receiverAccount,
    cbeApiSource: true,
  };
}
