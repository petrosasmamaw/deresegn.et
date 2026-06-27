import { PDFParse } from 'pdf-parse';
import fs from 'fs/promises';
import { normalizeTxCode } from '../utils/txCode.js';
import { outboundFetch, BANK_FETCH_TIMEOUT_MS, BANK_FETCH_RETRIES } from '../utils/outboundFetch.js';
import { extractCbeMbReceiptToken, decodeQrFromBuffer, prepareQrScanImage, buildQrDataFromRaw } from './qrService.js';
import { extractPaymentFromBuffer } from './geminiService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';

const QR_BUDGET_MS = 9000;
const OCR_GRACE_MS = 800;

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};

function canFetchCbePdfFromExtracted(extracted) {
  const ft = normalizeTxCode(extracted?.transactionCode);
  const digits = String(extracted?.senderAccount || '').replace(/\D/g, '');
  return Boolean(ft && /^FT[A-Z0-9]{8,}$/i.test(ft) && digits.length >= 8);
}

function hasCbeQrToken(qrData) {
  return Boolean(
    qrData?.verificationToken
    || extractCbeMbReceiptToken(qrData?.raw)
    || extractCbeMbReceiptToken(qrData?.verificationUrl),
  );
}

const CBE_RECEIPT_BASE = 'https://apps.cbe.com.et:100/?id=';

const CBE_API_HEADERS = {
  'X-App-ID': 'd1292e42-7400-49de-a2d3-9731caa4c819',
  'X-App-Version': '0a01980b-9859-1369-8198-59f403820000',
};

