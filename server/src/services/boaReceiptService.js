import { normalizeTxCode } from '../utils/txCode.js';

const BOA_FIELD_MAP = {
  "Transaction Reference": 'transactionCode',
  "Payer's Name": 'senderName',
  'Source Account Name': 'senderName',
  'Source Account': 'senderAccount',
  "Payer's Account": 'senderAccount',
  "Receiver's Name": 'receiverName',
  'Beneficiary Name': 'receiverName',
  "Receiver's Account": 'receiverAccount',
  'Beneficiary Account': 'receiverAccount',
  'Transferred Amount': 'amount',
};

function parseAmount(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function mapBoaApiBody(body) {
  if (!body || typeof body !== 'object') return null;

  const payerName = body["Payer's Name"] || body['Source Account Name'];
  if (typeof payerName === 'string' && /invalid reference/i.test(payerName)) {
    return null;
  }

  const mapped = {
    transactionCode: null,
    amount: null,
    senderName: null,
    senderAccount: null,
    receiverName: null,
    receiverAccount: null,
    source: 'boa_official_api',
  };

  for (const [rawKey, target] of Object.entries(BOA_FIELD_MAP)) {
    const val = body[rawKey];
    if (val == null || val === '') continue;
    if (target === 'amount') {
      const amt = parseAmount(val);
      if (amt != null) mapped.amount = String(amt);
    } else if (target === 'transactionCode') {
      mapped.transactionCode = normalizeTxCode(val);
    } else {
      mapped[target] = String(val).trim();
    }
  }

  if (!mapped.transactionCode || !mapped.amount) return null;
  return mapped;
}

export function extractBoaReferenceFromQr(qrData) {
  const raw = String(qrData?.raw || '').trim();
  if (!raw) return null;

  const urlMatch = raw.match(/[?&]trx=([A-Z0-9]+)/i)
    || raw.match(/bankofabyssinia\.com\/[^?]*\?[^#]*trx=([A-Z0-9]+)/i);
  if (urlMatch?.[1]) return normalizeTxCode(urlMatch[1]);

  const ft = raw.match(/\b(FT[A-Z0-9]{8,14})\b/i);
  if (ft?.[1]) return normalizeTxCode(ft[1]);

  return normalizeTxCode(qrData?.transactionCode);
}

function accountSuffix(account) {
  const digits = String(account || '').replace(/\D/g, '');
  if (digits.length >= 5) return digits.slice(-5);
  return '';
}

export async function fetchBoaTransactionFromQr(qrData, { receiverAccount = null, senderAccount = null } = {}) {
  const reference = extractBoaReferenceFromQr(qrData);
  if (!reference) return null;

  const suffixes = [
    accountSuffix(receiverAccount),
    accountSuffix(senderAccount),
    '',
  ].filter((s, idx, arr) => arr.indexOf(s) === idx);

  for (const suffix of suffixes) {
    const url = `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=${reference}${suffix}`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json, text/plain, */*',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      if (data?.header?.status !== 'success' || !Array.isArray(data?.body) || !data.body[0]) {
        continue;
      }

      const mapped = mapBoaApiBody(data.body[0]);
      if (mapped) return mapped;
    } catch (err) {
      console.warn('[BOA API]', err.message);
    }
  }

  return null;
}

export function mergeBoaApiIntoQrFields(qrFields, boaFields) {
  if (!boaFields) return qrFields;

  return {
    ...qrFields,
    transactionCode: boaFields.transactionCode || qrFields.transactionCode,
    amount: boaFields.amount || qrFields.amount,
    senderName: boaFields.senderName || qrFields.senderName,
    senderAccount: boaFields.senderAccount || qrFields.senderAccount,
    receiverName: boaFields.receiverName || qrFields.receiverName,
    receiverAccount: boaFields.receiverAccount || qrFields.receiverAccount,
    boaApiSource: true,
  };
}
