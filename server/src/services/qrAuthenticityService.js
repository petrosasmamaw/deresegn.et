import { extractTelebirrInvoiceFromPayload } from './qrService.js';
import { normalizeTxCode, txCodesMatch } from '../utils/txCode.js';

const FAKE_QR_HOSTS = [
  'qr-code-generator.com',
  'goqr.me',
  'qrcode.tec-it.com',
  'api.qrserver.com',
  'chart.googleapis.com',
  'quickchart.io',
  'qrcode-monkey.com',
  'unitag.io',
  'scanova.io',
];

const BANK_DOMAINS = {
  cbe: ['mbreciept.cbe.com.et'],
  boa: ['bankofabyssinia.com', 'boa.com.et', 'verify.bankofabyssinia.com'],
  dashen: ['dashenbanksc.com', 'dashensuperapp.com', 'dashenbank.com'],
};

function isPlainTransactionCode(text) {
  const t = String(text || '').trim();
  if (!t || t.length > 32) return false;
  return /^(DFC[A-Z0-9]{6,14}|FT[A-Z0-9]{8,14}|\d{3}IPSS[A-Z0-9]{8,}|IPSS\d+[A-Z0-9]+)$/i.test(t);
}
function isSignedBankBinaryQr(text) {
  const t = String(text || '').trim();
  if (t.length < 80 || t.length > 400) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(t)) return false;
  if (isPlainTransactionCode(t)) return false;
  try {
    const buf = Buffer.from(t, 'base64');
    return buf.length >= 48;
  } catch {
    return false;
  }
}

function isHighEntropyBase64(text, minLength = 60) {
  const t = String(text || '').trim();
  if (t.length < minLength) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(t)) return false;
  try {
    const buf = Buffer.from(t, 'base64');
    if (buf.length < 40) return false;
    const printable = buf.toString('ascii').replace(/[^\x20-\x7E]/g, '');
    // Signed bank payloads are mostly binary, not readable transaction IDs.
    return printable.length < buf.length * 0.7;
  } catch {
    return false;
  }
}

function parseUrl(text) {
  try {
    return new URL(String(text || '').trim());
  } catch {
    return null;
  }
}

function isFakeQrHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return FAKE_QR_HOSTS.some((fake) => host === fake || host.endsWith(`.${fake}`));
}

