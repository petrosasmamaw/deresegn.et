import {
  isSupportedMethod,
  getMethodLabel,
  requiresQrCode,
  getQrMissingMessage,
} from './receiptFormats.js';
import {
  analyzeQrAuthenticity,
  isQrTrustworthyForMethod,
  buildFakeQrIssue,
} from './qrAuthenticityService.js';
import { normalizeTxCode, txCodesMatch } from '../utils/txCode.js';
import {
  extractQrReceiptFields,
  detectScreenshotCropped,
  mergeReceiptSources,
} from './qrFieldExtractor.js';

function issue(type, code, field, message, extra = {}) {
  return { type, code, field, message, ...extra };
}

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

function txCodesConflict(qr, screenshot) {
  const qrCode = normalizeTxCode(qr);
  const screenshotCode = normalizeTxCode(screenshot);
  if (!qrCode || !screenshotCode) return false;
  if (txCodesMatch(qrCode, screenshotCode)) return false;
  if (qrCode.startsWith(screenshotCode) || screenshotCode.startsWith(qrCode)) return false;
  return true;
}

function allTxCodesMatch(...candidates) {
  const codes = candidates.map(normalizeTxCode).filter(Boolean);
  if (codes.length <= 1) return true;
  const first = codes[0];
  return codes.every((c) => txCodesMatch(c, first));
}

function fieldMismatch(field, label, a, b, aLabel, bLabel) {
  if (!a || !b) return null;
  const isAccount = field.includes('Account');
  const isAmount = field === 'amount';
  const match = isAmount ? amountsMatch(a, b) : isAccount ? accountsMatch(a, b) : namesMatch(a, b);
  if (match) return null;
  return issue('error', `${field.toUpperCase()}_MISMATCH`, field,
    `${label} error: ${aLabel} shows "${a}" but ${bLabel} shows "${b}".`,
    { leftValue: a, rightValue: b });
}

export function buildDuplicateTxIssue(txCode) {
  return issue('error', 'DUPLICATE_TX', 'transactionCode',
    `Payment ID "${txCode}" was already verified. Each receipt can only be checked once.`,
    { actual: txCode });
}

