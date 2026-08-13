import { normalizeTxCode } from '../utils/txCode.js';
import { fetchTelebirrReceipt, normalizeTelebirrInvoiceId } from './telebirrReceiptService.js';
import { fetchDashenTransactionByReference } from './dashenService.js';
import { fetchCbeTransactionByReference } from './cbeReceiptService.js';
import { fetchBoaTransactionByReference } from './boaReceiptService.js';

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
    summary: 'FT reference + last 8 digits of sender account',
    fields: [
      {
        key: 'transactionCode',
        label: 'FT Reference',
        placeholder: 'FT26169D8C5M',
        hint: 'Transaction reference starting with FT',
      },
      {
        key: 'accountSuffix',
        label: 'Last 8 digits of sender account',
        placeholder: '12345678',
        hint: 'Last 8 digits of the account that sent the money (your CBE account)',
      },
    ],
  },
  boa: {
    label: 'Bank of Abyssinia',
    summary: 'FT/TT reference + last 5 digits of sender account',
    fields: [
      {
        key: 'transactionCode',
        label: 'Payment ID (FT / TT)',
        placeholder: 'FT26169X4SRS or TT26171RW0YG',
        hint: 'Transaction reference starting with FT or TT',
      },
      {
        key: 'accountSuffix',
        label: 'Last 5 digits of sender account',
        placeholder: '12345',
        hint: 'Last 5 digits of the account that sent the money (your BOA account)',
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
      const ft = normalizeTxCode(code);
      const digits = suffix.replace(/\D/g, '');
      if (!ft || !/^FT[A-Z0-9]{8,}$/i.test(ft)) {
        throw validationError('Enter a valid CBE FT reference (e.g. FT26169D8C5M)', 'transactionCode');
      }
      if (digits.length < 8) {
        throw validationError('Enter the last 8 digits of the sender account', 'accountSuffix');
      }
      return { transactionCode: ft, accountSuffix: digits.slice(-8) };
    }
    case 'boa': {
      const ref = normalizeTxCode(code);
      const digits = suffix.replace(/\D/g, '');
      if (!ref || !/^(?:FT|TT)[A-Z0-9]{8,}$/i.test(ref)) {
        throw validationError('Enter a valid BOA payment ID starting with FT or TT (e.g. FT26169X4SRS or TT26171RW0YG)', 'transactionCode');
      }
      if (digits.length < 5) {
        throw validationError('Enter the last 5 digits of the sender account', 'accountSuffix');
      }
      return { transactionCode: ref, accountSuffix: digits.slice(-5) };
    }
    default:
      throw validationError('Unsupported payment method', 'method');
  }
}

export async function lookupOfficialByReference(method, input) {
  const validated = validateReferenceInput(method, input);

  let official = null;
  switch (method) {
    case 'telebirr':
      official = await fetchTelebirrReceipt(validated.transactionCode);
      break;
    case 'dashen':
      official = await fetchDashenTransactionByReference(validated.transactionCode);
      break;
    case 'cbe':
      official = await fetchCbeTransactionByReference(validated.transactionCode, validated.accountSuffix);
      break;
    case 'boa':
      official = await fetchBoaTransactionByReference(validated.transactionCode, validated.accountSuffix);
      break;
    default:
      throw validationError('Unsupported payment method', 'method');
  }

  if (!official?.transactionCode || !official?.amount) {
    console.warn('[Reference] No official record:', method, validated.transactionCode, validated.accountSuffix || '');
    return {
      passed: false,
      validated,
      official: null,
      resolvedDetails: null,
      txCode: validated.transactionCode,
      message: 'No official bank record found for this payment ID. Check the reference and account digits, then try again.',
      issues: [{
        type: 'error',
        code: 'OFFICIAL_RECORD_NOT_FOUND',
        field: 'transactionCode',
        message: 'No official bank record found for this payment ID. Check the reference and account digits, then try again.',
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
