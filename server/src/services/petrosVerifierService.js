import { outboundFetch } from '../utils/outboundFetch.js';
import { normalizeTelebirrInvoiceId } from '../utils/telebirrInvoice.js';
import { normalizeTxCode } from '../utils/txCode.js';

const PETROS_BASE_URL = String(process.env.PETROS_VERIFIER_BASE_URL || '')
  .trim()
  .replace(/\/$/, '');
const PETROS_API_KEY = String(
  process.env.PETROS_VERIFIER_API_KEY
  || process.env.VERIFIER_API_KEY
  || '',
).trim();
const PETROS_TIMEOUT_MS = Number(process.env.PETROS_VERIFIER_TIMEOUT_MS) || 45000;
const PETROS_RETRIES = Number(process.env.PETROS_VERIFIER_RETRIES);
const PETROS_RETRY_COUNT = Number.isFinite(PETROS_RETRIES) ? Math.max(0, PETROS_RETRIES) : 2;

const PETROS_HOST = (() => {
  try { return new URL(PETROS_BASE_URL).hostname; } catch { return ''; }
})();

export function isPetrosVerifierConfigured() {
  return Boolean(PETROS_API_KEY && PETROS_BASE_URL);
}

/** Never print upstream host/brand names in terminal or client-facing errors. */
function safeLogText(value) {
  let text = String(value ?? '');
  if (PETROS_HOST) {
    text = text.split(PETROS_HOST).join('petros-verifier');
  }
  if (PETROS_BASE_URL) {
    text = text.split(PETROS_BASE_URL).join('petros-verifier');
  }
  const needles = [
    Buffer.from('bGV1bHplbmViZS5wcm8=', 'base64').toString('utf8'),
    Buffer.from('dmVyaWZ5LmxldWwuZXQ=', 'base64').toString('utf8'),
    Buffer.from('bGV1bA==', 'base64').toString('utf8'),
  ];
  for (const needle of needles) {
    text = text.replace(new RegExp(needle.replace(/\./g, '\\.'), 'gi'), 'petros-verifier');
  }
  return text;
}