function mapCbeApiResponse(data) {
  if (!data?.id) return null;

  const amount = parseFloat(
    data.amountCredited ?? data.amountDebited ?? data.debitAmount ?? data.creditAmount,
  );
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
    const response = await outboundFetch(url, {
      method: 'GET',
      timeoutMs: 18000,
      retries: 2,
      headers: CBE_API_HEADERS,
    });

    if (!response.ok) {
      console.warn('[CBE API] HTTP', response.status, 'for token', token);
      return null;
    }

    const data = await response.json();
    const mapped = mapCbeApiResponse(data);
    if (!mapped) {
      console.warn('[CBE API] Unmapped response for token', token);
    }
    return mapped;
  } catch (err) {
    console.warn('[CBE API]', err.message, 'token', token);
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
  const branch = parseCbeBranchPdfText(text);
  if (branch) return branch;

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

/** Branch receipt PDF layout: Payer / Account lines then Receiver / Account. */
function parseCbeBranchPdfText(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fields = {};
  let pendingAccountFor = null;

  for (const line of lines) {
    const payerInline = line.match(/^Payer\s+(.+)$/i);
    if (payerInline) {
      fields.senderName = payerInline[1].trim();
      pendingAccountFor = 'sender';
      continue;
    }
    const receiverInline = line.match(/^Receiver\s+(.+)$/i);
    if (receiverInline) {
      fields.receiverName = receiverInline[1].trim();
      pendingAccountFor = 'receiver';
      continue;
    }
    const accountLine = line.match(/^Account\s+([\d*\s]+)$/i);
    if (accountLine) {
      if (pendingAccountFor === 'receiver') fields.receiverAccount = accountLine[1].replace(/\s+/g, '');
      else fields.senderAccount = accountLine[1].replace(/\s+/g, '');
      pendingAccountFor = null;
      continue;
    }
    const ref = line.match(/Reference\s+No\.?\s*(?:\([^)]*\))?\s*(FT[A-Z0-9]+)/i);
    if (ref) fields.transaction_reference = ref[1];
    const amount = line.match(/Transferred\s+Amount\s+([\d,.]+)\s*ETB/i);
    if (amount) fields.amount = amount[1];
  }

  if (!fields.transaction_reference && !fields.amount) return null;

  return mapCbePdfFields({
    transactionCode: fields.transaction_reference,
    amount: fields.amount,
    senderName: fields.senderName,
    senderAccount: fields.senderAccount,
    receiverName: fields.receiverName,
    receiverAccount: fields.receiverAccount,
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

async function fetchCbePdfFromUrl(url, label) {
  try {
    const response = await outboundFetch(url, {
      timeoutMs: BANK_FETCH_TIMEOUT_MS,
      retries: BANK_FETCH_RETRIES,
      headers: { Accept: 'application/pdf,*/*' },
    });

    if (!response.ok) {
      console.warn(`[CBE PDF] HTTP ${response.status} (${label})`, url);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.slice(0, 4).toString() !== '%PDF') {
      const preview = buffer.slice(0, 120).toString('utf8').replace(/\s+/g, ' ').trim();
      console.warn(`[CBE PDF] Non-PDF (${label}):`, preview.slice(0, 80));
      return null;
    }

    return parseCbePdfBuffer(buffer);
  } catch (err) {
    console.warn(`[CBE PDF] ${label} failed:`, err.message);
    return null;
  }
}

function buildCbeAccountSuffixCandidates(accountSuffix) {
  const digits = String(accountSuffix || '').replace(/\D/g, '');
  if (!digits) return [];
  const candidates = new Set();
  if (digits.length >= 8) candidates.add(digits.slice(-8));
  if (digits.length >= 10) candidates.add(digits);
  if (digits.length > 8 && digits.length < 10) candidates.add(digits);
  return [...candidates];
}

/** Reference-only CBE verify: FT + last 8 digits of payer account (official CBE PDF). */
export async function fetchCbeTransactionByReference(ftNumber, accountSuffix) {
  const ft = normalizeTxCode(ftNumber);
  const suffixes = buildCbeAccountSuffixCandidates(accountSuffix);
  if (!ft || !/^FT[A-Z0-9]{8,}$/i.test(ft) || !suffixes.length) return null;

  const urls = suffixes.flatMap((suffix) => [
    {
      url: `https://apps.cbe.com.et:100/BranchReceipt/${encodeURIComponent(ft)}&${suffix}`,
      label: `BranchReceipt-${suffix}`,
    },
    {
      url: `${CBE_RECEIPT_BASE}${encodeURIComponent(`${ft}${suffix}`)}`,
      label: `legacy-id-${suffix}`,
    },
  ]);

  const results = await Promise.all(urls.map(async ({ url, label }) => {
    const official = await fetchCbePdfFromUrl(url, label);
    if (official) official.source = 'cbe_branch_receipt_pdf';
    return official;
  }));

  return results.find(Boolean) || null;
}

export function parseCbeBranchReceiptUrl(receiptUrl) {
  const url = String(receiptUrl || '').trim();
  const match = url.match(/BranchReceipt\/(FT[A-Z0-9]+)&(\d{8,})/i);
  if (!match) return null;
  return {
    transactionCode: normalizeTxCode(match[1]),
    accountSuffix: match[2],
    receiptUrl: url,
  };
}

/** Fetch official CBE branch receipt PDF from SMS link. */
export async function fetchCbeBranchReceipt(receiptUrl) {
  const parsed = parseCbeBranchReceiptUrl(receiptUrl);
  if (!parsed?.receiptUrl) return null;

  const official = await fetchCbePdfFromUrl(parsed.receiptUrl, 'BranchReceipt-link');
  if (official) {
    official.source = 'cbe_branch_receipt_pdf';
    official.receiptUrl = parsed.receiptUrl;
  }
  return official;
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

/**
 * Fast CBE pipeline — parallel QR + OCR + official API/PDF prefetch with early exit.
 */
export async function verifyCbeReceipt({ buffer, mime = 'image/jpeg', screenshotPath }) {
  if (!buffer && screenshotPath) {
    buffer = await fs.readFile(screenshotPath);
  }
  if (!buffer?.length) {
    throw new Error('CBE verification requires a screenshot buffer');
  }

  const started = Date.now();
  console.log('[CBE] verify', buffer.length, 'bytes', mime);

  let geminiUsed = true;
  let geminiError = null;

  const preparedPromise = prepareQrScanImage(buffer);

  const geminiPromise = extractPaymentFromBuffer(buffer, 'cbe', mime)
    .then((data) => ({ data }))
    .catch((err) => {
      geminiError = err.message;
      geminiUsed = false;
      return { data: { ...EMPTY_EXTRACTED } };
    });

  const screenshotPdfPrefetchPromise = geminiPromise.then(async (outcome) => {
    if (!canFetchCbePdfFromExtracted(outcome.data)) return null;
    const official = await fetchCbeTransactionByReference(
      outcome.data.transactionCode,
      outcome.data.senderAccount,
    );
    return official ? { official } : null;
  });

  const qrPromise = preparedPromise.then(async (prepared) => {
    const pdfPrefetch = await screenshotPdfPrefetchPromise;
    if (pdfPrefetch?.official) return buildQrDataFromRaw(null);
    return decodeQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS, image: prepared });
  });

  const qrApiPrefetchPromise = qrPromise.then((qrData) => (
    hasCbeQrToken(qrData) ? fetchCbeTransactionFromQr(qrData) : null
  ));

  const fullPipelinePromise = Promise.all([
    geminiPromise,
    qrPromise,
    qrApiPrefetchPromise,
    screenshotPdfPrefetchPromise,
  ]).then(([geminiOutcome, qrData, qrApiFields, screenshotPdfPrefetch]) => ({
    geminiOutcome,
    qrData,
    qrApiFields,
    screenshotPdfPrefetch,
  }));

  const outcome = await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    qrApiPrefetchPromise.then(async (qrApiFields) => {
      if (!qrApiFields) return;
      const [geminiOutcome, qrData] = await Promise.all([
        Promise.race([
          geminiPromise,
          new Promise((r) => setTimeout(() => r({ data: { ...EMPTY_EXTRACTED } }), OCR_GRACE_MS)),
        ]),
        qrPromise,
      ]);
      finish({ geminiOutcome, qrData, qrApiFields, screenshotPdfPrefetch: null });
    });

    screenshotPdfPrefetchPromise.then(async (prefetch) => {
      if (!prefetch?.official) return;
      const geminiOutcome = await geminiPromise;
      finish({
        geminiOutcome,
        qrData: buildQrDataFromRaw(null),
        qrApiFields: prefetch.official,
        screenshotPdfPrefetch: prefetch,
      });
    });

    fullPipelinePromise.then(finish);
  });

  const { geminiOutcome, qrData, qrApiFields, screenshotPdfPrefetch } = outcome;
  const extracted = geminiOutcome.data;
  if (geminiError) console.warn('[Gemini]', geminiError);

  let qrFields = extractQrReceiptFields('cbe', qrData);
  const cbeOfficial = qrApiFields || screenshotPdfPrefetch?.official || null;
  if (cbeOfficial) {
    qrFields = mergeCbeApiIntoQrFields(qrFields, cbeOfficial);
    console.log('[CBE] Official record:', cbeOfficial.transactionCode, 'amount', cbeOfficial.amount);
  } else if (qrData?.verificationToken || qrData?.raw) {
    console.warn('[CBE] No official record from QR or screenshot reference');
  }

  console.log('[CBE] done in', Date.now() - started, 'ms');

  return {
    extracted,
    geminiUsed,
    geminiError,
    qrData,
    qrFields,
    cbeOfficial,
  };
}
