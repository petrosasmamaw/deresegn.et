import { normalizeTxCode } from '../utils/txCode.js';
import { extractTelebirrInvoiceFromPayload } from './qrService.js';
import { outboundFetch } from '../utils/outboundFetch.js';
import { httpsGetText } from '../utils/httpsGet.js';

const TELEBIRR_RECEIPT_BASE = 'https://transactioninfo.ethiotelecom.et/receipt/';
const isProduction = process.env.NODE_ENV === 'production';
const TELEBIRR_TIMEOUT_MS = Number(process.env.TELEBIRR_FETCH_TIMEOUT_MS)
  || (isProduction ? 55000 : 20000);
const TELEBIRR_RETRIES = Number(process.env.TELEBIRR_FETCH_RETRIES)
  || (isProduction ? 3 : 1);
const inflightReceiptFetches = new Map();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const TELEBIRR_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,*/*',
  Referer: 'https://transactioninfo.ethiotelecom.et/',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** Telebirr receipt page — native HTTPS first (Render-compatible), fetch() fallback. */
async function fetchTelebirrHtml(url, invoiceId) {
  let lastError = null;

  for (let attempt = 0; attempt <= TELEBIRR_RETRIES; attempt += 1) {
    try {
      const res = await httpsGetText(url, {
        timeoutMs: TELEBIRR_TIMEOUT_MS,
        headers: TELEBIRR_HEADERS,
      });
      if (res.ok && res.text) return res.text;
      console.warn('[Telebirr] HTTPS HTTP', res.status, invoiceId);
    } catch (err) {
      lastError = err;
      console.warn('[Telebirr] HTTPS attempt', attempt + 1, invoiceId, err.message);
    }

    try {
      const response = await outboundFetch(url, {
        timeoutMs: TELEBIRR_TIMEOUT_MS,
        retries: 0,
        headers: { ...TELEBIRR_HEADERS, Connection: 'close' },
      });
      if (response.ok) return await response.text();
      console.warn('[Telebirr] fetch HTTP', response.status, invoiceId);
    } catch (err) {
      lastError = err;
      console.warn('[Telebirr] fetch attempt', attempt + 1, invoiceId, err.message);
    }

    if (attempt < TELEBIRR_RETRIES) {
      await sleep(600 * (attempt + 1));
    }
  }

  if (lastError) console.warn('[Telebirr] all attempts failed', invoiceId, lastError.message);
  return null;
}

