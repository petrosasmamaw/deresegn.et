import { PDFParse } from 'pdf-parse';
import fs from 'fs/promises';
import { normalizeTxCode } from '../utils/txCode.js';
import { outboundFetch, BANK_FETCH_TIMEOUT_MS, BANK_FETCH_RETRIES } from '../utils/outboundFetch.js';
import { httpsGet } from '../utils/httpsGet.js';
import { extractCbeMbReceiptToken, decodeQrFromBuffer, prepareQrScanImage, buildQrDataFromRaw } from './qrService.js';
import { extractPaymentFromBuffer } from './geminiService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { fetchCbeViaPetros, isPetrosVerifierConfigured } from './petrosVerifierService.js';
import { isWorkersRuntime } from '../config/runtime.js';

const QR_BUDGET_MS = isWorkersRuntime()
  ? Number(process.env.QR_MAX_MS) || 3500
  : 9000;
const OCR_GRACE_MS = isWorkersRuntime() ? 500 : 800;
/** CBE PDF host often needs longer than other banks + insecure TLS. */
const CBE_PDF_TIMEOUT_MS = isWorkersRuntime()
  ? Math.min(BANK_FETCH_TIMEOUT_MS, 15000)
  : Math.max(BANK_FETCH_TIMEOUT_MS, 30000);

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
/** Direct CBE :100 is often geo-blocked; keep this short so Petros / token path can win. */
const CBE_FT_FETCH_TIMEOUT_MS = 12000;

