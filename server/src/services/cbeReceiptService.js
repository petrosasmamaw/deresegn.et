import { normalizeTxCode } from '../utils/txCode.js';

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
  const token = qrData?.verificationToken;
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