function validateTopUpReceiver({
  issues,
  method,
  expectedReceiver,
  extracted,
  qrFields,
  screenshotCropped,
  geminiUsed,
}) {
  const expectedName = expectedReceiver.receiverName;
  const expectedAccount = expectedReceiver.receiverAccount;

  const qrAccount = qrFields.receiverAccount;
  const qrName = qrFields.receiverName;
  const shotAccount = extracted?.receiverAccount;
  const shotName = extracted?.receiverName;

  if (screenshotCropped && method === 'telebirr') {
    if (!qrAccount || !accountsMatch(qrAccount, expectedAccount)) {
      issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
        `Receiver account error: QR data does not match your registered account "${expectedAccount}".`,
        { qrValue: qrAccount, expectedValue: expectedAccount }));
    }
    if (qrName && !namesMatch(qrName, expectedName)) {
      issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
        `Receiver name error: QR data shows "${qrName}" but top-up must be sent to "${expectedName}".`,
        { qrValue: qrName, expectedValue: expectedName }));
    } else if (shotName && !namesMatch(shotName, expectedName)) {
      issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
        `Receiver name error: receipt shows "${shotName}" but top-up must be sent to "${expectedName}".`,
        { screenshotValue: shotName, expectedValue: expectedName }));
    }
    return;
  }

  if (screenshotCropped && method === 'cbe') {
    if (!geminiUsed) {
      issues.push(issue('error', 'AI_UNAVAILABLE', null,
        'Could not read receipt screenshot. Upload a clearer image showing receiver details.'));
      return;
    }
    if (!shotAccount || !accountsMatch(shotAccount, expectedAccount)) {
      issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
        `Receiver account error: receipt shows "${shotAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
        { screenshotValue: shotAccount, expectedValue: expectedAccount }));
    }
    if (!shotName || !namesMatch(shotName, expectedName)) {
      issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
        `Receiver name error: receipt shows "${shotName || 'unknown'}" but top-up must be sent to "${expectedName}".`,
        { screenshotValue: shotName, expectedValue: expectedName }));
    }
    return;
  }

  if (!geminiUsed) {
    issues.push(issue('error', 'AI_UNAVAILABLE', null,
      'Could not read receipt screenshot. Upload a clearer image.'));
    return;
  }

  if (!shotName || !namesMatch(shotName, expectedName)) {
    issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
      `Receiver name error: receipt shows "${shotName || 'unknown'}" but top-up must be sent to "${expectedName}".`,
      { screenshotValue: shotName, expectedValue: expectedName }));
  }
  if (!shotAccount || !accountsMatch(shotAccount, expectedAccount)) {
    issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
      `Receiver account error: receipt shows "${shotAccount || 'unknown'}" but top-up must be sent to "${expectedAccount}".`,
      { screenshotValue: shotAccount, expectedValue: expectedAccount }));
  }

  if (qrAccount && !accountsMatch(qrAccount, expectedAccount)) {
    issues.push(issue('error', 'RECEIVER_ACCOUNT_QR_MISMATCH', 'receiverAccount',
      `Receiver account error: QR data does not match your registered account "${expectedAccount}".`,
      { qrValue: qrAccount, expectedValue: expectedAccount }));
  }
  if (qrName && !namesMatch(qrName, expectedName)) {
    issues.push(issue('error', 'RECEIVER_NAME_QR_MISMATCH', 'receiverName',
      `Receiver name error: QR data shows "${qrName}" but top-up must be sent to "${expectedName}".`,
      { qrValue: qrName, expectedValue: expectedName }));
  }

  const acctCross = fieldMismatch('receiverAccount', 'Receiver account', shotAccount, qrAccount, 'screenshot', 'QR code');
  if (acctCross && shotAccount && qrAccount) issues.push(acctCross);
  const nameCross = fieldMismatch('receiverName', 'Receiver name', shotName, qrName, 'screenshot', 'QR code');
  if (nameCross && shotName && qrName) issues.push(nameCross);
}

function validateFormAgainstQr({ issues, form, qrFields, method }) {
  const formTx = normalizeTxCode(form.transactionCode);
  const qrTx = normalizeTxCode(qrFields.transactionCode);

  if (qrTx && formTx && !txCodesMatch(qrTx, formTx)) {
    issues.push(issue('error', 'TX_FORM_QR_MISMATCH', 'transactionCode',
      `Payment ID error: you entered "${formTx}" but the QR code shows "${qrTx}".`,
      { formValue: formTx, qrValue: qrTx }));
  }

  const pairs = [
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
  ];

  for (const [field, label] of pairs) {
    const formVal = form[field];
    const qrVal = qrFields[field];
    if (!formVal || !qrVal) continue;
    const mismatch = fieldMismatch(field, label, formVal, qrVal, 'your entry', 'QR code');
    if (mismatch) issues.push(mismatch);
  }

  if (method === 'telebirr' && qrTx && !formTx) {
    issues.push(issue('error', 'TX_CODE_INVALID', 'transactionCode',
      'Payment ID error: could not match your entry with the QR code.'));
  }
}

function validateScreenshotAgainstQr({ issues, extracted, qrFields }) {
  const pairs = [
    ['transactionCode', 'Payment ID'],
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
  ];

  for (const [field, label] of pairs) {
    const shotVal = field === 'transactionCode' ? extracted?.transactionCode : extracted?.[field];
    const qrVal = field === 'transactionCode' ? qrFields.transactionCode : qrFields[field];
    if (field === 'amount') {
      const s = shotVal != null ? String(shotVal) : null;
      const q = qrVal != null ? String(qrVal) : null;
      const mismatch = fieldMismatch(field, label, s, q, 'screenshot', 'QR code');
      if (mismatch) issues.push(mismatch);
      continue;
    }
    const mismatch = fieldMismatch(field, label, shotVal, qrVal, 'screenshot', 'QR code');
    if (mismatch) issues.push(mismatch);
  }
}

function validateFormAgainstScreenshot({ issues, form, extracted }) {
  const pairs = [
    ['transactionCode', 'Payment ID'],
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
  ];

  for (const [field, label] of pairs) {
    const formVal = form[field];
    const shotVal = field === 'transactionCode' ? extracted?.transactionCode : extracted?.[field];
    if (!formVal || shotVal == null || shotVal === '') continue;
    const mismatch = fieldMismatch(
      field,
      label,
      field === 'amount' ? String(formVal) : formVal,
      field === 'amount' ? String(shotVal) : shotVal,
      'your entry',
      'screenshot',
    );
    if (mismatch) issues.push(mismatch);
  }
}

export function validateReceiptSubmission({
  method,
  form,
  extracted,
  qrData,
  geminiUsed = true,
  geminiError = null,
  withDetails = true,
  expectedReceiver = null,
  qrFields: providedQrFields = null,
}) {
  const issues = [];
  const isTopUp = Boolean(expectedReceiver);

  if (!isSupportedMethod(method)) {
    issues.push(issue('error', 'METHOD_INVALID', 'method',
      `Payment method must be one of: ${['Telebirr', 'CBE', 'Bank of Abyssinia', 'Dashen Bank'].join(', ')}.`));
  }

  const requiredFields = [
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
    ['transactionCode', 'Payment / transaction ID'],
  ];

  if (withDetails && !isTopUp) {
    for (const [field, label] of requiredFields) {
      if (!String(form[field] || '').trim()) {
        issues.push(issue('error', 'FIELD_REQUIRED', field, `${label} is required.`));
      }
    }
  }

  const qrFields = providedQrFields || extractQrReceiptFields(method, qrData);
  const formTx = normalizeTxCode(form.transactionCode);
  const screenshotTx = normalizeTxCode(extracted?.transactionCode);
  const qrTx = normalizeTxCode(qrFields.transactionCode || qrData?.transactionCode);
  const qrFound = Boolean(qrData?.raw);
  const qrAuthenticity = qrFound ? analyzeQrAuthenticity(method, qrData.raw) : null;
  const qrAuthentic = Boolean(qrAuthenticity?.authentic);

  const screenshotCropped = detectScreenshotCropped({
    extracted,
    qrTx,
    screenshotTx,
    qrAuthentic,
    qrFields,
  });

  if (requiresQrCode(method)) {
    if (!qrFound) {
      issues.push(issue('error', 'QR_MISSING', 'screenshot', getQrMissingMessage(method), { qrValue: null }));
    } else if (qrAuthenticity && !qrAuthenticity.authentic) {
      const fakeIssue = buildFakeQrIssue(qrAuthenticity, method);
      issues.push(issue('error', fakeIssue.code, fakeIssue.field, fakeIssue.message, { qrFormat: qrAuthenticity.format }));
    } else if (method === 'telebirr' && !qrTx) {
      issues.push(issue('error', 'QR_UNREADABLE', 'transactionCode',
        `A QR code was found on your ${getMethodLabel(method)} receipt but could not be read clearly. Upload a sharper screenshot with the full QR code visible.`,
        { qrValue: null }));
    }
  }

  if (!screenshotCropped && qrTx && screenshotTx && txCodesConflict(qrTx, screenshotTx)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Payment ID error: screenshot shows "${screenshotTx}" but the QR code shows "${qrTx}".`,
      { screenshotValue: screenshotTx, qrValue: qrTx }));
  }

  const qrVerifiedWithForm = withDetails && !isTopUp && isQrTrustworthyForMethod(method, {
    authenticity: qrAuthenticity,
    transactionCode: qrTx,
    formTx,
    screenshotTx: screenshotCropped ? null : screenshotTx,
  });

  if (isTopUp) {
    validateTopUpReceiver({
      issues,
      method,
      expectedReceiver,
      extracted,
      qrFields,
      screenshotCropped,
      geminiUsed,
    });

    const qrAmount = parseFloat(qrFields.amount);
    const shotAmount = parseFloat(extracted?.amount);
    const topUpAmount = qrAmount || shotAmount;

    if (!topUpAmount || topUpAmount <= 0) {
      issues.push(issue('error', 'AMOUNT_UNREADABLE', 'amount',
        screenshotCropped
          ? 'Amount error: could not read amount from QR code. Upload a clearer screenshot with the QR code visible.'
          : 'Amount error: could not read amount from QR code or screenshot.'));
    } else if (!screenshotCropped && qrFields.amount && extracted?.amount != null
      && !amountsMatch(qrFields.amount, extracted.amount)) {
      issues.push(issue('error', 'AMOUNT_QR_SCREENSHOT_MISMATCH', 'amount',
        `Amount error: screenshot shows ${extracted.amount} but QR code shows ${qrFields.amount}.`,
        { screenshotValue: extracted.amount, qrValue: qrFields.amount }));
    }
  } else if (withDetails) {
    if (screenshotCropped) {
      validateFormAgainstQr({ issues, form, qrFields, method });
      if (qrAuthentic) {
        issues.push(issue('warning', 'SCREENSHOT_CROPPED', null,
          'Receipt text appears cut off. Verification used your entered details and the QR code only.'));
      }
    } else {
      if (!qrVerifiedWithForm) {
        validateFormAgainstScreenshot({ issues, form, extracted });
        validateFormAgainstQr({ issues, form, qrFields, method });

        if (qrTx && screenshotTx && formTx && !allTxCodesMatch(formTx, screenshotTx, qrTx)) {
          issues.push(issue('error', 'TX_CODE_MISMATCH', 'transactionCode',
            `Payment ID error: form "${formTx}", screenshot "${screenshotTx}", and QR "${qrTx}" do not all match.`,
            { formValue: formTx, screenshotValue: screenshotTx, qrValue: qrTx }));
        }

        if (geminiUsed) {
          validateScreenshotAgainstQr({ issues, extracted, qrFields });
        }
      }

    if (qrVerifiedWithForm) {
      issues.push(issue('warning', 'QR_VERIFIED', 'transactionCode',
        method === 'telebirr'
          ? `QR code verified — payment ID ${formTx || qrTx} matches your form.`
          : `Official ${getMethodLabel(method)} QR verified — payment ID ${formTx} matches the receipt.`));

      if (!screenshotCropped && geminiUsed) {
        const partial = ['transactionCode', 'senderName', 'senderAccount', 'receiverName', 'receiverAccount', 'amount']
          .some((field) => {
            const fv = field === 'transactionCode' ? form[field] : form[field];
            const sv = field === 'transactionCode' ? extracted?.transactionCode : extracted?.[field];
            if (!fv || sv == null || sv === '') return false;
            return fieldMismatch(field, field, fv, sv, 'your entry', 'screenshot');
          });
        if (partial) {
          issues.push(issue('warning', 'SCREENSHOT_TEXT_PARTIAL', null,
            'Some receipt text was unclear, but verification passed using your form and the QR code.'));
        }
      }
    }
    }
  } else {
    if (screenshotCropped) {
      if (qrAuthentic) {
        const cropMsg = qrFields?.cbeApiSource
          ? 'Receipt text appears cut off. Transaction details were loaded from the official CBE QR code.'
          : qrFields?.dashenApiSource
            ? 'Receipt text appears cut off. Transaction details were loaded from the official Dashen Bank receipt.'
            : qrFields?.dashenSuperAppSource
              ? 'Dashen Super App success screen verified using the official QR code and visible receipt details.'
              : qrFields?.boaApiSource
              ? 'Receipt text appears cut off. Transaction details were loaded from the official Bank of Abyssinia QR code.'
              : `Receipt text appears cut off. Verification used the official ${getMethodLabel(method)} QR code only.`;
        issues.push(issue('warning', 'SCREENSHOT_CROPPED', null, cropMsg));
      }
      const amt = parseFloat(qrFields.amount) || parseFloat(extracted?.amount);
      if (!amt || amt <= 0) {
        issues.push(issue('error', 'AMOUNT_UNREADABLE', 'amount',
          'Amount error: could not read amount from QR code. Upload a clearer screenshot with the full QR code visible.'));
      }
    } else if (geminiUsed) {
      validateScreenshotAgainstQr({ issues, extracted, qrFields });

      const amt = parseFloat(qrFields.amount) || parseFloat(extracted?.amount);
      if (!amt || amt <= 0) {
        issues.push(issue('error', 'AMOUNT_UNREADABLE', 'amount',
          'Amount error: could not read amount from screenshot or QR code.'));
      }
    } else if (!geminiUsed) {
      issues.push(issue('warning', 'AI_UNAVAILABLE', null,
        `${geminiError || 'AI screenshot reading was unavailable.'} QR code was still checked.`));
    }
  }

  if (!isTopUp && !withDetails && !screenshotCropped && !geminiUsed) {
    issues.push(issue('warning', 'AI_UNAVAILABLE', null,
      `${geminiError || 'AI screenshot reading was unavailable.'} QR code was still checked.`));
  }

  if (qrAuthentic && !isTopUp) {
    issues.push(issue('warning', 'QR_VERIFIED', 'transactionCode',
      `Official ${getMethodLabel(method)} QR code verified — not fake.`));
  }

  const txCode = qrTx || screenshotTx || (withDetails ? formTx : null);
  if (!txCode && !(isTopUp && qrAuthentic && method === 'cbe' && qrData?.verificationToken)
    && !(qrAuthentic && method === 'dashen' && (qrFields?.dashenApiSource || qrFields?.dashenSuperAppSource || qrData?.dashenReceiptToken))) {
    issues.push(issue('error', 'TX_CODE_INVALID', 'transactionCode',
      withDetails
        ? 'Payment ID error: could not determine a valid payment ID from your form, screenshot, or QR code.'
        : 'Payment ID error: could not read payment ID from screenshot or QR code.'));
  }

  const preferQr = screenshotCropped || isTopUp || (
    !extracted?.senderName && Boolean(qrFields?.senderName)
  ) || qrFields?.cbeApiSource || qrFields?.dashenApiSource || qrFields?.dashenSuperAppSource || qrFields?.boaApiSource;
  const merged = mergeReceiptSources({
    extracted,
    qrFields,
    form: withDetails ? form : {},
    preferQr,
  });

  const qrAmountVal = parseFloat(qrFields.amount);
  const shotAmountVal = parseFloat(extracted?.amount);

  const resolvedDetails = isTopUp
    ? {
        senderName: merged.senderName || extracted?.senderName || '',
        senderAccount: merged.senderAccount || extracted?.senderAccount || '',
        receiverName: expectedReceiver.receiverName,
        receiverAccount: expectedReceiver.receiverAccount,
        amount: String(qrAmountVal || shotAmountVal || ''),
        transactionCode: txCode || qrData?.verificationToken || '',
      }
    : withDetails
      ? {
          senderName: form.senderName || merged.senderName || '',
          senderAccount: form.senderAccount || merged.senderAccount || '',
          receiverName: form.receiverName || merged.receiverName || '',
          receiverAccount: form.receiverAccount || merged.receiverAccount || '',
          amount: form.amount != null ? String(form.amount) : (merged.amount || ''),
          transactionCode: txCode || '',
        }
      : {
          senderName: merged.senderName || '',
          senderAccount: merged.senderAccount || '',
          receiverName: merged.receiverName || '',
          receiverAccount: merged.receiverAccount || '',
          amount: merged.amount || '',
          transactionCode: txCode || qrData?.verificationToken || '',
        };

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  const hasFraud = errors.some((i) => i.code === 'FRAUD_EDITED_RECEIPT');
  const filteredErrors = hasFraud
    ? errors.filter((i) => !['TX_FORM_QR_MISMATCH', 'TX_CODE_MISMATCH', 'TX_FORM_SCREENSHOT_MISMATCH'].includes(i.code))
    : errors;

  return {
    passed: filteredErrors.length === 0,
    txCode: txCode || (method === 'cbe' ? qrData?.verificationToken : null),
    issues,
    errors: filteredErrors.map((i) => i.message),
    warnings: warnings.map((i) => i.message),
    extracted,
    qrData,
    qrFields,
    qrAuthenticity,
    geminiUsed,
    withDetails,
    screenshotCropped,
    resolvedDetails,
  };
}