function parseBirrAmount(value) {
  if (value == null || value === '') return null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function isCompletedStatus(status) {
  if (!status) return true;
  return /success|completed|paid|approved/i.test(String(status));
}

/** Map remote Telebirr JSON into Deresegn official fields. */
export function mapPetrosTelebirrPayload(data, invoiceId) {
  if (!data || typeof data !== 'object') return null;
  if (!isCompletedStatus(data.transactionStatus)) return null;

  const receiptNo = normalizeTelebirrInvoiceId(data.receiptNo)
    || normalizeTelebirrInvoiceId(invoiceId)
    || normalizeTxCode(invoiceId);
  const amount = parseBirrAmount(data.totalPaidAmount)
    ?? parseBirrAmount(data.settledAmount);
  if (!receiptNo || amount == null) return null;

  return {
    transactionCode: receiptNo,
    amount: String(amount),
    senderName: data.payerName || null,
    senderAccount: data.payerTelebirrNo || null,
    receiverName: data.creditedPartyName || null,
    receiverAccount: data.creditedPartyAccountNo || null,
    status: data.transactionStatus || null,
    paymentDate: data.paymentDate || null,
    settledAmount: parseBirrAmount(data.settledAmount),
    serviceFee: parseBirrAmount(data.serviceFee),
    serviceFeeVAT: parseBirrAmount(data.serviceFeeVAT),
    bankName: data.bankName || null,
    source: 'petros_verifier_api',
  };
}

async function postPetrosVerify(path, body, invoiceId) {
  const response = await outboundFetch(`${PETROS_BASE_URL}${path}`, {
    method: 'POST',
    timeoutMs: PETROS_TIMEOUT_MS,
    retries: PETROS_RETRY_COUNT,
    logHost: 'petros-verifier',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': PETROS_API_KEY,
      Connection: 'close',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    console.warn(
      '[Petros] non-JSON body',
      path,
      invoiceId,
      response.status,
      safeLogText(text.slice(0, 180)),
    );
    return { ok: false, status: response.status, error: 'non-json' };
  }

  if (!response.ok || !json?.success) {
    const rawError = json?.error || json?.message || text.slice(0, 160) || `HTTP ${response.status}`;
    return {
      ok: false,
      status: response.status,
      error: safeLogText(rawError),
      json,
    };
  }

  // Some Petros CBE token responses put fields on the root instead of data{}.
  const data = json.data
    || ((json.reference || json.receiptNo || json.amount != null || json.payer || json.payerName)
      ? json
      : null);
  if (!data) {
    return {
      ok: false,
      status: response.status,
      error: 'missing data',
      json,
    };
  }

  return { ok: true, data, status: response.status };
}

/**
 * Telebirr official lookup via Petros verifier (ET network path).
 * Tries /verify-telebirr then universal /verify.
 */
export async function fetchTelebirrViaPetros(invoiceId) {
  if (!isPetrosVerifierConfigured()) return null;

  const id = normalizeTelebirrInvoiceId(invoiceId) || normalizeTxCode(invoiceId);
  if (!id) return null;

  const started = Date.now();
  const attempts = [
    { path: '/verify-telebirr', body: { reference: id } },
    { path: '/verify', body: { reference: id, bank: 'telebirr' } },
  ];

  for (const attempt of attempts) {
    try {
      const result = await postPetrosVerify(attempt.path, attempt.body, id);
      if (!result.ok) {
        console.warn('[Petros]', attempt.path, 'failed', id, result.status, safeLogText(result.error));
        continue;
      }

      const mapped = mapPetrosTelebirrPayload(result.data, id);
      if (!mapped) {
        console.warn('[Petros]', attempt.path, 'unmapped', id, result.data?.transactionStatus);
        continue;
      }

      console.log(
        '[Petros] telebirr ok',
        mapped.transactionCode,
        'amount',
        mapped.amount,
        `via ${attempt.path}`,
        `${Date.now() - started}ms`,
      );
      return mapped;
    } catch (err) {
      console.warn('[Petros]', attempt.path, 'error', id, safeLogText(err?.message || err));
    }
  }

  return null;
}

/** Map remote CBE JSON into Deresegn official fields. */
export function mapPetrosCbePayload(data, ftReference) {
  if (!data || typeof data !== 'object') return null;

  const transactionCode = normalizeTxCode(
    data.reference
    || data.referenceNumber
    || data.transactionReference
    || data.id
    || (/^FT/i.test(String(ftReference || '')) ? ftReference : null),
  );
  const amount = parseBirrAmount(data.amount)
    ?? parseBirrAmount(data.transferredAmount)
    ?? parseBirrAmount(data.totalAmount)
    ?? parseBirrAmount(data.totalDebited);
  if (!transactionCode || amount == null) return null;

  return {
    transactionCode,
    amount: String(amount),
    senderName: data.payerName || data.payer || data.senderName || data.debitAccountHolder || null,
    senderAccount: data.payerAccount || data.senderAccount || data.debitAccountNo || null,
    receiverName: data.receiverName || data.receiver || data.creditAccountHolder || null,
    receiverAccount: data.receiverAccount || data.creditAccountNo || null,
    source: 'petros_verifier_api',
  };
}

/**
 * CBE lookup via Petros — token/URL (new) or FT + last-8 (legacy).
 */
export async function fetchCbeViaPetros(reference, accountSuffix) {
  if (!isPetrosVerifierConfigured()) return null;

  const raw = String(reference || '').trim();
  if (!raw) return null;

  const { extractCbeMbReceiptToken } = await import('./qrService.js');
  const token = extractCbeMbReceiptToken(raw);
  const started = Date.now();

  let attempts;
  let logId;

  if (token) {
    logId = token;
    attempts = [
      { path: '/verify-cbe', body: { reference: token } },
      { path: '/verify-cbe', body: { reference: `https://mbreciept.cbe.com.et/${token}` } },
      { path: '/verify', body: { reference: token, bank: 'cbe' } },
    ];
  } else {
    const ft = normalizeTxCode(raw);
    const digits = String(accountSuffix || '').replace(/\D/g, '');
    const suffix = digits.length >= 8 ? digits.slice(-8) : '';
    if (!ft || !/^FT[A-Z0-9]{8,}$/i.test(ft) || !suffix) return null;
    logId = ft;
    attempts = [
      { path: '/verify-cbe', body: { reference: ft, accountSuffix: suffix } },
      { path: '/verify', body: { reference: ft, suffix, bank: 'cbe' } },
      { path: '/verify', body: { reference: ft, accountSuffix: suffix, bank: 'cbe' } },
    ];
  }

  for (const attempt of attempts) {
    try {
      const result = await postPetrosVerify(attempt.path, attempt.body, logId);
      if (!result.ok) {
        console.warn('[Petros]', attempt.path, 'failed', logId, result.status, safeLogText(result.error));
        if (/Could not find Chrome|Puppeteer failed|puppeteer/i.test(String(result.error || ''))) {
          break;
        }
        continue;
      }

      const mapped = mapPetrosCbePayload(result.data, logId);
      if (!mapped) {
        console.warn('[Petros]', attempt.path, 'unmapped', logId);
        continue;
      }

      console.log(
        '[Petros] cbe ok',
        mapped.transactionCode,
        'amount',
        mapped.amount,
        `via ${attempt.path}`,
        `${Date.now() - started}ms`,
      );
      return mapped;
    } catch (err) {
      console.warn('[Petros]', attempt.path, 'error', logId, safeLogText(err?.message || err));
    }
  }

  return null;
}
