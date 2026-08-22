import { extractBoaOcrFromBuffer, isGeminiQuotaBlocked } from './geminiService.js';
import { decodeQrFromBuffer, prepareQrScanImage, buildQrDataFromRaw } from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { extractBoaFieldsFromQrPayload } from './boaQrCrypto.js';
import { normalizeTxCode, txCodesMatch } from '../utils/txCode.js';
import { outboundFetch } from '../utils/outboundFetch.js';

const BOA_API = 'https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=';
const API_TIMEOUT_MS = Number(process.env.BOA_API_TIMEOUT_MS) || 8000;
const API_RETRIES = Number.isFinite(Number(process.env.BOA_API_RETRIES))
  ? Math.max(0, Number(process.env.BOA_API_RETRIES))
  : 0;
const NEARBY_BUDGET_MS = Number(process.env.BOA_NEARBY_BUDGET_MS) || 4000;
const QR_BUDGET_MS = Number(process.env.BOA_QR_BUDGET_MS) || 2500;
const OCR_GRACE_MS = 400;
const inflightBoaFetches = new Map();

/** BOA payment refs: FT… (credit/transfer) or TT… (e.g. debit). */
export const BOA_REF_RE = /^(FT|TT)[A-Z0-9]{8,}$/i;
const BOA_REF_CORE_RE = /^(FT|TT)[A-Z0-9]{8,14}$/i;
const BOA_REF_IN_TEXT_RE = /\b((?:FT|TT)[A-Z0-9]{8,})\b/i;
const BOA_REF_PREFIX_RE = /^((?:FT|TT)[A-Z0-9]{8,14})/i;

export function isBoaPaymentReference(value) {
  return BOA_REF_RE.test(normalizeTxCode(value));
}

/**
 * Slip trx is often CORE + account digits (e.g. TT26171RW0YG02723 → TT26171RW0YG + 02723).
 */
export function splitBoaSlipTrx(rawTrx) {
  const slipTrx = normalizeTxCode(rawTrx);
  if (!slipTrx) return { slipTrx: null, coreRef: null, accountSuffix: null };
  if (!/^(FT|TT)[A-Z0-9]+$/i.test(slipTrx)) {
    return { slipTrx, coreRef: slipTrx, accountSuffix: null };
  }

  let coreRef = slipTrx;
  let accountSuffix = null;
  const trailingDigits = slipTrx.match(/(\d{5,8})$/);
  if (trailingDigits) {
    const without = slipTrx.slice(0, -trailingDigits[1].length);
    if (BOA_REF_CORE_RE.test(without)) {
      coreRef = normalizeTxCode(without);
      accountSuffix = trailingDigits[1].slice(-5);
    }
  }
  return { slipTrx, coreRef, accountSuffix };
}

const EMPTY_EXTRACTED = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};

const BOA_FIELD_MAP = {
  'Transaction Reference': 'transactionCode',
  "Payer's Name": 'senderName',
  'Source Account Name': 'senderName',
  'Source Account': 'senderAccount',
  "Payer's Account": 'senderAccount',
  "Receiver's Name": 'receiverName',
  'Beneficiary Name': 'receiverName',
  "Receiver's Account": 'receiverAccount',
  'Beneficiary Account': 'receiverAccount',
  'Transferred Amount': 'amount',
  'Transferred amount': 'amount',
};

/** Same id transform used by cs.bankofabyssinia.com/slip SPA before getDetails. */
export function normalizeBoaApiId(reference) {
  const B = String(reference || '').trim();
  if (!B) return null;
  const y = B.length;
  const half = Math.floor(y / 2);
  const prefix = B.substring(0, half - 2);
  const tail = B.substring(half + 3);
  return tail === prefix ? B.substring(0, half + 3) : B;
}

function parseAmount(value) {
  if (value == null) return null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
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

  const ref = raw.match(BOA_REF_IN_TEXT_RE);
  if (ref?.[1]) return normalizeTxCode(ref[1]);

  return null;
}

function buildSuffixCandidates(...accounts) {
  const candidates = new Set(['']);
  for (const account of accounts) {
    const digits = String(account || '').replace(/\D/g, '');
    if (!digits) continue;
    if (digits.length >= 5) candidates.add(digits.slice(-5));
    if (digits.length >= 8) candidates.add(digits.slice(-8));
    if (digits.length > 0 && digits.length < 5) {
      candidates.add(digits.padStart(5, '0'));
    }
  }
  return [...candidates];
}

