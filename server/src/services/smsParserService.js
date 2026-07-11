import { normalizeTxCode } from '../utils/txCode.js';
import { normalizeTelebirrInvoiceId } from './telebirrReceiptService.js';
import { extractCbeMbReceiptToken } from './qrService.js';

function cleanUrl(raw) {
  return String(raw || '').replace(/[).,;]+$/g, '').trim();
}

function repairSmsUrls(blob) {
  let out = blob;

  // Mobile SMS apps sometimes break long URLs across lines — rejoin them.
  out = out.replace(
    /(https?:\/\/mbreciept\.cbe\.com\.et\/[^\s]+(?:\s+[^\s]+)*)/gi,
    (url) => url.replace(/\s+/g, ''),
  );
  out = out.replace(
    /(https?:\/\/apps\.cbe\.com\.et(?::\d+)?\/BranchReceipt\/[^\s]+(?:\s+[^\s]+)*)/gi,
    (url) => url.replace(/\s+/g, ''),
  );
  out = out.replace(
    /(https?:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/[^\s]+(?:\s+[^\s]+)*)/gi,
    (url) => url.replace(/\s+/g, ''),
  );
  out = out.replace(
    /\b(mbreciept\.cbe\.com\.et\/[^\s]+(?:\s+[^\s]+)*)/gi,
    (url) => url.replace(/\s+/g, ''),
  );

  return out;
}

