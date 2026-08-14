import { normalizeTxCode } from '../utils/txCode.js';
import { fetchTelebirrReceipt, normalizeTelebirrInvoiceId } from './telebirrReceiptService.js';
import { fetchDashenTransactionByReference } from './dashenService.js';
import {
  fetchCbeTransactionByReference,
  fetchCbeTransactionFromQr,
} from './cbeReceiptService.js';
import { fetchBoaTransactionByReference } from './boaReceiptService.js';
import { extractCbeMbReceiptToken } from './qrService.js';
import { fetchCbeViaPetros, isPetrosVerifierConfigured } from './petrosVerifierService.js';

const DASHEN_IPSS_RE = /\d{3}(?:IPSS|OBTS|ETAP)[A-Z0-9]{8,}/i;
export const REFERENCE_SCREENSHOT_PLACEHOLDER = 'reference://payment-id-verification';

export const REFERENCE_INPUT_GUIDE = {
  telebirr: {
    label: 'Telebirr',
    summary: 'Invoice No. only',
    fields: [
      {
        key: 'transactionCode',
        label: 'Invoice No.',
        placeholder: 'DF52MV8ILW',
        hint: '10-character invoice number from your Telebirr receipt',
      },
    ],
  },
  dashen: {
    label: 'Dashen',
    summary: 'IPSS reference only (VAT receipts)',
    fields: [
      {
        key: 'transactionCode',
        label: 'IPSS Reference',
        placeholder: '110IPSS2616900WO',
        hint: 'VAT receipt reference — Super App QR tokens are not supported here',
      },
    ],
  },
  cbe: {
    label: 'CBE',
    summary: 'FT + last 8 digits, or mbreciept / v2-token',
    fields: [
      {
        key: 'transactionCode',
        label: 'Payment ID or receipt link',
        placeholder: 'FT26226GC3H3 or https://mbreciept.cbe.com.et/v2-…',
        hint: 'FT reference (needs last 8 digits) or the mbreciept.cbe.com.et / v2- link from SMS.',
      },
      {
        key: 'accountSuffix',
        label: 'Last 8 digits of CBE account',
        placeholder: '33687112',
        hint: 'Last 8 digits of sender or receiver CBE account (or paste the full 13-digit number). Not needed for v2- / mbreciept links.',
        optionalWhenToken: true,
      },
    ],
  },
  boa: {
    label: 'Bank of Abyssinia',
    summary: 'FT/TT reference + full 9-digit sender account',
    fields: [
      {
        key: 'transactionCode',
        label: 'Payment ID (FT / TT)',
        placeholder: 'FT26169X4SRS or TT26171RW0YG',
        hint: 'Transaction reference starting with FT or TT',
      },
      {
        key: 'accountSuffix',
        label: 'Sender account number',
        placeholder: '246302723',
        hint: 'Full 9-digit BOA account that sent the money (we use the last 5 digits)',
      },
    ],
  },
};

function validationError(message, field = 'transactionCode') {
  const err = new Error(message);
  err.field = field;
  err.isValidation = true;
  return err;
}