function mergeBoaQrDecryptedFields(qrFields, decryptedFields) {
  if (!decryptedFields) return qrFields;
  return {
    ...qrFields,
    transactionCode: decryptedFields.transactionCode || qrFields.transactionCode,
    amount: decryptedFields.amount || qrFields.amount,
    senderName: decryptedFields.senderName || qrFields.senderName,
    senderAccount: decryptedFields.senderAccount || qrFields.senderAccount,
    receiverName: decryptedFields.receiverName || qrFields.receiverName,
    receiverAccount: decryptedFields.receiverAccount || qrFields.receiverAccount,
    boaQrDecrypted: true,
    boaQrPlaintext: decryptedFields.plaintext || null,
  };
}

async function fetchBoaApiOnce(reference, suffix = '') {
  const id = normalizeBoaApiId(reference);
  if (!id) return null;
  const key = `${id}|${suffix}`;
  if (inflightBoaFetches.has(key)) return inflightBoaFetches.get(key);

  const run = (async () => {
    const url = `${BOA_API}${encodeURIComponent(`${id}${suffix}`)}`;
    try {
      const response = await outboundFetch(url, {
        timeoutMs: API_TIMEOUT_MS,
        retries: API_RETRIES,
        headers: {
          Accept: 'application/json, text/plain, */*',
          Referer: 'https://cs.bankofabyssinia.com/',
        },
      });

      if (!response.ok) return null;
      const data = await response.json();
      if (data?.header?.status !== 'success' || !Array.isArray(data?.body) || !data.body[0]) {
        return null;
      }
      return mapBoaApiBody(data.body[0]);
    } catch {
      return null;
    } finally {
      inflightBoaFetches.delete(key);
    }
  })();

  inflightBoaFetches.set(key, run);
  return run;
}

async function firstOfficialHit(tasks) {
  if (!tasks.length) return null;
  return new Promise((resolve) => {
    let pending = tasks.length;
    let settled = false;
    for (const task of tasks) {
      Promise.resolve(task).then((hit) => {
        if (settled) return;
        if (hit) {
          settled = true;
          resolve(hit);
          return;
        }
        pending -= 1;
        if (pending === 0) resolve(null);
      }).catch(() => {
        pending -= 1;
        if (!settled && pending === 0) resolve(null);
      });
    }
  });
}

async function fetchBoaByReference(reference, accounts = []) {
  const suffixes = buildSuffixCandidates(...accounts);
  const preferred = suffixes.filter((s) => s === '' || s.length === 5);
  const rest = suffixes.filter((s) => !preferred.includes(s));
  const first = await firstOfficialHit(preferred.map((suffix) => fetchBoaApiOnce(reference, suffix)));
  if (first) return first;
  if (!rest.length) return null;
  return firstOfficialHit(rest.map((suffix) => fetchBoaApiOnce(reference, suffix)));
}

/** Reference-only BOA verify: FT + last 5 digits of payer account. */
export async function fetchBoaTransactionByReference(reference, accountSuffix) {
  const ref = normalizeTxCode(reference);
  const digits = String(accountSuffix || '').replace(/\D/g, '');
  if (!ref || !isBoaPaymentReference(ref) || digits.length < 5) return null;
  return fetchBoaByReference(ref, [digits.slice(-5)]);
}

/**
 * Fast BOA SMS / QR slip verify — load official record from
 * https://cs.bankofabyssinia.com/slip/?trx=… (API getDetails, not OCR).
 * Supports FT… and TT… slip ids.
 */
export async function fetchBoaTransactionFromSlipUrl(slipUrl, extraAccounts = []) {
  const raw = String(slipUrl || '').trim();
  const trx = extractBoaReferenceFromQr({ raw })
    || normalizeTxCode(raw.match(/[?&]trx=([A-Z0-9]+)/i)?.[1]);
  if (!trx) return null;

  // 1) Full slip trx as API id (fastest — one request)
  const direct = await fetchBoaApiOnce(trx);
  if (direct) {
    return { ...direct, source: 'boa_slip_link', receiptUrl: raw.startsWith('http') ? raw : null };
  }

  // 2) Core FT/TT + account digits (same as reference mode)
  const { coreRef, accountSuffix } = splitBoaSlipTrx(trx);
  const accounts = [
    accountSuffix,
    ...extraAccounts,
  ].filter(Boolean);

  const byRef = await fetchBoaByReference(coreRef || trx, accounts);
  if (byRef) {
    return { ...byRef, source: 'boa_slip_link', receiptUrl: raw.startsWith('http') ? raw : null };
  }

  return null;
}

function nearbyReferences(reference) {
  const ref = normalizeTxCode(reference);
  if (!ref || !isBoaPaymentReference(ref)) return [];

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const prefix = ref.slice(0, -1);
  const last = ref.slice(-1);
  const variants = [];
  for (const ch of chars) {
    if (ch !== last) variants.push(prefix + ch);
  }
  return variants;
}