function normalizeSmsBlob(text) {
  const raw = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\r\n/g, '\n');

  return repairSmsUrls(raw)
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAmount(raw) {
  if (!raw) return null;
  const n = parseFloat(String(raw).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function findCbeMbReceiptUrl(blob) {
  const match = blob.match(/https?:\/\/mbreciept\.cbe\.com\.et\/[^\s]+/i)
    || blob.match(/\bmbreciept\.cbe\.com\.et\/[^\s]+/i);
  if (!match?.[0]) return '';
  let url = cleanUrl(match[0]);
  if (!url.startsWith('http')) url = `https://${url}`;
  return url.replace(/&amp;/gi, '&');
}

function findCbeReceiptUrl(blob) {
  const match = blob.match(/https?:\/\/apps\.cbe\.com\.et(?::\d+)?\/BranchReceipt\/[^\s]+/i)
    || blob.match(/\bapps\.cbe\.com\.et(?::\d+)?\/BranchReceipt\/[^\s]+/i);
  if (!match?.[0]) return '';
  let url = cleanUrl(match[0]);
  if (!url.startsWith('http')) url = `https://${url}`;
  return url.replace(/&amp;/gi, '&');
}

function findCbeAmount(blob) {
  const patterns = [
    /\b(?:has been\s+)?credited with\s+ETB\s*([\d,]+\.?\d*)/i,
    /\b(?:has been\s+)?debited with\s+ETB\s*([\d,]+\.?\d*)/i,
    /\btransferred\s+ETB\s*([\d,]+\.?\d*)/i,
    /\bETB\s*([\d,]+\.?\d*)\s+(?:has been\s+)?credited/i,
    /\bETB\s*([\d,]+\.?\d*)\s+(?:has been\s+)?debited/i,
    /\breceived\s+ETB\s*([\d,]+\.?\d*)/i,
    /\bwithdrawn\s+ETB\s*([\d,]+\.?\d*)/i,
    /\b(?:amount|amt)[:\s]+ETB\s*([\d,]+\.?\d*)/i,
  ];

  for (const pattern of patterns) {
    const hit = blob.match(pattern);
    const amount = parseAmount(hit?.[1]);
    if (amount != null) {
      if (/debited|withdrawn/i.test(hit[0])) {
        return { direction: 'debit', amount };
      }
      if (/transferred/i.test(hit[0])) {
        return { direction: 'transfer', amount };
      }
      return { direction: 'credit', amount };
    }
  }

  return { direction: null, amount: null };
}

export function detectSmsMethod(text) {
  const blob = normalizeSmsBlob(text);
  if (/transactioninfo\.ethiotelecom\.et\/receipt\//i.test(blob)
    || /\btransaction number is\s+DF[A-Z0-9]{6,}/i.test(blob)
    || /thank you for using telebirr/i.test(blob)
    || /\btransferred\s+ETB[\s\S]{0,120}ethiotelecom\.et/i.test(blob)) {
    return 'telebirr';
  }
  if (/apps\.cbe\.com\.et.*BranchReceipt/i.test(blob)
    || /mbreciept\.cbe\.com\.et/i.test(blob)
    || /thanks?\s+for\s+banking\s+with\s+cbe/i.test(blob)
    || /\bfor\s+rec(?:eipt|iept)\s+https?:\/\/apps\.cbe\.com\.et/i.test(blob)
    || /\bBranchReceipt\/FT[A-Z0-9]+/i.test(blob)) {
    return 'cbe';
  }
  return null;
}

export function parseCbeSms(text) {
  const blob = normalizeSmsBlob(text);
  const branchReceiptUrl = findCbeReceiptUrl(blob);
  const mbReceiptUrl = findCbeMbReceiptUrl(blob);
  const receiptUrl = branchReceiptUrl || mbReceiptUrl;
  const verificationToken = extractCbeMbReceiptToken(mbReceiptUrl || blob);

  const urlParts = branchReceiptUrl?.match(/BranchReceipt\/(FT[A-Z0-9]+)&(\d{8,})/i);

  let transactionCode = normalizeTxCode(urlParts?.[1]
    || blob.match(/\b(FT[A-Z0-9]{10,})\b/i)?.[1]);
  const accountSuffix = urlParts?.[2] || null;

  let direction = null;
  let amount = null;
  let account = blob.match(/\bto your account\s+([\d*]+)/i)?.[1]?.trim()
    || blob.match(/\bAccount\s+([\d*]+)/i)?.[1]?.trim()
    || null;
  let senderAccount = null;
  let senderName = null;
  let receiverName = null;

  const receivedTransfer = blob.match(
    /\breceived\s+ETB\s*([\d,]+\.?\d*)\s+from\s+account\s+([\d*]+)(?:\s*\(([^)]+)\))?\s+to\s+your\s+account\s+([\d*]+)/i,
  );
  if (receivedTransfer) {
    direction = 'credit';
    amount = parseAmount(receivedTransfer[1]);
    senderAccount = receivedTransfer[2]?.trim() || null;
    senderName = receivedTransfer[3]?.trim() || null;
    account = receivedTransfer[4]?.trim() || account;
    receiverName = blob.match(/Dear\s+([A-Za-z][A-Za-z\s]{2,50}?)(?:\s+You have)/i)?.[1]?.trim() || null;
  } else {
    const parsedAmount = findCbeAmount(blob);
    direction = parsedAmount.direction;
    amount = parsedAmount.amount;
  }

  const customerName = blob.match(
    /Dear\s+(?:Mr|Mrs|Ms)\.?\s+([A-Za-z][A-Za-z\s]{0,30}?)(?:\s+your\b|,|\.|$)/i,
  )?.[1]?.trim()
    || blob.match(/Dear\s+([A-Za-z][A-Za-z\s]{2,50}?)(?:\s+You have)/i)?.[1]?.trim()
    || null;

  return {
    method: 'cbe',
    transactionCode,
    amount: amount != null ? String(amount) : null,
    direction,
    account,
    senderAccount,
    senderName,
    receiverName: receiverName || customerName,
    customerName,
    receiptUrl,
    verificationToken,
    accountSuffix,
    receiptType: branchReceiptUrl ? 'branch' : (mbReceiptUrl ? 'mbreciept' : null),
  };
}

export function parseTelebirrSms(text) {
  const blob = normalizeSmsBlob(text);
  const receiptUrl = cleanUrl(blob.match(/https?:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/[A-Z0-9]+/i)?.[0]);
  const invoiceFromUrl = receiptUrl?.match(/\/receipt\/([A-Z0-9]+)/i)?.[1];
  const invoiceFromText = blob.match(/\btransaction number is\s+([A-Z0-9]{8,12})/i)?.[1];

  const transactionCode = normalizeTelebirrInvoiceId(invoiceFromUrl)
    || normalizeTelebirrInvoiceId(invoiceFromText)
    || normalizeTxCode(invoiceFromUrl || invoiceFromText);

  const transferMatch = blob.match(/\btransferred\s+ETB\s*([\d,]+\.?\d*)\s+to\s+([^(]+?)\s*\(([^)]+)\)/i);
  const amount = parseAmount(transferMatch?.[1]);
  const receiverName = transferMatch?.[2]?.trim() || null;
  const receiverAccount = transferMatch?.[3]?.trim() || null;

  const senderName = blob.match(/Dear\s+([A-Za-z][A-Za-z\s]{0,40}?)(?:\s+you have|\s+your\b|,)/i)?.[1]?.trim() || null;

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
  const blob = normalizeSmsBlob(text);
  if (!blob || blob.length < 20) {
    const err = new Error('Paste the full transaction SMS including the receipt link.');
    err.isValidation = true;
    err.field = 'smsText';
    throw err;
  }

  const detected = detectSmsMethod(blob);
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
  if (method === 'telebirr') return parseTelebirrSms(blob);
  if (method === 'cbe') return parseCbeSms(blob);
  const err = new Error('SMS verification is only supported for Telebirr and CBE.');
  err.isValidation = true;
  err.field = 'method';
  throw err;
}