const CBE_API_HEADERS = {
  'X-App-ID': 'd1292e42-7400-49de-a2d3-9731caa4c819',
  'X-App-Version': '0a01980b-9859-1369-8198-59f403820000',
  Accept: '*/*',
  Origin: 'https://mbreciept.cbe.com.et',
  Referer: 'https://mbreciept.cbe.com.et/',
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

function parseCbeHtmlReceipt(html) {
  const raw = String(html || '');
  if (/Record Not Found|Invalid Reference|transaction not found/i.test(raw)) return null;
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return parseCbePdfText(text);
}

async function fetchCbePdfFromUrl(url, label, timeoutMs = CBE_PDF_TIMEOUT_MS) {
  try {
    // Native HTTPS + rejectUnauthorized:false — undici fetch() fails TLS on apps.cbe.com.et:100.
    const response = await httpsGet(url, {
      timeoutMs,
      rejectUnauthorized: false,
      headers: { Accept: 'application/pdf,text/html,*/*' },
    });

    if (!response.ok) {
      console.warn(`[CBE PDF] HTTP ${response.status} (${label})`, url);
      return { official: null, networkError: false };
    }

    const buffer = response.body;
    if (!buffer?.length) {
      return { official: null, networkError: false };
    }

    if (buffer.slice(0, 4).toString() === '%PDF') {
      const official = await parseCbePdfBuffer(buffer);
      return { official, networkError: false };
    }

    const preview = buffer.slice(0, 180).toString('utf8').replace(/\s+/g, ' ').trim();
    const htmlOfficial = parseCbeHtmlReceipt(buffer.toString('utf8'));
    if (htmlOfficial) {
      htmlOfficial.source = 'cbe_official_html';
      return { official: htmlOfficial, networkError: false };
    }
    console.warn(`[CBE PDF] Non-PDF (${label}):`, preview.slice(0, 80));
    return { official: null, networkError: false };
  } catch (err) {
    const networkError = /timeout|ECONNRESET|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|certificate|SSL|TLS|fetch failed|network/i
      .test(String(err?.message || err || ''));
    console.warn(`[CBE PDF] ${label} failed:`, err.message);
    return { official: null, networkError };
  }
}

function buildCbeAccountSuffixCandidates(accountSuffix) {
  const digits = String(accountSuffix || '').replace(/\D/g, '');
  if (!digits || digits.length < 8) return [];
  // Official CBE receipt id always uses the last 8 digits of the payer account.
  return [digits.slice(-8)];
}

/** Reference-only CBE verify: FT + last 8 digits of payer account (official CBE PDF). */
export async function fetchCbeTransactionByReference(ftNumber, accountSuffix) {
  const ft = normalizeTxCode(ftNumber);
  const suffixes = buildCbeAccountSuffixCandidates(accountSuffix);
  if (!ft || !/^FT[A-Z0-9]{8,}$/i.test(ft) || !suffixes.length) return null;

  const tryPetros = async () => {
    if (!isPetrosVerifierConfigured()) return null;
    return fetchCbeViaPetros(ft, suffixes[0]);
  };

  const tryDirectPdf = async () => {
    const urls = suffixes.flatMap((suffix) => [
      {
        url: `${CBE_RECEIPT_BASE}${ft}${suffix}`,
        label: `id-${suffix}`,
      },
      {
        url: `https://apps.cbe.com.et:100/${ft}${suffix}`,
        label: `path-${suffix}`,
      },
      {
        url: `https://apps.cbe.com.et:100/BranchReceipt/${ft}&${suffix}`,
        label: `BranchReceipt-${suffix}`,
      },
    ]);

    let networkFailures = 0;
    for (const { url, label } of urls) {
      const { official, networkError } = await fetchCbePdfFromUrl(url, label, CBE_FT_FETCH_TIMEOUT_MS);
      if (official) {
        official.source = official.source || 'cbe_branch_receipt_pdf';
        return { official, networkFailures: 0, attempts: urls.length };
      }
      if (networkError) networkFailures += 1;
    }
    return { official: null, networkFailures, attempts: urls.length };
  };

  const unreachableError = () => {
    const err = new Error(
      'CBE FT receipts need apps.cbe.com.et:100 (often blocked outside Ethiopia). Paste the mbreciept.cbe.com.et / v2- link from SMS instead — that works without port 100.',
    );
    err.code = 'CBE_UNREACHABLE';
    err.isValidation = true;
    err.field = 'transactionCode';
    return err;
  };

  // Direct PDF fetch/parse exceeds Workers CPU — use Petros + QR API only.
  if (isWorkersRuntime()) {
    const fromPetros = await tryPetros();
    return fromPetros || null;
  }

  // Direct first (works on an Ethiopian IP). Petros next — skip if their Chrome/PDF path is down.
  const direct = await tryDirectPdf();
  if (direct.official) return direct.official;

  const fromPetros = await tryPetros();
  if (fromPetros) return fromPetros;

  if (direct.networkFailures >= direct.attempts) {
    throw unreachableError();
  }

  return null;
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

  const { official } = await fetchCbePdfFromUrl(parsed.receiptUrl, 'BranchReceipt-link');
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

  if (isWorkersRuntime()) {
    let geminiUsed = false;
    let geminiError = null;
    const qrData = await decodeQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS });
    let cbeOfficial = hasCbeQrToken(qrData) ? await fetchCbeTransactionFromQr(qrData) : null;
    let extracted = { ...EMPTY_EXTRACTED };

    if (!cbeOfficial) {
      try {
        extracted = await extractPaymentFromBuffer(buffer, 'cbe', mime);
        geminiUsed = true;
        if (canFetchCbePdfFromExtracted(extracted)) {
          cbeOfficial = await fetchCbeTransactionByReference(
            extracted.transactionCode,
            extracted.senderAccount,
          );
        }
      } catch (err) {
        geminiError = err.message;
        console.warn('[Gemini]', geminiError);
      }
    }

    let qrFields = extractQrReceiptFields('cbe', qrData);
    if (cbeOfficial) {
      qrFields = mergeCbeApiIntoQrFields(qrFields, cbeOfficial);
      console.log('[CBE] Official record:', cbeOfficial.transactionCode, 'amount', cbeOfficial.amount);
    }

    console.log('[CBE] done in', Date.now() - started, 'ms (worker)');
    return {
      extracted,
      geminiUsed,
      geminiError,
      qrData,
      qrFields,
      cbeOfficial,
    };
  }

  let geminiUsed = true;
  let geminiError = null;

  const preparedPromise = isWorkersRuntime()
    ? Promise.resolve(null)
    : prepareQrScanImage(buffer);

  const geminiPromise = extractPaymentFromBuffer(buffer, 'cbe', mime)
    .then((data) => ({ data }))
    .catch((err) => {
      geminiError = err.message;
      geminiUsed = false;
      return { data: { ...EMPTY_EXTRACTED } };
    });

  const screenshotPdfPrefetchPromise = isWorkersRuntime()
    ? Promise.resolve(null)
    : geminiPromise.then(async (outcome) => {
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
