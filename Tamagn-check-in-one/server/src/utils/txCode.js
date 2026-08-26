/** Normalize payment / transaction reference (case-insensitive). */
export function normalizeTxCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

export function txCodesMatch(a, b) {
  const na = normalizeTxCode(a);
  const nb = normalizeTxCode(b);
  if (!na || !nb) return false;
  return na === nb;
}

export function isCbePaymentReference(value) {
  const clean = normalizeTxCode(value);
  return /^FT[A-Z0-9]{8,16}$/i.test(clean) || /^v2-[A-Za-z0-9_-]{8,80}$/i.test(clean);
}

export function isBoaPaymentReference(value) {
  const clean = normalizeTxCode(value);
  return /^(?:FT|TT)[A-Z0-9]{8,18}$/i.test(clean);
}
