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
