/**
 * Unified Commercial Bank of Ethiopia (CBE) verification pipeline.
 *
 * Fast path: parallel QR scan + Gemini OCR; PDF prefetch from extracted reference.
 * Returns { extracted, geminiUsed, geminiError, qrData, qrFields, cbeOfficial }
 */
import fs from 'fs/promises';
import { extractCbeMbReceiptToken, decodeQrFromBuffer, prepareQrScanImage, buildQrDataFromRaw } from './qrService.js';
import { extractPaymentFromBuffer } from './geminiService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { fetchCbeViaPetros, isPetrosVerifierConfigured } from './petrosVerifierService.js';

import { isWorkersRuntime } from '../config/runtime.js';

const QR_BUDGET_MS = isWorkersRuntime() ? 2500 : 9000;
const OCR_GRACE_MS = 400;
/** CBE PDF host often needs longer than other banks + insecure TLS. */
const CBE_PDF_TIMEOUT_MS = isWorkersRuntime() ? 2500 : Math.max(BANK_FETCH_TIMEOUT_MS, 30000);

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};
import { normalizeTxCode, isCbePaymentReference } from '../utils/txCode.js';
import { outboundFetch, BANK_FETCH_TIMEOUT_MS, BANK_FETCH_RETRIES } from '../utils/outboundFetch.js';

const CBE_MBRECEIPT_BASE = 'https://mbreciept.cbe.com.et:4433/receipt';
const CBE_SEARCH_BASE = 'https://mbreciept.cbe.com.et:4433';

const inflightCbeSearches = new Map();

function parseAmount(val) {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/,/g, '').trim());
  return Number.isNaN(n) || n < 0 ? null : n;
}

