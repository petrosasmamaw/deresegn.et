import { normalizeTxCode } from '../utils/txCode.js';
import { normalizeTelebirrInvoiceId } from './telebirrReceiptService.js';
import { extractCbeMbReceiptToken } from './qrService.js';

function cleanUrl(raw) {
  return String(raw || '').replace(/[).,;]+$/g, '').trim();
}

/** Only rejoin SMS line-breaks inside a URL path — never glue following words like "for feedback:". */
function isUrlPathContinuation(token) {
  const t = String(token || '');
  if (!t) return false;
  if (/^(for|feedback|thanks?|you|visit|click|see|more|http|https|and|with|your|current|balance)$/i.test(t)) {
    return false;
  }
  if (/^https?:\/\//i.test(t)) return false;
  if (/^[A-Za-z]{2,}:/i.test(t)) return false; // "feedback:" etc.
  // Path/query fragment only
  return /^[A-Za-z0-9\-._~%&=?+/]+$/.test(t);
}

function repairBrokenHostUrl(blob, hostPathRegex) {
  return blob.replace(hostPathRegex, (full, base, first, rest) => {
    let url = `${base}${first}`;
    const leftover = [];
    const parts = String(rest || '').trim().split(/\s+/).filter(Boolean);
    let joined = true;
    for (const part of parts) {
      if (joined && isUrlPathContinuation(part)) {
        url += part;
      } else {
        joined = false;
        leftover.push(part);
      }
    }
    return leftover.length ? `${url} ${leftover.join(' ')}` : url;
  });
}

function repairSmsUrls(blob) {
  let out = blob;

  out = repairBrokenHostUrl(
    out,
    /(https?:\/\/mbreciept\.cbe\.com\.et\/)([^\s]+)((?:\s+[^\s]+)*)/gi,
  );
  out = repairBrokenHostUrl(
    out,
    /(https?:\/\/apps\.cbe\.com\.et(?::\d+)?\/BranchReceipt\/)([^\s]+)((?:\s+[^\s]+)*)/gi,
  );
  out = repairBrokenHostUrl(
    out,
    /(https?:\/\/transactioninfo\.ethiotelecom\.et\/receipt\/)([^\s]+)((?:\s+[^\s]+)*)/gi,
  );
  out = repairBrokenHostUrl(
    out,
    /\b(mbreciept\.cbe\.com\.et\/)([^\s]+)((?:\s+[^\s]+)*)/gi,
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

/** CBE mb receipt tokens: v2-… or opaque id — stop before trailing SMS junk. */
function extractMbReceiptTokenFromText(text) {
  const blob = String(text || '');
  const match = blob.match(/mbreciept\.cbe\.com\.et\/(v2-[A-Za-z0-9_-]+|[A-Za-z0-9_-]{8,80})/i);
  return match?.[1] || null;
}

function findCbeMbReceiptUrl(blob) {
  const token = extractMbReceiptTokenFromText(blob);
  if (token) return `https://mbreciept.cbe.com.et/${token}`;

  const match = blob.match(/https?:\/\/mbreciept\.cbe\.com\.et\/[^\s]+/i)
    || blob.match(/\bmbreciept\.cbe\.com\.et\/[^\s]+/i);
  if (!match?.[0]) return '';
  let url = cleanUrl(match[0]);
  if (!url.startsWith('http')) url = `https://${url}`;
  // Strip accidental glue after token (e.g. forfeedback:)
  const cleanedToken = extractMbReceiptTokenFromText(url);
  if (cleanedToken) return `https://mbreciept.cbe.com.et/${cleanedToken}`;
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
    /\ba\s+debit\s+transaction\s+of\s+ETB\s*([\d,]+\.?\d*)/i,
    /\ba\s+credit\s+transaction\s+of\s+ETB\s*([\d,]+\.?\d*)/i,
    /\bdebit\s+transaction\s+of\s+ETB\s*([\d,]+\.?\d*)/i,
    /\bcredit\s+transaction\s+of\s+ETB\s*([\d,]+\.?\d*)/i,
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
      if (/debit|withdrawn/i.test(hit[0]) && !/credit/i.test(hit[0])) {
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
  let account = blob.match(/\bon your account\s+([\d*]+)/i)?.[1]?.trim()
    || blob.match(/\bto your account\s+([\d*]+)/i)?.[1]?.trim()
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
    /Dear\s+(?:Mr|Mrs|Ms)\.?\s+([A-Za-z][A-Za-z\s]{0,40}?)(?:\s+your\b|,|\.|$)/i,
  )?.[1]?.trim()
    || blob.match(/Dear\s+([A-Za-z][A-Za-z\s]{2,60}?)(?:\s+A\s+(?:debit|credit)\s+transaction)/i)?.[1]?.trim()
    || blob.match(/Dear\s+([A-Za-z][A-Za-z\s]{2,50}?)(?:\s+You have)/i)?.[1]?.trim()
    || null;

  // Debit SMS "Dear X" = payer; credit SMS "Dear X" = receiver.
  if (!senderName && customerName && (direction === 'debit' || direction === 'transfer')) {
    senderName = customerName;
  }
  if (!receiverName && customerName && direction === 'credit') {
    receiverName = customerName;
  }

  return {
    method: 'cbe',
    transactionCode,
    amount: amount != null ? String(amount) : null,
    direction,
    account,
    senderAccount,
    senderName,
    receiverName: receiverName || (direction === 'credit' ? customerName : null),
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
