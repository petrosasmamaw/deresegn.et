import { normalizeTxCode } from './txCode.js';

/** Telebirr Invoice No. — always 10 chars (DFC+7, DF+8, DG+8, etc.). */
export const TELEBIRR_INVOICE_RE = /^(?:[A-Z]{3}[A-Z0-9]{7}|[A-Z]{2}[A-Z0-9]{8})$/i;
export const TELEBIRR_INVOICE_SEARCH = /\b([A-Z]{2,3}[A-Z0-9]{7,8})\b/gi;

export function normalizeTelebirrInvoiceId(value) {
  const id = normalizeTxCode(value);
  if (!id) return null;

  const exact = id.match(TELEBIRR_INVOICE_RE);
  if (exact) return exact[0].toUpperCase();

  if (id.length > 10) {
    const trimmed = id.slice(0, 10);
    const t = trimmed.match(TELEBIRR_INVOICE_RE);
    if (t) return t[0].toUpperCase();
  }

  return null;
}

/** Pull Telebirr invoice ID from receipt text, URLs, or labels (OCR / SMS / pasted text). */
export function extractTelebirrInvoiceFromText(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  const urlMatch = raw.match(
    /transactioninfo\.ethiotelecom\.et\/receipt\/([A-Z0-9]+)/i,
  )?.[1];
  if (urlMatch) {
    const fromUrl = normalizeTelebirrInvoiceId(urlMatch);
    if (fromUrl) return fromUrl;
  }

  const labeled = raw.match(
    /(?:invoice\s*(?:no\.?|number|#)?|transaction\s*(?:no\.?|number|#)?|payment\s*id)[:\s#-]*([A-Z0-9]{8,12})/i,
  )?.[1];
  if (labeled) {
    const fromLabel = normalizeTelebirrInvoiceId(labeled);
    if (fromLabel) return fromLabel;
  }

  const matches = [...raw.matchAll(TELEBIRR_INVOICE_SEARCH)];
  for (const match of matches) {
    const normalized = normalizeTelebirrInvoiceId(match[1]);
    if (normalized) return normalized;
  }

  return null;
}

/** Scan all OCR fields for a Telebirr invoice candidate. */
export function extractTelebirrInvoiceFromExtracted(extracted) {
  if (!extracted) return null;

  const direct = normalizeTelebirrInvoiceId(extracted.transactionCode);
  if (direct) return direct;

  for (const value of Object.values(extracted)) {
    if (value == null) continue;
    const fromText = extractTelebirrInvoiceFromText(String(value));
    if (fromText) return fromText;
  }

  return null;
}