function hasOfficialDomain(method, hostname) {
  const domains = BANK_DOMAINS[method] || [];
  const host = String(hostname || '').toLowerCase();
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

function detectQrFormat(raw) {
  const text = String(raw || '').trim();
  if (!text) return 'empty';

  const url = parseUrl(text);
  if (url) {
    if (isFakeQrHost(url.hostname)) return 'fake_generator_url';
    if (/mbreciept\.cbe\.com\.et$/i.test(url.hostname)) return 'cbe_url';
    if (/dashen/i.test(url.hostname)) return 'dashen_url';
    if (/bankofabyssinia|boa\.com/i.test(url.hostname)) return 'boa_url';
    return 'generic_url';
  }

  if (extractTelebirrInvoiceFromPayload(text)) return 'telebirr_signed';
  if (isPlainTransactionCode(text)) return 'plain_tx_code';
  if (isSignedBankBinaryQr(text)) return 'bank_signed_binary';
  if (isHighEntropyBase64(text, 80)) return 'signed_binary';
  if (isHighEntropyBase64(text, 50)) return 'signed_binary_short';

  try {
    JSON.parse(text);
    return 'json_payload';
  } catch {
    // not json
  }

  if (text.length >= 8 && text.length <= 64) return 'plain_text';
  return 'unknown';
}

export function analyzeQrAuthenticity(method, raw) {
  const format = detectQrFormat(raw);
  const result = {
    authentic: false,
    format,
    bank: method,
    reasons: [],
  };

  if (!raw) {
    result.reasons.push('No QR payload found.');
    return result;
  }

  const text = String(raw).trim();

  if (format === 'fake_generator_url') {
    result.reasons.push('QR code points to a public QR generator website, not a bank.');
    return result;
  }

  if (format === 'plain_tx_code') {
    result.reasons.push('QR contains only a plain payment ID. Real bank receipts use signed QR codes or official verification URLs.');
    return result;
  }

  switch (method) {
    case 'telebirr': {
      if (format === 'telebirr_signed') {
        result.authentic = true;
        result.reasons.push('Telebirr signed binary QR detected.');
        return result;
      }
      if (format === 'signed_binary' || format === 'signed_binary_short' || format === 'bank_signed_binary') {
        result.authentic = true;
        result.reasons.push('Telebirr-style signed QR payload detected.');
        return result;
      }
      if (format === 'generic_url' || format === 'plain_text') {
        result.reasons.push('QR does not match Telebirr signed receipt format.');
        return result;
      }
      break;
    }

    case 'cbe': {
      const url = parseUrl(text);
      if (format === 'cbe_url' && url) {
        const token = url.pathname.replace(/^\//, '');
        if (/^v2-[a-z0-9]{10,}$/i.test(token)) {
          result.authentic = true;
          result.verificationToken = token;
          result.verificationUrl = text;
          result.reasons.push('Official CBE Mbreciept verification URL detected.');
          return result;
        }
        result.reasons.push('CBE QR URL format is invalid.');
        return result;
      }
      if (format === 'plain_tx_code' || format === 'plain_text') {
        result.reasons.push('CBE receipts use https://mbreciept.cbe.com.et/v2-… verification URLs, not plain text QR codes.');
        return result;
      }
      if (url && !hasOfficialDomain('cbe', url.hostname)) {
        result.reasons.push(`QR URL host "${url.hostname}" is not the official CBE verification domain.`);
        return result;
      }
      result.reasons.push('QR does not match CBE official receipt format.');
      return result;
    }

    case 'boa': {
      const url = parseUrl(text);
      if (format === 'boa_url' && url && hasOfficialDomain('boa', url.hostname)) {
        result.authentic = true;
        result.verificationUrl = text;
        result.reasons.push('Official Bank of Abyssinia verification URL detected.');
        return result;
      }
      if (format === 'signed_binary' || format === 'signed_binary_short' || format === 'bank_signed_binary') {
        result.authentic = true;
        result.reasons.push('Bank of Abyssinia signed binary QR detected.');
        return result;
      }
      if (format === 'plain_tx_code' || format === 'plain_text' || format === 'generic_url') {
        result.reasons.push('Bank of Abyssinia receipts use signed binary QR codes, not plain payment IDs or random URLs.');
        return result;
      }
      if (url && !hasOfficialDomain('boa', url.hostname)) {
        result.reasons.push(`QR URL host "${url.hostname}" is not an official Bank of Abyssinia domain.`);
        return result;
      }
      result.reasons.push('QR does not match Bank of Abyssinia signed receipt format.');
      return result;
    }

    case 'dashen': {
      const url = parseUrl(text);
      if (format === 'dashen_url' && url && hasOfficialDomain('dashen', url.hostname)) {
        result.authentic = true;
        result.verificationUrl = text;
        result.reasons.push('Official Dashen Bank verification URL detected.');
        return result;
      }
      if (format === 'signed_binary' || format === 'signed_binary_short' || format === 'bank_signed_binary') {
        result.authentic = true;
        result.reasons.push('Dashen Bank signed QR payload detected.');
        return result;
      }
      if (/IPSS/i.test(text) && text.length > 40 && format !== 'plain_tx_code') {
        result.authentic = true;
        result.reasons.push('Dashen structured IPSS QR payload detected.');
        return result;
      }
      if (format === 'plain_tx_code') {
        result.reasons.push('Dashen receipts use signed QR codes or official URLs, not a plain IPSS reference only.');
        return result;
      }
      if (url && !hasOfficialDomain('dashen', url.hostname)) {
        result.reasons.push(`QR URL host "${url.hostname}" is not an official Dashen Bank domain.`);
        return result;
      }
      result.reasons.push('QR does not match Dashen Bank receipt format.');
      return result;
    }

    default:
      result.reasons.push('Unknown payment method.');
      return result;
  }

  result.reasons.push('QR format could not be verified as an official bank receipt.');
  return result;
}

/** Whether the QR can be trusted for this bank (may differ from tx code matching). */
export function isQrTrustworthyForMethod(method, { authenticity, transactionCode, formTx, screenshotTx }) {
  if (!authenticity?.authentic) return false;

  const form = normalizeTxCode(formTx);
  const screenshot = normalizeTxCode(screenshotTx);
  const qrTx = normalizeTxCode(transactionCode);

  switch (method) {
    case 'telebirr':
      return Boolean(qrTx && form && txCodesMatch(qrTx, form));

    case 'cbe':
      return Boolean(form && screenshot && txCodesMatch(screenshot, form));

    case 'boa':
      return Boolean(form && screenshot && txCodesMatch(screenshot, form));

    case 'dashen':
      if (qrTx && form && txCodesMatch(qrTx, form)) return true;
      return Boolean(form && screenshot && txCodesMatch(screenshot, form));

    default:
      return false;
  }
}

export function buildFakeQrIssue(authenticity, method) {
  const bank = method === 'cbe' ? 'CBE' : method === 'boa' ? 'Bank of Abyssinia' : method === 'dashen' ? 'Dashen Bank' : 'Telebirr';
  const detail = authenticity?.reasons?.[0]
    || 'This QR code does not match the format used by real bank receipts.';
  return {
    type: 'error',
    code: 'FAKE_QR_CODE',
    field: 'screenshot',
    message: `Fake or generated QR code detected on ${bank} receipt. ${detail}`,
    qrFormat: authenticity?.format,
  };
}
