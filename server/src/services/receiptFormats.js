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

This is a Commercial Bank of Ethiopia (CBE) receipt. It may be one of these layouts:

### TYPE 1: Mobile success screen (purple header, gold CBE logo)
- Shows recipient, account (ETB-XXXX), and "transaction ID: FT..."
- Amount in summary is the transfer amount (e.g. 10.0), NOT "Total Amount Debited" with fees

### TYPE 2: VAT / web receipt (white page, "Payment / Transaction Informations" table)
- Header may show "VAT Receipt No" matching the Reference No (FT…)
- Table rows: Payer, Account (sender), Receiver, Account (receiver), Reference No., Transferred Amount, Service Charge, Total amount debited
- amount = "Transferred Amount" row ONLY (e.g. 50.00) — NOT "Total amount debited" (e.g. 50.61 with fees)
- transactionCode = "Reference No." or "VAT Receipt No" (FT prefix)
- senderAccount / receiverAccount = masked accounts as shown (e.g. 1****7112)
- QR code at bottom (official mbreciept.cbe.com.et link)

Field mapping (both types):
- senderName = payer / person debited
- senderAccount = payer account (may be ETB-7112 or 1****7112)
- receiverName = receiver / credited party
- receiverAccount = receiver account
- amount = transferred amount only (exclude service charge, VAT, disaster recovery)
- transactionCode = FT reference
- date = payment date/time as shown`,

  dashen: `${BASE_RULES}

## DASHEN BANK RECEIPT ANALYSIS

You are analyzing a Dashen Bank Super App payment receipt. CRITICAL: This could be one of two types:

### RECEIPT TYPE 1: SUCCESS SCREEN ("Successfully paid!" - DARK BLUE app screen)
**Appearance:** Mobile app confirmation screen with green checkmark
**Layout:**
- Header: "Successfully paid!" (green circle with checkmark)
- "You have paid successfully. Thank you!"
- Amount display: "100.00 (ETB)" or similar
- Sender details: "Sender Name: ...", "Sender Account: ..."
- Receiver details: "Recipient Account: ...", "Recipient Name: ..."
- QR code (often overlaid at bottom)

**Extraction:**
- senderName = "Sender Name:" value
- senderAccount = "Sender Account:" value (may be masked: 5110****011)
- receiverName = "Recipient Name:" or "Recipient:" value
- receiverAccount = "Recipient Account:" or account number shown
- amount = the main amount displayed (100.00), NOT fees
- transactionCode = in QR code or visible as transaction ID

### RECEIPT TYPE 2: VAT RECEIPT (Formal bank receipt - WHITE/light background)
**Appearance:** Formal Dashen Bank receipt with official branding and logo
**Layout:**
- Header: "Dashen Bank Super App Electronic Value Added Tax Receipt"
- Bank details section (address, contact, VAT ID)
- "Transaction Details" section with a TABLE containing rows
- QR code at bottom

**CRITICAL TABLE ROWS (extract ONLY these):**
- "Transaction Amount" = THE ACTUAL TRANSFER AMOUNT (use this for amount field)
- "Service Charge" = fee (ignore)
- "Excise Tax (15%)" = tax (ignore)
- "VAT (15%)" = VAT (ignore)
- "Total" = amount + all charges (ignore for amount field, use Transaction Amount only)
- "Transaction Reference" = transactionCode (e.g., 110IPSS2616900WO)

**Extraction:**
- senderName = "Sender Name:" value
- senderAccount = "Sender Account Number:" value (usually masked)
- receiverName = "Receiver Name:" value
- receiverAccount = "Receiver Account Number:" value
- amount = "Transaction Amount" row value ONLY (NOT Total)
- transactionCode = "Transaction Reference:" value or visible in receipt

## CRITICAL RULES:

1. **Transaction Amount vs Total:** 
   - Use "Transaction Amount" for amount field (the actual transfer)
   - Ignore "Total" (which includes fees, service charges, VAT, excise tax, DRRF fee, etc.)
   - This is a common fraud check - scammers show Total as amount

2. **Transaction Code Format:**
   - Valid format: 110IPSS2616900WO, 11OBTS..., 11ETAP... (digits + IPSS/OBTS/ETAP + alphanumeric)
   - MUST have this pattern to be valid

3. **Masked Accounts:**
   - Accounts may be masked: 5110****011, 1000333687112 (this is normal and valid)
   - Extract as shown, including mask characters

4. **Screenshot Completeness:**
   - Success Screen: Should show sender/receiver names AND accounts AND amount
   - VAT Receipt: Should show transaction table with labeled rows

Return ONLY the extracted JSON with actual values. If field not visible/labeled, set to null.`,
};

export function buildExtractionPrompt(method) {
  const normalized = isSupportedMethod(method) ? method : 'telebirr';
  return `You are analyzing an Ethiopian payment receipt screenshot for ${getMethodLabel(normalized)}.

${METHOD_PROMPTS[normalized]}`;
}