function normalizeDate(raw) {
  if (!raw) return null;
  const match = raw.match(/(\w{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (match) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const month = months[match[1]];
    if (month) {
      const day = match[2].padStart(2, '0');
      return `${match[3]}-${month}-${day}`;
    }
  }
  const isoMatch = raw.match(/\d{4}-\d{2}-\d{2}/);
  return isoMatch ? isoMatch[0] : null;
}

export function parseCbeReceiptPdf(text) {
  const result = {
    transactionCode: null,
    amount: null,
    senderName: null,
    senderAccount: null,
    receiverName: null,
    receiverAccount: null,
    paymentDate: null,
    rawText: text,
  };

  const txMatch = text.match(/Transaction Reference\s*\n?\s*([A-Za-z0-9]+)/i)
    || text.match(/Reference No\.?\s*\n?\s*([A-Za-z0-9]+)/i)
    || text.match(/\b(FT[A-Za-z0-9]{8,14})\b/i);
  if (txMatch) result.transactionCode = txMatch[1].trim();

  const amountMatch = text.match(/Amount\s*\n?\s*([\d,]+\.?\d*)\s*(?:ETB|USD|EUR)?/i)
    || text.match(/Total Amount\s*\n?\s*([\d,]+\.?\d*)/i)
    || text.match(/Transfer Amount\s*\n?\s*([\d,]+\.?\d*)/i)
    || text.match(/Transferred Amount\s*\n?\s*([\d,]+\.?\d*)/i);
  if (amountMatch) {
    result.amount = String(parseAmount(amountMatch[1]) ?? amountMatch[1].trim());
  }

  const payerNameMatch = text.match(/Payer Name\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Sender Name\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Debited Account Name\s*\n?\s*([^\n\r]+)/i)
    || text.match(/From\s*\n?\s*([^\n\r]+)/i);
  if (payerNameMatch) {
    const val = payerNameMatch[1].trim();
    if (!val.toLowerCase().includes('account') && val.length > 2) result.senderName = val;
  }

  const payerAccMatch = text.match(/Payer Account\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Sender Account\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Debited Account(?: No\.?)?\s*\n?\s*([^\n\r]+)/i);
  if (payerAccMatch) result.senderAccount = payerAccMatch[1].trim();

  const receiverNameMatch = text.match(/Receiver Name\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Beneficiary Name\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Credited Account Name\s*\n?\s*([^\n\r]+)/i)
    || text.match(/To\s*\n?\s*([^\n\r]+)/i);
  if (receiverNameMatch) {
    const val = receiverNameMatch[1].trim();
    if (!val.toLowerCase().includes('account') && val.length > 2) result.receiverName = val;
  }

  const receiverAccMatch = text.match(/Receiver Account\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Beneficiary Account\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Credited Account(?: No\.?)?\s*\n?\s*([^\n\r]+)/i);
  if (receiverAccMatch) result.receiverAccount = receiverAccMatch[1].trim();

  const dateMatch = text.match(/Payment Date\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Transaction Date\s*\n?\s*([^\n\r]+)/i)
    || text.match(/Date\s*\n?\s*([^\n\r]+)/i);
  if (dateMatch) result.paymentDate = normalizeDate(dateMatch[1].trim());

  return result;
}

export async function parseCbePdfBuffer(pdfBuffer) {
  const parser = new PDFParse({ data: pdfBuffer });
  try {
    const textResult = await parser.getText();
    return parseCbeReceiptPdf(String(textResult.text || ''));
  } finally {
    await parser.destroy();
  }
}

export function parseCbeHtmlReceipt(html) {
  const clean = String(html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&');
  return parseCbeReceiptPdf(clean);
}

export async function fetchCbeBranchReceipt(receiptUrl) {
  if (!receiptUrl) return null;
  const token = extractCbeMbReceiptToken(receiptUrl);
  if (token) {
    return await fetchCbeTransactionFromQr({ verificationToken: token });
  }
  try {
    const response = await outboundFetch(receiptUrl, {
      timeoutMs: CBE_PDF_TIMEOUT_MS,
      retries: BANK_FETCH_RETRIES,
      headers: {
        Accept: 'application/pdf,text/html,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (contentType.includes('pdf') || buffer.slice(0, 4).toString() === '%PDF') {
      const parsed = await parseCbePdfBuffer(buffer);
      if (parsed.transactionCode || parsed.amount) {
        return { ...parsed, source: 'cbe_branch_pdf' };
      }
    }

    const html = buffer.toString('utf8');
    const parsed = parseCbeHtmlReceipt(html);
    if (parsed.transactionCode || parsed.amount) {
      return { ...parsed, source: 'cbe_branch_html' };
    }
  } catch (err) {
    console.warn('[CBE Branch] Fetch failed:', err.message);
  }
  return null;
}

export async function fetchCbeTransactionFromQr(qrData) {
  const token = extractCbeMbReceiptToken(qrData?.verificationToken)
    || extractCbeMbReceiptToken(qrData?.verificationUrl)
    || extractCbeMbReceiptToken(qrData?.raw);

  if (!token) return null;

  const url = `${CBE_MBRECEIPT_BASE}/${token}`;
  try {
    const response = await outboundFetch(url, {
      timeoutMs: CBE_PDF_TIMEOUT_MS,
      retries: BANK_FETCH_RETRIES,
      headers: {
        Accept: 'application/pdf,text/html,*/*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.warn('[CBE QR API] HTTP', response.status, 'for token', token);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuf = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    if (contentType.includes('pdf') || buffer.slice(0, 4).toString() === '%PDF') {
      const parsed = await parseCbePdfBuffer(buffer);
      if (parsed.transactionCode || parsed.amount) {
        return { ...parsed, source: 'cbe_qr_pdf', verificationToken: token };
      }
    }

    const html = buffer.toString('utf8');
    const parsed = parseCbeHtmlReceipt(html);
    if (parsed.transactionCode || parsed.amount) {
      return { ...parsed, source: 'cbe_qr_html', verificationToken: token };
    }

    return null;
  } catch (err) {
    console.warn('[CBE QR API] Fetch failed:', err.message);
    return null;
  }
}

function buildAccountSuffixCandidates(senderAccount) {
  const raw = String(senderAccount || '').trim();
  const digits = raw.replace(/\D/g, '');
  const out = [];

  const add = (candidate) => {
    if (candidate && !out.includes(candidate)) out.push(candidate);
  };

  const directLast4 = raw.match(/(\d{4})\s*$/)?.[1];
  if (directLast4) add(directLast4);

  const starSuffix = raw.match(/\*+(\d{3,6})/)?.[1];
  if (starSuffix) add(starSuffix);

  if (digits.length >= 4) {
    add(digits.slice(-4));
    add(digits.slice(-3));
    if (digits.length >= 5) add(digits.slice(-5));
  }

  const trailing3 = raw.match(/(\d{3})\s*$/)?.[1];
  if (trailing3) add(trailing3);

  return out;
}

export async function fetchCbeTransactionByReference(ftNumber, accountSuffix) {
  const cleanFt = normalizeTxCode(ftNumber);
  if (!cleanFt || !isCbePaymentReference(cleanFt)) return null;

  const cacheKey = `${cleanFt}:${String(accountSuffix || '').trim()}`;
  if (inflightCbeSearches.has(cacheKey)) {
    return inflightCbeSearches.get(cacheKey);
  }

  const fetchPromise = (async () => {
    const suffixes = buildAccountSuffixCandidates(accountSuffix);
    if (suffixes.length === 0) suffixes.push('');

    const tryDirectPdf = async () => {
      for (const sfx of suffixes) {
        const queryParams = new URLSearchParams({
          trans_id: cleanFt,
          ...(sfx ? { account_no: sfx } : {}),
        });

        const urls = [
          `${CBE_SEARCH_BASE}/search?${queryParams}`,
          `${CBE_SEARCH_BASE}/receipt/search?${queryParams}`,
        ];

        for (const searchUrl of urls) {
          try {
            const response = await outboundFetch(searchUrl, {
              timeoutMs: CBE_PDF_TIMEOUT_MS,
              retries: BANK_FETCH_RETRIES,
              headers: {
                Accept: 'application/pdf,text/html,*/*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
            });

            if (!response.ok) continue;

            const contentType = response.headers.get('content-type') || '';
            const arrayBuf = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuf);

            if (contentType.includes('pdf') || buffer.slice(0, 4).toString() === '%PDF') {
              const parsed = await parseCbePdfBuffer(buffer);
              if (parsed.transactionCode || parsed.amount) {
                return {
                  official: {
                    ...parsed,
                    transactionCode: parsed.transactionCode || cleanFt,
                    source: 'cbe_reference_search_pdf',
                  },
                };
              }
            }

            const html = buffer.toString('utf8');
            const tokenMatch = html.match(/\/receipt\/(v2-[A-Za-z0-9_-]+)/i)
              || html.match(/\/receipt\/([A-Za-z0-9_-]{16,})/i);

            if (tokenMatch) {
              const token = tokenMatch[1];
              const fromToken = await fetchCbeTransactionFromQr({ verificationToken: token });
              if (fromToken) return { official: fromToken };
            }

            const parsedHtml = parseCbeHtmlReceipt(html);
            if (parsedHtml.transactionCode || parsedHtml.amount) {
              return {
                official: {
                  ...parsedHtml,
                  transactionCode: parsedHtml.transactionCode || cleanFt,
                  source: 'cbe_reference_search_html',
                },
              };
            }
          } catch (err) {
            console.warn('[CBE Ref Search] Attempt failed:', err.message);
          }
        }
      }
      return { official: null };
    };

    const tryPetros = async () => {
      if (!isPetrosVerifierConfigured()) return null;
      try {
        const petrosResult = await fetchCbeViaPetros(cleanFt, {
          accountSuffix: suffixes[0] || undefined,
        });
        if (petrosResult?.transactionCode || petrosResult?.amount) {
          console.log('[CBE Petros] Verified via Petros bridge:', cleanFt);
          return {
            ...petrosResult,
            transactionCode: petrosResult.transactionCode || cleanFt,
            source: 'cbe_petros_bridge',
          };
        }
      } catch (err) {
        console.warn('[CBE Petros] Bridge fetch failed:', err.message);
      }
      return null;
    };

    const direct = await tryDirectPdf();
    if (direct.official) return direct.official;

    const fromPetros = await tryPetros();
    if (fromPetros) return fromPetros;

    return null;
  })();

  inflightCbeSearches.set(cacheKey, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inflightCbeSearches.delete(cacheKey);
  }
}

export function mergeCbeApiIntoQrFields(qrFields, cbeOfficial) {
  if (!cbeOfficial) return qrFields;
  return {
    ...qrFields,
    transactionCode: cbeOfficial.transactionCode || qrFields.transactionCode,
    amount: cbeOfficial.amount || qrFields.amount,
    senderName: cbeOfficial.senderName || qrFields.senderName,
    senderAccount: cbeOfficial.senderAccount || qrFields.senderAccount,
    receiverName: cbeOfficial.receiverName || qrFields.receiverName,
    receiverAccount: cbeOfficial.receiverAccount || qrFields.receiverAccount,
    paymentDate: cbeOfficial.paymentDate || qrFields.paymentDate,
    cbeApiSource: true,
  };
}

function hasCbeQrToken(qrData) {
  return Boolean(
    qrData?.verificationToken
    || extractCbeMbReceiptToken(qrData?.verificationUrl)
    || extractCbeMbReceiptToken(qrData?.raw),
  );
}

function canFetchCbePdfFromExtracted(extracted) {
  return Boolean(extracted?.transactionCode && isCbePaymentReference(extracted.transactionCode));
}

/**
 * Main CBE pipeline: parallel QR scan + Gemini OCR + official PDF prefetch.
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
