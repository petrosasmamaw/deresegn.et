function issue(type, code, field, message, extra = {}) {
  return { type, code, field, message, ...extra };
}

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeAccount(value) {
  const raw = String(value || '').trim();
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

function normalizeTxCode(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
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

function txCodesMatch(a, b) {
  const na = normalizeTxCode(a);
  const nb = normalizeTxCode(b);
  if (!na || !nb) return false;
  return na === nb;
}

function allTxCodesMatch(...candidates) {
  const codes = candidates.map(normalizeTxCode).filter(Boolean);
  if (codes.length <= 1) return true;
  return codes.every((c) => c === codes[0]);
}

export function buildDuplicateTxIssue(txCode) {
  return issue('error', 'DUPLICATE_TX', 'transactionCode',
    `Payment ID "${txCode}" was already verified. Each receipt can only be checked once.`,
    { actual: txCode });
}

export function validateReceiptSubmission({
  method,
  form,
  extracted,
  qrData,
  geminiUsed = true,
  geminiError = null,
}) {
  const issues = [];

  if (!['telebirr', 'cbe'].includes(method)) {
    issues.push(issue('error', 'METHOD_INVALID', 'method', 'Payment method must be Telebirr or CBE Birr.'));
  }

  const requiredFields = [
    ['senderName', 'Sender name'],
    ['senderAccount', 'Sender account'],
    ['receiverName', 'Receiver name'],
    ['receiverAccount', 'Receiver account'],
    ['amount', 'Amount'],
    ['transactionCode', 'Payment / transaction ID'],
  ];

  for (const [field, label] of requiredFields) {
    if (!String(form[field] || '').trim()) {
      issues.push(issue('error', 'FIELD_REQUIRED', field, `${label} is required.`));
    }
  }

  const formTx = normalizeTxCode(form.transactionCode);
  const screenshotTx = normalizeTxCode(extracted?.transactionCode);
  const qrTx = normalizeTxCode(qrData?.transactionCode);

  if (method === 'telebirr' && !qrTx) {
    issues.push(issue('error', 'QR_UNREADABLE', 'transactionCode',
      'Could not read the QR code on your Telebirr receipt. Upload a clear screenshot with the QR visible at the bottom.',
      { qrValue: null }));
  }

  if (qrTx && screenshotTx && !txCodesMatch(qrTx, screenshotTx)) {
    issues.push(issue('error', 'FRAUD_EDITED_RECEIPT', 'transactionCode',
      `Receipt may be edited — screenshot shows "${screenshotTx}" but the QR code proves "${qrTx}".`,
      { screenshotValue: screenshotTx, qrValue: qrTx }));
  }

  if (qrTx && formTx && !txCodesMatch(qrTx, formTx)) {
    issues.push(issue('error', 'TX_FORM_QR_MISMATCH', 'transactionCode',
      `Payment ID you entered ("${formTx}") does not match the QR code ("${qrTx}").`,
      { formValue: formTx, qrValue: qrTx }));
  }

  if (geminiUsed && screenshotTx && formTx && !txCodesMatch(screenshotTx, formTx)) {
    issues.push(issue('error', 'TX_FORM_SCREENSHOT_MISMATCH', 'transactionCode',
      `Payment ID you entered ("${formTx}") does not match the screenshot ("${screenshotTx}").`,
      { formValue: formTx, screenshotValue: screenshotTx }));
  }

  if (qrTx && screenshotTx && formTx && !allTxCodesMatch(formTx, screenshotTx, qrTx)) {
    issues.push(issue('error', 'TX_CODE_MISMATCH', 'transactionCode',
      `Form ("${formTx}"), screenshot ("${screenshotTx}"), and QR ("${qrTx}") must all match.`,
      { formValue: formTx, screenshotValue: screenshotTx, qrValue: qrTx }));
  }

  if (geminiUsed && extracted?.senderName && form.senderName && !namesMatch(form.senderName, extracted.senderName)) {
    issues.push(issue('error', 'SENDER_NAME_MISMATCH', 'senderName',
      `Sender name you entered ("${form.senderName}") does not match the screenshot ("${extracted.senderName}").`,
      { formValue: form.senderName, screenshotValue: extracted.senderName }));
  }

  if (geminiUsed && extracted?.senderAccount && form.senderAccount && !accountsMatch(form.senderAccount, extracted.senderAccount)) {
    issues.push(issue('error', 'SENDER_ACCOUNT_MISMATCH', 'senderAccount',
      `Sender account you entered ("${form.senderAccount}") does not match the screenshot ("${extracted.senderAccount}").`,
      { formValue: form.senderAccount, screenshotValue: extracted.senderAccount }));
  }

  if (geminiUsed && extracted?.receiverName && form.receiverName && !namesMatch(form.receiverName, extracted.receiverName)) {
    issues.push(issue('error', 'RECEIVER_NAME_MISMATCH', 'receiverName',
      `Receiver name you entered ("${form.receiverName}") does not match the screenshot ("${extracted.receiverName}").`,
      { formValue: form.receiverName, screenshotValue: extracted.receiverName }));
  }

  if (geminiUsed && extracted?.receiverAccount && form.receiverAccount && !accountsMatch(form.receiverAccount, extracted.receiverAccount)) {
    issues.push(issue('error', 'RECEIVER_ACCOUNT_MISMATCH', 'receiverAccount',
      `Receiver account you entered ("${form.receiverAccount}") does not match the screenshot ("${extracted.receiverAccount}").`,
      { formValue: form.receiverAccount, screenshotValue: extracted.receiverAccount }));
  }

  if (geminiUsed && extracted?.amount != null && form.amount && !amountsMatch(form.amount, extracted.amount)) {
    issues.push(issue('error', 'AMOUNT_FORM_SCREENSHOT_MISMATCH', 'amount',
      `Amount you entered (${form.amount}) does not match the screenshot (${extracted.amount}).`,
      { formValue: form.amount, screenshotValue: extracted.amount }));
  }

  if (!geminiUsed) {
    const aiMsg = geminiError || 'AI screenshot reading was unavailable.';
    issues.push(issue('warning', 'AI_UNAVAILABLE', null,
      `${aiMsg} Cross-checking form against QR code only.`));
  }

  if (qrTx && geminiUsed && screenshotTx && txCodesMatch(qrTx, screenshotTx) && txCodesMatch(qrTx, formTx)) {
    issues.push(issue('warning', 'QR_VERIFIED', 'transactionCode',
      `QR code verified — payment ID ${qrTx} matches your form and screenshot.`));
  }

  const txCode = qrTx || screenshotTx || formTx;
  if (!txCode) {
    issues.push(issue('error', 'TX_CODE_INVALID', 'transactionCode',
      'Could not determine a valid payment ID from your form, screenshot, or QR code.'));
  }

  const errors = issues.filter((i) => i.type === 'error');
  const warnings = issues.filter((i) => i.type === 'warning');

  const hasFraud = errors.some((i) => i.code === 'FRAUD_EDITED_RECEIPT');
  const filteredErrors = hasFraud
    ? errors.filter((i) => !['TX_FORM_QR_MISMATCH', 'TX_CODE_MISMATCH', 'TX_FORM_SCREENSHOT_MISMATCH'].includes(i.code))
    : errors;

  return {
    passed: filteredErrors.length === 0,
    txCode,
    issues,
    errors: filteredErrors.map((i) => i.message),
    warnings: warnings.map((i) => i.message),
    extracted,
    qrData,
    geminiUsed,
  };
}
