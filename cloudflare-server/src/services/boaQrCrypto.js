import crypto from 'crypto';
import { normalizeTxCode } from '../utils/txCode.js';

/** Keys extracted from cs.bankofabyssinia.com/slip SPA (same as receipt QR generation). */
const BOA_QR_PASSPHRASE = 'ELqVy2g4pGWLUIKSa+1ijwpPy6eDxBFBLBPrJ24v/IA=';
const BOA_QR_SALT = 'salt';
const BOA_QR_IV = '1234567890123456';

let cachedKey = null;

function deriveBoaQrKey() {
  if (cachedKey) return cachedKey;
  cachedKey = crypto.pbkdf2Sync(BOA_QR_PASSPHRASE, BOA_QR_SALT, 10000, 32, 'sha1');
  return cachedKey;
}

function parseAmount(value) {
  if (value == null) return null;
  const n = parseFloat(String(value).replace(/[^\d.]/g, ''));
  return Number.isNaN(n) || n <= 0 ? null : n;
}

function maskAccountNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length <= 4) return digits;
  return `${digits[0]}****${digits.slice(-3)}`;
}

/**
 * Decrypt BOA signed QR payload (AES-256-CBC + PBKDF2, same as official slip page).
 * Returns comma-separated plaintext or null.
 */
export function decryptBoaQrPayload(raw) {
  const text = String(raw || '').trim();
  if (!text || text.length < 80 || /^https?:\/\//i.test(text)) return null;

  try {
    const key = deriveBoaQrKey();
    const iv = Buffer.from(BOA_QR_IV, 'utf8');
    const encrypted = Buffer.from(text, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    if (!plain || plain.length < 8) return null;
    if (!/FT[A-Z0-9]{6,}/i.test(plain)) return null;
    return plain;
  } catch {
    return null;
  }
}

/**
 * Parse decrypted BOA QR CSV into receipt fields.
 * Format from slip SPA:
 * sourceAccount, sourceName, amount, transactionRef, date, [receiverAccount, receiverName]
 */
export function parseBoaQrPlaintext(plaintext) {
  const parts = String(plaintext || '').split(',').map((p) => p.trim());
  if (parts.length < 4) return null;

  const [
    sourceAccount,
    sourceName,
    amountRaw,
    transactionCode,
    date,
    receiverAccountRaw,
    receiverName,
  ] = parts;

  const amount = parseAmount(amountRaw);
  const tx = normalizeTxCode(transactionCode);
  if (!tx || !amount) return null;

  const receiverAccount = receiverAccountRaw
    ? maskAccountNumber(receiverAccountRaw)
    : null;

  return {
    senderAccount: sourceAccount || maskAccountNumber(sourceAccount) || null,
    senderName: sourceName || null,
    amount: String(amount),
    transactionCode: tx,
    date: date || null,
    receiverAccount,
    receiverName: receiverName || null,
    receiverAccountFull: receiverAccountRaw ? String(receiverAccountRaw).replace(/\D/g, '') : null,
    source: 'boa_qr_decrypted',
  };
}

/** Decrypt QR raw payload and map to receipt fields. */
export function extractBoaFieldsFromQrPayload(raw) {
  const plain = decryptBoaQrPayload(raw);
  if (!plain) return null;
  const fields = parseBoaQrPlaintext(plain);
  if (!fields) return null;
  return { ...fields, boaQrDecrypted: true, plaintext: plain };
}
