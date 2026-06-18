/** Supported payment methods and per-bank receipt layout rules (trained on sample screenshots). */

export const PAYMENT_METHODS = ['telebirr', 'cbe', 'boa', 'dashen'];

export const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'Commercial Bank of Ethiopia (CBE)',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
};

export function isSupportedMethod(method) {
  return PAYMENT_METHODS.includes(method);
}

export function getMethodLabel(method) {
  return METHOD_LABELS[method] || method;
}

export function requiresQrCode(method) {
  return PAYMENT_METHODS.includes(method);
}

export function getQrMissingMessage(method) {
  const bank = getMethodLabel(method);
  return `Your screenshot must include a QR code. Upload a full ${bank} receipt with the QR code clearly visible.`;
}

export function getTransactionCodePlaceholder(method) {
  const placeholders = {
    telebirr: 'e.g. DFC7TG1O11',
    cbe: 'e.g. FT26169D8C5M',
    boa: 'e.g. FT26169X4SRS',
    dashen: 'e.g. 110IPSS2616900WO',
  };
  return placeholders[method] || 'Payment / transaction reference';
}

const JSON_SCHEMA = `{
  "senderName": string or null,
  "senderAccount": string or null,
  "receiverName": string or null,
  "receiverAccount": string or null,
  "amount": number or null,
  "date": string or null,
  "transactionCode": string or null
}`;

const BASE_RULES = `Return ONLY valid JSON (no markdown, no code fences):
${JSON_SCHEMA}

General rules:
- Amount must be the transferred value in ETB (numeric only, no currency text or commas).
- Do NOT use totals that include service charge, VAT, or disaster recovery fees unless no transfer amount is visible.
- For masked accounts, return exactly as shown (e.g. 1****493, 5110******011, ETB-7112).
- If text is cut off at the edge of the screenshot, extract what is visible and leave missing fields as null.
- transactionCode must be the single primary payment/reference ID for the transfer.`;

const METHOD_PROMPTS = {
  telebirr: `${BASE_RULES}

This is a Telebirr mobile wallet receipt.
Field mapping:
- senderName = "Payer" name
- senderAccount = "Payer" phone/account
- receiverName = "Credited Party" name
- receiverAccount = "Credited Party" phone/account
- amount = "Settled Amount" (NOT "Total Paid Amount" which includes fees)
- transactionCode = "Invoice No." (usually starts with DFC)
- date = payment date as shown`,

  boa: `${BASE_RULES}

This is a Bank of Abyssinia transfer receipt (white receipt with gold star logo).
Field mapping:
- senderName = "Source Account Name"
- senderAccount = "Source Account"
- receiverName = "Receiver Name"
- receiverAccount = "Receiver Account"
- amount = "Amount" row (ETB value only)
- transactionCode = "Transaction Reference" (usually starts with FT)
- date = "Transaction Date" as shown (e.g. 18/06/2026, 10:17:52)
The QR code appears at the bottom with "Scan the QR to Verify".`,

  cbe: `${BASE_RULES}

This is a Commercial Bank of Ethiopia (CBE) mobile banking success receipt (purple header, gold CBE logo).
Common layouts:
1) Success card showing recipient, account (ETB-XXXX), and "transaction ID: FT..."
2) Transaction summary paragraph: "ETB X has been debited from [sender] for [receiver] ... transaction ID: FT..."

Field mapping:
- senderName = person/account debited (sender in summary)
- senderAccount = sender account (may appear as ETB-0027 style)
- receiverName = person/account credited
- receiverAccount = receiver account (may appear as ETB-7112 style)
- amount = transfer amount in the summary (e.g. 10.0), NOT "Total Amount Debited" with fees
- transactionCode = "transaction ID" or "Transaction ID" (FT prefix)
- date = transaction date/time as shown`,

  dashen: `${BASE_RULES}

This is a Dashen Bank receipt. Two common layouts:
1) Formal "Dashen Bank Super App Electronic Value Added Tax Receipt" with a transaction table
2) Dark app screen titled "Successfully paid!" with sender/recipient details and QR overlay

Field mapping:
- senderName = "Sender Name" or sender on success screen
- senderAccount = "Sender Account" / "Sender Account Number" (masked OK)
- receiverName = "Receiver Name" / "Recipient Name"
- receiverAccount = "Receiver Account" / "Recipient Account"
- amount = "Transaction Amount" or main paid amount (e.g. 100.00), NOT total with service charge/VAT
- transactionCode = "Transaction Reference" (e.g. 110IPSS2616900WO). Prefer this over "Transfer Reference".
- date = "Transaction Date" as shown`,
};

export function buildExtractionPrompt(method) {
  const normalized = isSupportedMethod(method) ? method : 'telebirr';
  return `You are analyzing an Ethiopian payment receipt screenshot for ${getMethodLabel(normalized)}.

${METHOD_PROMPTS[normalized]}`;
}
