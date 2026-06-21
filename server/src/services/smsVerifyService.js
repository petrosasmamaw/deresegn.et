import { normalizeTxCode } from '../utils/txCode.js';
import { parseSms } from './smsParserService.js';
import { fetchTelebirrReceipt } from './telebirrReceiptService.js';
import {
  fetchCbeBranchReceipt,
  fetchCbeTransactionByReference,
} from './cbeReceiptService.js';

export const SMS_SCREENSHOT_PLACEHOLDER = 'sms://verification';

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeAccount(value) {
  const raw = String(value || '').trim().replace(/^ETB[-\s]*/i, '');
  const digitParts = raw.replace(/[^\d*]/g, '').split('*').filter(Boolean);
  if (digitParts.length >= 2) {
    let combined = digitParts.join('');
    if (combined.startsWith('251') && combined.length >= 10) {
      return `0${combined.slice(3)}`;
    }
    return combined;
  }
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length >= 12) {
    digits = `0${digits.slice(3)}`;
  }
  return digits;
}

function namesMatch(a, b) {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const wordsA = na.split(' ').filter((w) => w.length > 2);
  const wordsB = nb.split(' ').filter((w) => w.length > 2);
  const overlap = wordsA.filter((w) => wordsB.some((x) => x.includes(w) || w.includes(x)));
  return overlap.length >= Math.min(2, Math.min(wordsA.length, wordsB.length));
}

function accountsMatch(a, b) {
  const aa = normalizeAccount(a);
  const ab = normalizeAccount(b);
  if (!aa || !ab) return false;
  if (aa === ab) return true;
  if (aa.endsWith(ab) || ab.endsWith(aa)) return true;
  if (aa.length >= 4 && ab.length >= 4 && aa.slice(-4) === ab.slice(-4)) return true;
  return false;
}

function amountsMatch(a, b) {
  const p = Number(String(a).replace(/,/g, ''));
  const f = Number(String(b).replace(/,/g, ''));
  if (Number.isNaN(p) || Number.isNaN(f)) return false;
  return Math.abs(p - f) <= 1;
}

function telebirrAmountsCompatible(officialAmount, smsAmount) {
  if (officialAmount == null || smsAmount == null) return true;
  const o = Number(String(officialAmount).replace(/,/g, ''));
  const s = Number(String(smsAmount).replace(/,/g, ''));
  if (Number.isNaN(o) || Number.isNaN(s)) return false;
  if (amountsMatch(o, s)) return true;
  return Math.abs(o - s) <= 2;
}

function issue(type, code, field, message, extra = {}) {
  return { type, code, field, message, ...extra };
}

async function fetchOfficialForSms(parsed) {
  if (parsed.method === 'telebirr') {
    if (!parsed.transactionCode) return null;
    return fetchTelebirrReceipt(parsed.transactionCode);
  }

  if (parsed.method === 'cbe') {
    if (parsed.receiptUrl) {
      const fromBranch = await fetchCbeBranchReceipt(parsed.receiptUrl);
      if (fromBranch) return fromBranch;
    }
    if (parsed.transactionCode && parsed.accountSuffix) {
      return fetchCbeTransactionByReference(parsed.transactionCode, parsed.accountSuffix);
    }
  }

  return null;
}

function validateParsedSms(parsed) {
  const issues = [];

  if (!parsed.transactionCode) {
    issues.push(issue('error', 'SMS_PARSE_FAILED', 'smsText',
      'Could not find a transaction reference in the SMS. Paste the full message including the receipt link.'));
  }

  if (parsed.method === 'telebirr') {
    if (!parsed.receiptUrl && !parsed.transactionCode) {
      issues.push(issue('error', 'SMS_PARSE_FAILED', 'smsText',
        'Telebirr SMS must include the receipt link or transaction number (DF…).'));
    }
    if (!parsed.amount) {
      issues.push(issue('error', 'SMS_PARSE_FAILED', 'smsText',
        'Could not read the transferred amount from the Telebirr SMS.'));
    }
  }

  if (parsed.method === 'cbe') {
    if (!parsed.receiptUrl) {
      issues.push(issue('error', 'SMS_PARSE_FAILED', 'smsText',
        'CBE SMS must include the BranchReceipt link (apps.cbe.com.et:100/BranchReceipt/…).'));
    }
    if (!parsed.amount) {
      issues.push(issue('error', 'SMS_PARSE_FAILED', 'smsText',
        'Could not read the credited/debited amount from the CBE SMS.'));
    }
  }

  return issues;
}