function parseAmount(value) {
  if (value == null) return null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function cleanCell(raw) {
  return String(raw || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pick value cell immediately after a bilingual label row — mirrors ethiobank_receipts tele.py */
function pickLabel(html, labelPattern) {
  const re = new RegExp(
    `<td[^>]*>[\\s\\S]*?${labelPattern}[\\s\\S]*?</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`,
    'i',
  );
  const value = cleanCell(html.match(re)?.[1]);
  return value || null;
}

function mapTelebirrHtml(html, invoiceId) {
  if (!html || /receipt not found|invalid receipt|transaction not found/i.test(html)) return null;

  const statusMatch = html.match(/transaction\s*status[\s\S]{0,120}?<td[^>]*>([\s\S]*?)<\/td>/i);
  const status = cleanCell(statusMatch?.[1]);
  if (status && !/success|completed|paid|approved/i.test(status)) {
    return null;
  }

  const amountRaw = pickLabel(html, 'Total\\s*Paid\\s*Amount');
  const amount = parseAmount(amountRaw);
  const tx = normalizeTxCode(invoiceId);
  if (!tx || !amount) return null;

  return {
    transactionCode: tx,
    amount: String(amount),
    senderName: pickLabel(html, 'Payer\\s*Name') || null,
    senderAccount: pickLabel(html, 'Payer\\s*telebirr') || null,
    receiverName: pickLabel(html, 'Credited\\s*Party\\s*name') || null,
    receiverAccount: pickLabel(html, 'Credited\\s*party\\s*account\\s*no') || null,
    status: status || null,
    source: 'telebirr_official_web',
  };
}

/** Telebirr invoice IDs are 10 chars: DFC + 7 or DF + 8. */
export function normalizeTelebirrInvoiceId(value) {
  const id = normalizeTxCode(value);
  if (!id || !/^DF[A-Z0-9]{6,12}$/i.test(id)) return null;

  const exact = id.match(/^(DFC[A-Z0-9]{7}|DF[A-Z0-9]{8})$/i);
  if (exact) return exact[1].toUpperCase();

  if (id.length > 10 && /^DF/i.test(id)) {
    const trimmed = id.slice(0, 10);
    const t = trimmed.match(/^(DFC[A-Z0-9]{7}|DF[A-Z0-9]{8})$/i);
    if (t) return t[1].toUpperCase();
  }

  return id.toUpperCase();
}

function nearbyTelebirrInvoices(invoiceId) {
  const id = normalizeTelebirrInvoiceId(invoiceId);
  if (!id || id.length < 8) return [];

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const prefix = id.slice(0, -1);
  const last = id.slice(-1);
  const variants = [];

  if (id.length > 10) variants.push(id.slice(0, 10));

  for (const ch of chars) {
    if (ch !== last) variants.push(prefix + ch);
  }
  return variants;
}

export function collectTelebirrInvoiceCandidates(qrData, extracted = null) {
  const candidates = new Set();
  const fromQr = extractTelebirrInvoiceFromPayload(qrData?.raw)
    || normalizeTelebirrInvoiceId(qrData?.transactionCode);
  const fromShot = normalizeTelebirrInvoiceId(extracted?.transactionCode);

  if (fromShot) candidates.add(fromShot);
  if (fromQr) candidates.add(fromQr);
  if (fromQr?.length > 10) candidates.add(fromQr.slice(0, 10));

  return { candidates: [...candidates], qrInvoice: fromQr, screenshotInvoice: fromShot };
}

export async function fetchTelebirrReceipt(invoiceId) {
  const id = normalizeTelebirrInvoiceId(invoiceId) || normalizeTxCode(invoiceId);
  if (!id) return null;

  if (inflightReceiptFetches.has(id)) {
    return inflightReceiptFetches.get(id);
  }

  const fetchPromise = (async () => {
    const url = `${TELEBIRR_RECEIPT_BASE}${encodeURIComponent(id)}`;
    try {
      const html = await fetchTelebirrHtml(url, id);
      if (!html) return null;

      const mapped = mapTelebirrHtml(html, id);
      if (mapped) {
        console.log('[Telebirr] Official receipt loaded:', id, 'amount', mapped.amount);
      }
      return mapped;
    } catch (err) {
      console.warn('[Telebirr]', err.message);
      return null;
    } finally {
      inflightReceiptFetches.delete(id);
    }
  })();

  inflightReceiptFetches.set(id, fetchPromise);
  return fetchPromise;
}

export async function fetchTelebirrTransactionFromQr(qrData, extracted = null) {
  const result = await resolveTelebirrOfficialReceipt({ qrData, extracted });
  return result?.official || null;
}

/**
 * Load official Telebirr record — tries screenshot invoice, QR invoice, then nearby corrections.
 * Fixes QR scan typos like DF52MV8ILWC → DF52MV8ILW via official web lookup.
 */
function buildTelebirrResolveHit({
  official,
  matchedId,
  qrInvoice,
  screenshotInvoice,
}) {
  const qrMisread = Boolean(qrInvoice && qrInvoice !== official.transactionCode);
  const screenshotEdited = Boolean(
    screenshotInvoice
    && screenshotInvoice !== official.transactionCode,
  );
  return {
    official,
    matchedInvoice: official.transactionCode,
    qrInvoice,
    screenshotInvoice,
    qrMisread,
    screenshotEdited,
    verifiedVia: matchedId === screenshotInvoice
      ? 'screenshot_invoice'
      : matchedId === qrInvoice
        ? 'qr_invoice'
        : 'nearby_invoice',
  };
}

async function fetchTelebirrReceiptCached(id, prefetchById = null) {
  if (prefetchById?.[id]) return prefetchById[id];
  return fetchTelebirrReceipt(id);
}

export async function resolveTelebirrOfficialReceipt({
  qrData,
  extracted = null,
  screenshotPrefetch = null,
  qrPrefetch = null,
} = {}) {
  const { candidates, qrInvoice, screenshotInvoice } = collectTelebirrInvoiceCandidates(qrData, extracted);

  const empty = {
    official: null,
    matchedInvoice: null,
    qrInvoice,
    screenshotInvoice,
    qrMisread: false,
    screenshotEdited: false,
    verifiedVia: null,
  };

  if (!candidates.length) return empty;

  // Prefer screenshot invoice when readable (usually more accurate than noisy QR parse)
  const ordered = screenshotInvoice
    ? [screenshotInvoice, ...candidates.filter((c) => c !== screenshotInvoice)]
    : candidates;

  const prefetchById = {};
  for (const prefetch of [screenshotPrefetch, qrPrefetch]) {
    if (prefetch?.invoiceId && prefetch?.official) {
      prefetchById[prefetch.invoiceId] = prefetch.official;
    }
  }

  const results = await Promise.all(
    ordered.map((id) => fetchTelebirrReceiptCached(id, prefetchById)),
  );

  for (let i = 0; i < ordered.length; i += 1) {
    const official = results[i];
    if (official) {
      return buildTelebirrResolveHit({
        official,
        matchedId: ordered[i],
        qrInvoice,
        screenshotInvoice,
      });
    }
  }

  // QR misread: try single-character mutations on the QR-parsed invoice
  if (qrInvoice) {
    const nearby = nearbyTelebirrInvoices(qrInvoice);
    for (let i = 0; i < nearby.length; i += 8) {
      const batch = nearby.slice(i, i + 8);
      const results = await Promise.all(batch.map((id) => fetchTelebirrReceipt(id)));
      const idx = results.findIndex(Boolean);
      if (idx >= 0) {
        const official = results[idx];
        console.warn('[Telebirr] QR invoice corrected:', qrInvoice, '→', official.transactionCode);
        return buildTelebirrResolveHit({
          official,
          matchedId: batch[idx],
          qrInvoice,
          screenshotInvoice,
        });
      }
    }
  }

  return empty;
}

export function resolveTelebirrInvoiceId(qrData, extracted = null) {
  const { candidates, qrInvoice, screenshotInvoice } = collectTelebirrInvoiceCandidates(qrData, extracted);
  return screenshotInvoice || qrInvoice || candidates[0] || null;
}

export function mergeTelebirrApiIntoQrFields(qrFields, telebirrFields) {
  if (!telebirrFields) return qrFields;

  return {
    ...qrFields,
    transactionCode: telebirrFields.transactionCode || qrFields.transactionCode,
    amount: telebirrFields.amount || qrFields.amount,
    senderName: telebirrFields.senderName || qrFields.senderName,
    senderAccount: telebirrFields.senderAccount || qrFields.senderAccount,
    receiverName: telebirrFields.receiverName || qrFields.receiverName,
    receiverAccount: telebirrFields.receiverAccount || qrFields.receiverAccount,
    telebirrApiSource: true,
  };
}
