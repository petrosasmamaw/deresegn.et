import { extractPaymentFromBuffer } from './geminiService.js';
import { decodeQrFromBuffer } from './qrService.js';
import { extractQrReceiptFields } from './qrFieldExtractor.js';
import { extractBoaFieldsFromQrPayload } from './boaQrCrypto.js';
import { normalizeTxCode, txCodesMatch } from '../utils/txCode.js';

const BOA_API = 'https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=';
const API_TIMEOUT_MS = 5000;
const NEARBY_BUDGET_MS = 8000;

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

  const ft = raw.match(/\b(FT[A-Z0-9]{8,14})\b/i);
  if (ft?.[1]) return normalizeTxCode(ft[1]);

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

  const url = `${BOA_API}${encodeURIComponent(`${id}${suffix}`)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json, text/plain, */*',
      },
    });
    clearTimeout(timer);

    if (!response.ok) return null;
    const data = await response.json();
    if (data?.header?.status !== 'success' || !Array.isArray(data?.body) || !data.body[0]) {
      return null;
    }
    return mapBoaApiBody(data.body[0]);
  } catch {
    return null;
  }
}

async function fetchBoaByReference(reference, accounts = []) {
  const suffixes = buildSuffixCandidates(...accounts);
  const tasks = suffixes.map((suffix) => fetchBoaApiOnce(reference, suffix));
  const results = await Promise.all(tasks);
  return results.find(Boolean) || null;
}

function nearbyReferences(reference) {
  const ref = normalizeTxCode(reference);
  if (!ref || !/^FT[A-Z0-9]{8,}$/i.test(ref)) return [];

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
  const suffixes = buildSuffixCandidates(...accounts);

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
    tasks.push(
      fetchBoaByReference(screenshotRef, accounts).then((official) => ({ official, reference: screenshotRef, via: 'screenshot_reference' })),
    );
  }

  if (qrRef && qrRef !== screenshotRef) {
    tasks.push(
      fetchBoaByReference(qrRef, accounts).then((official) => ({ official, reference: qrRef, via: 'qr_reference' })),
    );
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

  if (screenshotRef && /^FT[A-Z0-9]{8,}$/i.test(screenshotRef)) {
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

  let geminiUsed = true;
  let geminiError = null;

  const geminiPromise = extractPaymentFromBuffer(buffer, 'boa', mime)
    .then((data) => ({ data }))
    .catch((err) => {
      geminiError = err.message;
      geminiUsed = false;
      return {
        data: {
          senderName: null,
          senderAccount: null,
          receiverName: null,
          receiverAccount: null,
          amount: null,
          date: null,
          transactionCode: null,
        },
      };
    });

  const qrPromise = decodeQrFromBuffer(buffer, { maxMs: 10000 });

  const [geminiOutcome, qrData] = await Promise.all([geminiPromise, qrPromise]);
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
  });

  if (boaResolve?.official) {
    qrFields = mergeBoaApiIntoQrFields(qrFields, boaResolve.official);
    console.log('[BOA] Official record:', boaResolve.official.transactionCode,
      'amount', boaResolve.official.amount,
      boaResolve.screenshotEdited ? '(text edited)' : '');
  } else if (extracted?.transactionCode || qrData?.raw) {
    console.warn('[BOA] No official record for screenshot ID:', extracted?.transactionCode);
  }

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
