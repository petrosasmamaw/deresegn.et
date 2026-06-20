import { normalizeTxCode } from '../utils/txCode.js';
import { extractTelebirrInvoiceFromPayload } from './qrService.js';

const TELEBIRR_RECEIPT_BASE = 'https://transactioninfo.ethiotelecom.et/receipt/';
const API_TIMEOUT_MS = 8000;

function parseAmount(value) {
  if (value == null) return null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

/** Pick value cell immediately after a bilingual label row — mirrors ethiobank_receipts tele.py */
function pickLabel(html, labelPattern) {
  const re = new RegExp(
    `<td[^>]*>\\s*(?:[^<]*?${labelPattern}[^<]*?)\\s*</td>\\s*<td[^>]*>\\s*([^<]+?)\\s*</td>`,
    'i',
  );
  return html.match(re)?.[1]?.trim() || null;
}

function mapTelebirrHtml(html, invoiceId) {
  if (!html || /not found|invalid|error/i.test(html.slice(0, 500))) return null;

  const status = pickLabel(html, 'transaction\\s*status');
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
    status: status || pickLabel(html, 'transaction\\s*status'),
    source: 'telebirr_official_web',
  };
}

export function resolveTelebirrInvoiceId(qrData, extracted = null) {
  const fromQr = extractTelebirrInvoiceFromPayload(qrData?.raw)
    || normalizeTxCode(qrData?.transactionCode);
  const fromShot = normalizeTxCode(extracted?.transactionCode);
  return fromQr || fromShot || null;
}

export async function fetchTelebirrReceipt(invoiceId) {
  const id = normalizeTxCode(invoiceId);
  if (!id) return null;

  const url = `${TELEBIRR_RECEIPT_BASE}${encodeURIComponent(id)}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
    });
    clearTimeout(timer);

    if (!response.ok) {
      console.warn('[Telebirr] HTTP', response.status, id);
      return null;
    }

    const html = await response.text();
    const mapped = mapTelebirrHtml(html, id);
    if (mapped) {
      console.log('[Telebirr] Official receipt loaded:', id, 'amount', mapped.amount);
    }
    return mapped;
  } catch (err) {
    console.warn('[Telebirr]', err.message);
    return null;
  }
}

export async function fetchTelebirrTransactionFromQr(qrData, extracted = null) {
  const invoiceId = resolveTelebirrInvoiceId(qrData, extracted);
  if (!invoiceId) return null;
  return fetchTelebirrReceipt(invoiceId);
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
