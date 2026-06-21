import { normalizeTxCode } from '../utils/txCode.js';
import { normalizeTelebirrInvoiceId } from './telebirrReceiptService.js';

function cleanUrl(raw) {
  return String(raw || '').replace(/[).,;]+$/g, '').trim();
}

function parseAmount(raw) {
  if (!raw) return null;
  const n = parseFloat(String(raw).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

export function detectSmsMethod(text) {
  const blob = String(text || '');
  if (/transactioninfo\.ethiotelecom\.et\/receipt\//i.test(blob)
    || /\btransaction number is\s+DF[A-Z0-9]{6,}/i.test(blob)
    || /thank you for using telebirr/i.test(blob)) {
    return 'telebirr';
  }
  if (/apps\.cbe\.com\.et.*BranchReceipt/i.test(blob)
    || /thank you for banking with cbe/i.test(blob)
    || /\bfor\s+reciept\s+https?:\/\/apps\.cbe\.com\.et/i.test(blob)) {
    return 'cbe';
  }
  return null;
}

export function parseCbeSms(text) {
  const blob = String(text || '').replace(/\s+/g, ' ');
  const receiptUrl = cleanUrl(blob.match(/https?:\/\/apps\.cbe\.com\.et:?\d*\/BranchReceipt\/[^\s]+/i)?.[0]);
  const urlParts = receiptUrl?.match(/BranchReceipt\/(FT[A-Z0-9]+)&(\d{8,})/i);

  const transactionCode = normalizeTxCode(urlParts?.[1]
    || blob.match(/\b(FT[A-Z0-9]{10,})\b/i)?.[1]);
  const accountSuffix = urlParts?.[2] || null;

  const credited = blob.match(/\b(?:has been\s+)?credited with\s+ETB\s*([\d,]+\.?\d*)/i);
  const debited = blob.match(/\b(?:has been\s+)?debited with\s+ETB\s*([\d,]+\.?\d*)/i);
  const transferred = blob.match(/\btransferred\s+ETB\s*([\d,]+\.?\d*)/i);

  let direction = null;
  let amount = null;
  if (credited) {
    direction = 'credit';
    amount = parseAmount(credited[1]);
  } else if (debited) {
    direction = 'debit';
    amount = parseAmount(debited[1]);
  } else if (transferred) {
    direction = 'transfer';
    amount = parseAmount(transferred[1]);
  }

  const account = blob.match(/\bAccount\s+([\d*]+)/i)?.[1]?.trim() || null;
  const customerName = blob.match(/Dear\s+(?:Mr|Mrs|Ms)\.?\s+([A-Za-z][A-Za-z\s]{1,40})/i)?.[1]?.trim() || null;

  return {
    method: 'cbe',
    transactionCode,
    amount: amount != null ? String(amount) : null,
    direction,
    account,
    customerName,
    receiptUrl,
    accountSuffix,
  };
}

export function parseTelebirrSms(text) {
  const blob = String(text || '').replace(/\s+/g, ' ');
  const receiptUrl = cleanUrl(blob.match(/https?:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/[A-Z0-9]+/i)?.[0]);
  const invoiceFromUrl = receiptUrl?.match(/\/receipt\/([A-Z0-9]+)/i)?.[1];
  const invoiceFromText = blob.match(/\btransaction number is\s+(DF[A-Z0-9]{6,})/i)?.[1];

  const transactionCode = normalizeTelebirrInvoiceId(invoiceFromUrl)
    || normalizeTelebirrInvoiceId(invoiceFromText)
    || normalizeTxCode(invoiceFromUrl || invoiceFromText);

  const transferMatch = blob.match(/\btransferred\s+ETB\s*([\d,]+\.?\d*)\s+to\s+([^(]+?)\s*\(([^)]+)\)/i);
  const amount = parseAmount(transferMatch?.[1]);
  const receiverName = transferMatch?.[2]?.trim() || null;
  const receiverAccount = transferMatch?.[3]?.trim() || null;

  const senderName = blob.match(/^Dear\s+([A-Za-z][A-Za-z\s]{1,40})/i)?.[1]?.trim() || null;

  return {
    method: 'telebirr',
    transactionCode,
    amount: amount != null ? String(amount) : null,
    senderName,
    receiverName,
    receiverAccount,
    receiptUrl,
  };
}

export function parseSms(text, expectedMethod = null) {
  const detected = detectSmsMethod(text);
  const method = expectedMethod || detected;
  if (!method) {
    const err = new Error('Could not detect bank from SMS. Paste a full Telebirr or CBE transaction SMS.');
    err.isValidation = true;
    err.field = 'smsText';
    throw err;
  }
  if (expectedMethod && detected && expectedMethod !== detected) {
    const err = new Error(`This SMS is for ${detected === 'telebirr' ? 'Telebirr' : 'CBE'}, but you selected ${expectedMethod === 'telebirr' ? 'Telebirr' : 'CBE'}.`);
    err.isValidation = true;
    err.field = 'smsText';
    throw err;
  }
  if (method === 'telebirr') return parseTelebirrSms(text);
  if (method === 'cbe') return parseCbeSms(text);
  const err = new Error('SMS verification is only supported for Telebirr and CBE.');
  err.isValidation = true;
  err.field = 'method';
  throw err;
}