async function discoverNearbyOfficial(reference, accounts = [], deadlineMs = NEARBY_BUDGET_MS) {
  const deadline = Date.now() + deadlineMs;
  const candidates = nearbyReferences(reference);
  const suffixes = buildSuffixCandidates(...accounts).filter((s) => s === '' || s.length === 5);

  for (let i = 0; i < candidates.length; i += 8) {
    if (Date.now() >= deadline) break;
    const batch = candidates.slice(i, i + 8);
    const tasks = [];
    for (const candidate of batch) {
      for (const suffix of suffixes) {
        tasks.push(fetchBoaApiOnce(candidate, suffix));
      }
    }
    const results = await Promise.all(tasks);
    const idx = results.findIndex(Boolean);
    if (idx >= 0) {
      const candidateIdx = Math.floor(idx / suffixes.length);
      return { reference: batch[candidateIdx], official: results[idx] };
    }
  }
  return null;
}

/**
 * Load official BOA record from screenshot payment ID (primary) or QR URL ref.
 * If screenshot ID is edited, nearby search finds the real ID tied to the same QR.
 */
export async function resolveBoaOfficialTransaction({
  screenshotReference,
  qrData,
  senderAccount = null,
  receiverAccount = null,
  qrPrefetch = null,
  screenshotPrefetch = null,
} = {}) {
  const accounts = [senderAccount, receiverAccount];
  const screenshotRef = normalizeTxCode(screenshotReference);
  const qrRef = extractBoaReferenceFromQr(qrData);
  const qrRaw = String(qrData?.raw || '').trim();

  const empty = {
    official: null,
    matchedReference: null,
    screenshotEdited: false,
    verifiedVia: null,
  };

  const tasks = [];

  if (screenshotRef) {
    const shotTask = screenshotPrefetch?.official && txCodesMatch(screenshotPrefetch.reference, screenshotRef)
      ? Promise.resolve({ official: screenshotPrefetch.official, reference: screenshotRef, via: 'screenshot_reference' })
      : fetchBoaByReference(screenshotRef, accounts).then((official) => ({ official, reference: screenshotRef, via: 'screenshot_reference' }));
    tasks.push(shotTask);
  }

  if (qrRef && qrRef !== screenshotRef) {
    const qrTask = qrPrefetch?.official && txCodesMatch(qrPrefetch.reference, qrRef)
      ? Promise.resolve({ official: qrPrefetch.official, reference: qrRef, via: 'qr_reference' })
      : fetchBoaByReference(qrRef, accounts).then((official) => ({ official, reference: qrRef, via: 'qr_reference' }));
    tasks.push(qrTask);
  }

  if (qrRaw && qrRaw.length >= 80 && !qrRef) {
    tasks.push(
      fetchBoaApiOnce(qrRaw).then((official) => ({ official, reference: screenshotRef || null, via: 'qr_payload' })),
    );
  }

  if (tasks.length) {
    const results = await Promise.all(tasks);
    const hit = results.find((r) => r.official);
    if (hit) {
      const screenshotEdited = Boolean(
        screenshotRef
        && hit.reference
        && !txCodesMatch(hit.reference, screenshotRef),
      );
      return {
        official: hit.official,
        matchedReference: hit.reference,
        screenshotEdited,
        verifiedVia: hit.via,
      };
    }
  }

  if (screenshotRef && isBoaPaymentReference(screenshotRef)) {
    const nearby = await discoverNearbyOfficial(screenshotRef, accounts);
    if (nearby?.official) {
      const edited = !txCodesMatch(nearby.reference, screenshotRef);
      if (edited) {
        console.warn('[BOA] Screenshot payment ID edited:', screenshotRef, '→ official', nearby.reference);
      }
      return {
        official: nearby.official,
        matchedReference: nearby.reference,
        screenshotEdited: edited,
        verifiedVia: 'nearby_reference',
      };
    }
  }

  return empty;
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

/**
 * Fast BOA pipeline: parallel screenshot OCR + QR scan + official bank lookup.
 */
export async function verifyBoaReceipt({ buffer, mime = 'image/jpeg', screenshotPath }) {
  if (!buffer && screenshotPath) {
    const fs = await import('fs/promises');
    buffer = await fs.readFile(screenshotPath);
  }
  if (!buffer?.length) {
    throw new Error('BOA verification requires a screenshot buffer');
  }

  const started = Date.now();
  console.log('[BOA] verify', buffer.length, 'bytes', mime);

  let geminiUsed = true;
  let geminiError = null;

  const preparedPromise = prepareQrScanImage(buffer);

  const geminiPromise = (isGeminiQuotaBlocked()
    ? Promise.resolve({ ...EMPTY_EXTRACTED })
    : extractBoaOcrFromBuffer(buffer, mime))
    .then((data) => {
      geminiUsed = Boolean(data?.transactionCode || data?.amount || data?.receiverName);
      return { data: { ...EMPTY_EXTRACTED, ...data } };
    })
    .catch((err) => {
      geminiError = err.message;
      geminiUsed = false;
      return { data: { ...EMPTY_EXTRACTED } };
    });

  const screenshotPrefetchPromise = geminiPromise.then(async (outcome) => {
    const rawTx = String(outcome.data?.transactionCode || '');
    const fromUrl = extractBoaReferenceFromQr({ raw: rawTx });
    const ref = normalizeTxCode(fromUrl || outcome.data?.transactionCode);
    if (!ref) return null;
    const official = await fetchBoaByReference(ref, [
      outcome.data?.senderAccount,
      outcome.data?.receiverAccount,
    ]);
    return official ? { reference: ref, official, via: 'screenshot_reference' } : null;
  });

  const qrPromise = preparedPromise.then((prepared) => (
    decodeQrFromBuffer(buffer, { maxMs: QR_BUDGET_MS, image: prepared })
  ));

  const qrPrefetchPromise = qrPromise.then(async (qrData) => {
    const ref = extractBoaReferenceFromQr(qrData);
    if (!ref) return null;
    const official = await fetchBoaByReference(ref, []);
    return official ? { reference: ref, official, via: 'qr_reference' } : null;
  });

  const fullPipelinePromise = Promise.all([
    geminiPromise,
    qrPromise,
    qrPrefetchPromise,
    screenshotPrefetchPromise,
  ]).then(([geminiOutcome, qrData, qrPrefetch, screenshotPrefetch]) => ({
    geminiOutcome,
    qrData,
    qrPrefetch,
    screenshotPrefetch,
  }));

  const outcome = await new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    qrPromise.then(async (qrData) => {
      const decrypted = extractBoaFieldsFromQrPayload(qrData?.raw);
      if (!decrypted?.transactionCode) return;
      const geminiOutcome = await Promise.race([
        geminiPromise,
        new Promise((r) => setTimeout(() => r({ data: { ...EMPTY_EXTRACTED } }), OCR_GRACE_MS)),
      ]);
      finish({ geminiOutcome, qrData, qrPrefetch: null, screenshotPrefetch: null });
    });

    screenshotPrefetchPromise.then(async (prefetch) => {
      if (!prefetch?.official) return;
      const geminiOutcome = await geminiPromise;
      finish({ geminiOutcome, qrData: buildQrDataFromRaw(null), qrPrefetch: null, screenshotPrefetch: prefetch });
    });

    qrPrefetchPromise.then(async (prefetch) => {
      if (!prefetch?.official) return;
      const geminiOutcome = await geminiPromise;
      const qrData = await qrPromise;
      finish({ geminiOutcome, qrData, qrPrefetch: prefetch, screenshotPrefetch: null });
    });

    fullPipelinePromise.then(finish);
  });

  const { geminiOutcome, qrData, qrPrefetch, screenshotPrefetch } = outcome;
  const extracted = geminiOutcome.data;
  if (geminiError) console.warn('[Gemini]', geminiError);

  let qrFields = extractQrReceiptFields('boa', qrData);
  const decryptedQr = extractBoaFieldsFromQrPayload(qrData?.raw);
  if (decryptedQr) {
    qrFields = mergeBoaQrDecryptedFields(qrFields, decryptedQr);
    console.log('[BOA] QR decrypted:', decryptedQr.transactionCode, 'amount', decryptedQr.amount);
  }

  const boaResolve = await resolveBoaOfficialTransaction({
    screenshotReference: extracted?.transactionCode || decryptedQr?.transactionCode,
    qrData,
    senderAccount: extracted?.senderAccount || decryptedQr?.senderAccount,
    receiverAccount: extracted?.receiverAccount || decryptedQr?.receiverAccountFull || decryptedQr?.receiverAccount,
    qrPrefetch,
    screenshotPrefetch,
  });

  if (boaResolve?.official) {
    qrFields = mergeBoaApiIntoQrFields(qrFields, boaResolve.official);
    console.log('[BOA] Official record:', boaResolve.official.transactionCode,
      'amount', boaResolve.official.amount,
      boaResolve.screenshotEdited ? '(text edited)' : '');
  } else if (extracted?.transactionCode || qrData?.raw) {
    console.warn('[BOA] No official record for screenshot ID:', extracted?.transactionCode);
  }

  console.log('[BOA] done in', Date.now() - started, 'ms');

  return {
    extracted,
    geminiUsed,
    geminiError,
    qrData,
    qrFields,
    boaResolve,
  };
}

/** @deprecated Use verifyBoaReceipt / resolveBoaOfficialTransaction */
export async function fetchBoaTransactionFromQr(qrData, options = {}) {
  const result = await resolveBoaOfficialTransaction({
    screenshotReference: options.screenshotReference || extractBoaReferenceFromQr(qrData),
    qrData,
    senderAccount: options.senderAccount,
    receiverAccount: options.receiverAccount,
  });
  return result.official;
}