export function validateReferenceInput(method, { transactionCode, accountSuffix }) {
  const code = String(transactionCode || '').trim();
  const suffix = String(accountSuffix || '').trim();

  if (!code) {
    throw validationError('Payment reference is required', 'transactionCode');
  }

  switch (method) {
    case 'telebirr': {
      const id = normalizeTelebirrInvoiceId(code);
      if (!id) {
        throw validationError('Enter a valid Telebirr Invoice No. (10 characters, e.g. DG65L5I9M5)', 'transactionCode');
      }
      return { transactionCode: id, accountSuffix: null };
    }
    case 'dashen': {
      const ref = normalizeTxCode(code);
      if (!ref || !DASHEN_IPSS_RE.test(ref)) {
        throw validationError(
          'Enter a valid Dashen IPSS reference from a VAT receipt (e.g. 110IPSS2616900WO). Super App receipts need screenshot + QR verification.',
          'transactionCode',
        );
      }
      if (/superappreceipt/i.test(ref)) {
        throw validationError('Dashen Super App receipts cannot be verified by reference alone. Use screenshot + QR.', 'transactionCode');
      }
      return { transactionCode: ref, accountSuffix: null };
    }
    case 'cbe': {
      const token = extractCbeMbReceiptToken(code);
      if (token) {
        return { transactionCode: token, accountSuffix: null, cbeMode: 'token' };
      }
      const ft = normalizeTxCode(code);
      const digits = suffix.replace(/\D/g, '');
      if (!ft || !/^FT[A-Z0-9]{8,}$/i.test(ft)) {
        throw validationError(
          'Enter a CBE Payment ID (FT…) plus last 8 account digits, or paste the mbreciept.cbe.com.et / v2- link from SMS.',
          'transactionCode',
        );
      }
      if (digits.length < 8) {
        throw validationError(
          'Enter the last 8 digits of the CBE account (e.g. 33687112), or the full 13-digit number.',
          'accountSuffix',
        );
      }
      return { transactionCode: ft, accountSuffix: digits.slice(-8), cbeMode: 'legacy' };
    }
    case 'boa': {
      const ref = normalizeTxCode(code);
      const digits = suffix.replace(/\D/g, '');
      if (!ref || !/^(?:FT|TT)[A-Z0-9]{8,}$/i.test(ref)) {
        throw validationError('Enter a valid BOA payment ID starting with FT or TT (e.g. FT26169X4SRS or TT26171RW0YG)', 'transactionCode');
      }
      if (digits.length < 5) {
        throw validationError('Enter the full 9-digit BOA sender account (e.g. 246302723)', 'accountSuffix');
      }
      return { transactionCode: ref, accountSuffix: digits.slice(-5) };
    }
    default:
      throw validationError('Unsupported payment method', 'method');
  }
}

async function lookupCbeOfficial(validated) {
  if (validated.cbeMode === 'token') {
    const fromApi = await fetchCbeTransactionFromQr({ verificationToken: validated.transactionCode });
    if (fromApi) return fromApi;
    if (isPetrosVerifierConfigured()) {
      const fromPetros = await fetchCbeViaPetros(validated.transactionCode, null);
      if (fromPetros) return fromPetros;
    }
    return null;
  }
  return fetchCbeTransactionByReference(validated.transactionCode, validated.accountSuffix);
}

export async function lookupOfficialByReference(method, input) {
  const validated = validateReferenceInput(method, input);

  let official = null;
  try {
    switch (method) {
      case 'telebirr':
        official = await fetchTelebirrReceipt(validated.transactionCode);
        break;
      case 'dashen':
        official = await fetchDashenTransactionByReference(validated.transactionCode);
        break;
      case 'cbe':
        official = await lookupCbeOfficial(validated);
        break;
      case 'boa':
        official = await fetchBoaTransactionByReference(validated.transactionCode, validated.accountSuffix);
        break;
      default:
        throw validationError('Unsupported payment method', 'method');
    }
  } catch (err) {
    if (err?.code === 'CBE_UNREACHABLE' || err?.isValidation) {
      return {
        passed: false,
        validated,
        official: null,
        resolvedDetails: null,
        txCode: validated.transactionCode,
        message: err.message,
        issues: [{
          type: 'error',
          code: err.code || 'VALIDATION_ERROR',
          field: err.field || 'transactionCode',
          message: err.message,
        }],
      };
    }
    throw err;
  }

  if (!official?.transactionCode || !official?.amount) {
    console.warn('[Reference] No official record:', method, validated.transactionCode, validated.accountSuffix || '');
    const notFoundMessage = method === 'cbe' && validated.cbeMode === 'token'
      ? 'No official CBE record for this receipt link/token. Check the mbreciept link and try again.'
      : method === 'cbe'
        ? 'No official CBE record for this FT + last 8 digits. If you have the SMS, paste the mbreciept.cbe.com.et / v2- link instead.'
        : 'No official bank record found for this payment ID. Check the reference and account digits, then try again.';
    return {
      passed: false,
      validated,
      official: null,
      resolvedDetails: null,
      txCode: validated.transactionCode,
      message: notFoundMessage,
      issues: [{
        type: 'error',
        code: 'OFFICIAL_RECORD_NOT_FOUND',
        field: 'transactionCode',
        message: notFoundMessage,
      }],
    };
  }

  const txCode = normalizeTxCode(official.transactionCode) || validated.transactionCode;
  const resolvedDetails = {
    senderName: official.senderName || '',
    senderAccount: official.senderAccount || '',
    receiverName: official.receiverName || '',
    receiverAccount: official.receiverAccount || '',
    amount: official.amount,
    transactionCode: txCode,
  };

  return {
    passed: true,
    validated,
    official,
    resolvedDetails,
    txCode,
    message: 'Payment verified from official bank record',
  };
}