function crossCheckSmsVsOfficial(parsed, official) {
  const issues = [];
  const txCode = normalizeTxCode(official.transactionCode);
  const smsTx = normalizeTxCode(parsed.transactionCode);
  if (smsTx && txCode && smsTx !== txCode) {
    issues.push(issue('error', 'SMS_TX_MISMATCH', 'transactionCode',
      `SMS shows transaction "${smsTx}" but the official receipt is "${txCode}".`,
      { smsValue: smsTx, officialValue: txCode }));
  }

  if (parsed.method === 'telebirr') {
    if (parsed.amount && official.amount && !telebirrAmountsCompatible(official.amount, parsed.amount)) {
      issues.push(issue('error', 'SMS_AMOUNT_MISMATCH', 'amount',
        `SMS shows ETB ${parsed.amount} transferred but the official Telebirr receipt shows ETB ${official.amount}.`,
        { smsValue: parsed.amount, officialValue: official.amount }));
    }
    if (parsed.receiverName && official.receiverName && !namesMatch(parsed.receiverName, official.receiverName)) {
      issues.push(issue('error', 'SMS_RECEIVER_MISMATCH', 'receiverName',
        `SMS receiver "${parsed.receiverName}" does not match official receipt "${official.receiverName}".`,
        { smsValue: parsed.receiverName, officialValue: official.receiverName }));
    }
    if (parsed.receiverAccount && official.receiverAccount
      && !accountsMatch(parsed.receiverAccount, official.receiverAccount)) {
      issues.push(issue('error', 'SMS_RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
        `SMS receiver account "${parsed.receiverAccount}" does not match official receipt "${official.receiverAccount}".`,
        { smsValue: parsed.receiverAccount, officialValue: official.receiverAccount }));
    }
  }

  if (parsed.method === 'cbe') {
    if (parsed.amount && official.amount && !amountsMatch(parsed.amount, official.amount)) {
      issues.push(issue('error', 'SMS_AMOUNT_MISMATCH', 'amount',
        `SMS shows ETB ${parsed.amount} but the official CBE receipt shows ETB ${official.amount}.`,
        { smsValue: parsed.amount, officialValue: official.amount }));
    }

    const smsAccount = parsed.account;
    if (smsAccount) {
      const officialAccount = parsed.direction === 'credit'
        ? official.receiverAccount
        : official.senderAccount;
      if (officialAccount && !accountsMatch(smsAccount, officialAccount)) {
        issues.push(issue('error', 'SMS_ACCOUNT_MISMATCH', 'senderAccount',
          `SMS account "${smsAccount}" does not match the official CBE receipt account "${officialAccount}".`,
          { smsValue: smsAccount, officialValue: officialAccount }));
      }
    }
  }

  return issues;
}

export async function verifySmsTransaction(method, smsText) {
  const parsed = parseSms(smsText, method);
  const parseIssues = validateParsedSms(parsed);
  if (parseIssues.length) {
    return {
      passed: false,
      parsed,
      official: null,
      txCode: parsed.transactionCode || null,
      resolvedDetails: null,
      issues: parseIssues,
      message: parseIssues[0].message,
    };
  }

  const official = await fetchOfficialForSms(parsed);
  if (!official?.transactionCode || !official?.amount) {
    return {
      passed: false,
      parsed,
      official: null,
      txCode: parsed.transactionCode || null,
      resolvedDetails: null,
      issues: [issue('error', 'OFFICIAL_RECORD_NOT_FOUND', 'smsText',
        'Could not load the official receipt from the SMS link. The link may be expired or invalid.')],
      message: 'Could not load the official receipt from the SMS link.',
    };
  }

  const crossIssues = crossCheckSmsVsOfficial(parsed, official);
  const errors = crossIssues.filter((i) => i.type === 'error');
  if (errors.length) {
    return {
      passed: false,
      parsed,
      official,
      txCode: normalizeTxCode(official.transactionCode),
      resolvedDetails: null,
      issues: crossIssues,
      message: errors[0].message,
    };
  }

  const txCode = normalizeTxCode(official.transactionCode);
  const resolvedDetails = {
    senderName: official.senderName || parsed.senderName || parsed.customerName || '',
    senderAccount: official.senderAccount || '',
    receiverName: official.receiverName || parsed.receiverName || '',
    receiverAccount: official.receiverAccount || parsed.receiverAccount || parsed.account || '',
    amount: official.amount,
    transactionCode: txCode,
  };

  return {
    passed: true,
    parsed,
    official,
    txCode,
    resolvedDetails,
    issues: crossIssues.filter((i) => i.type === 'warning'),
    message: 'SMS verified against official receipt',
  };
}
