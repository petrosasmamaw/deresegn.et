import fs from 'fs/promises';
import { buildExtractionPrompt } from './receiptFormats.js';
import { normalizeTelebirrInvoiceId } from '../utils/telebirrInvoice.js';
import { isWorkersRuntime } from '../config/runtime.js';
import { prepareOcrBuffer } from '../utils/prepareOcrBuffer.js';

const TELEBIRR_INVOICE_PROMPT = `This is a Telebirr mobile wallet payment screenshot.
There are TWO common layouts — read whichever is on screen:

LAYOUT A — Official invoice / receipt (often has a QR code):
- Invoice No. (exactly 10 characters, e.g. DFC7TG1O11, DF52MV8ILW, DG65L5I9M5, DHK50UYSH1)
- Or a URL like transactioninfo.ethiotelecom.et/receipt/...
- Payer / sender name and payer telebirr number
- Credited party / receiver name and account
- Total Paid Amount (number only)

LAYOUT B — In-app "Transaction Detail" (Send Money / Completed, usually NO QR):
- Transaction No. (exactly 10 characters — same as Invoice No., e.g. DHK50UYSH1)
- Transaction To = receiver name
- Transaction Amount (number only, ignore the leading minus)
- Transaction Status should be Completed
- Service Charge may also appear — do NOT use it as the amount

Rules:
- Prefer Invoice No. / Transaction No. as transactionCode — never invent or "correct" characters
- Amount: absolute paid/transfer amount as a number (e.g. 50), never the service charge
- If the credited party / "Transaction To" is an Ethiopian BANK or institution name
  (e.g. Commercial Bank of Ethiopia, Bank of Abyssinia, Dashen Bank, CBE, BOA), set receiverName to null
  — that is not a personal name (the official record has the real person)
- Return ONLY valid JSON (no markdown):
{ "transactionCode": string or null, "amount": number or null, "senderName": string or null, "senderAccount": string or null, "receiverName": string or null, "receiverAccount": string or null }`;

/**
 * Active Gemini models (August 2026):
 * - Primary: gemini-3.5-flash-lite (fastest, ~750ms OCR)
 * - Fallbacks: gemini-3.1-flash-lite, gemini-3.6-flash
 * Decommissioned / 404 models: gemini-2.5-*, gemini-2.0-*, gemini-1.5-*
 */
const PRIMARY_MODEL = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.6-flash'];

const SHUT_DOWN_MODELS = new Set([
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b',
]);

function modelQueue() {
  const requested = (process.env.GEMINI_MODEL || PRIMARY_MODEL).trim();
  const primary = SHUT_DOWN_MODELS.has(requested) ? PRIMARY_MODEL : requested;
  return [...new Set([primary, ...FALLBACK_MODELS].filter((id) => id && !SHUT_DOWN_MODELS.has(id)))];
}

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 8000;
const TELEBIRR_INVOICE_TIMEOUT_MS = Number(process.env.TELEBIRR_INVOICE_TIMEOUT_MS) || 7000;
const BOA_OCR_TIMEOUT_MS = Number(process.env.BOA_OCR_TIMEOUT_MS) || 7000;

const BOA_OCR_PROMPT = `This is a Bank of Abyssinia (BOA) payment receipt screenshot.
Read these fields exactly as printed (do not guess):
- Transaction Reference / Payment ID starting with FT or TT (e.g. FT26169X4SRS, TT26171RW0YG)
- Or a slip URL like cs.bankofabyssinia.com/slip/?trx=TT26171RW0YG02723
- Payer / sender name and account
- Receiver / beneficiary name and account
- Transferred Amount only (number, no fees)
Return ONLY valid JSON (no markdown):
{ "transactionCode": string or null, "amount": number or null, "senderName": string or null, "senderAccount": string or null, "receiverName": string or null, "receiverAccount": string or null }`;

let geminiQuotaBlockedUntil = 0;
let geminiAuthInvalid = false;

const GEMINI_KEY_HELP = 'Get a new Google AI Studio key at https://aistudio.google.com/apikey (must start with AIza).';

export function resolveGeminiApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

export function isGeminiAuthInvalid() {
  return geminiAuthInvalid;
}

export function isGeminiQuotaBlocked() {
  return Date.now() < geminiQuotaBlockedUntil || geminiAuthInvalid;
}

function markGeminiQuotaBlocked() {
  geminiQuotaBlockedUntil = Date.now() + 90_000;
}

function markGeminiAuthInvalid() {
  geminiAuthInvalid = true;
}

function assertValidApiKey(apiKey) {
  if (!apiKey?.trim()) {
    throw new Error(`GEMINI_API_KEY is not configured in server .env. ${GEMINI_KEY_HELP}`);
  }
  if (geminiAuthInvalid) {
    throw new Error(`GEMINI_API_KEY is invalid or expired. ${GEMINI_KEY_HELP}`);
  }
  if (!/^AIza[\w-]+$/.test(apiKey.trim()) && !/^AQ\./.test(apiKey.trim())) {
    console.warn(
      `[Gemini] GEMINI_API_KEY format is unusual (expected AIza… or AQ.…). ${GEMINI_KEY_HELP}`,
    );
  }
}

function isAuthError(err) {
  const msg = String(err?.message || '');
  return msg.includes('401')
    || msg.includes('UNAUTHENTICATED')
    || /invalid authentication credentials/i.test(msg);
}

function isQuotaError(err) {
  const msg = String(err?.message || '');
  return msg.includes('429') || msg.includes('limit: 0');
}

function isModelNotFoundError(err) {
  const msg = String(err?.message || '');
  return msg.includes('404') || /not found/i.test(msg);
}

function isTimeoutError(err) {
  const msg = String(err?.message || err?.name || '');
  return err?.name === 'AbortError' || /aborted|timeout|ETIMEDOUT/i.test(msg);
}

async function ocrReadyBuffer(buffer, mimeType = 'image/jpeg') {
  const ready = await prepareOcrBuffer(buffer, mimeType);
  return ready;
}

function buildGeminiHttpError(status, errorBody) {
  if (status === 401) {
    markGeminiAuthInvalid();
    return new Error(`GEMINI_API_KEY is invalid or expired (HTTP 401). ${GEMINI_KEY_HELP}`);
  }
  return new Error(`Gemini HTTP ${status}: ${errorBody.slice(0, 200)}`);
}

async function callGeminiGenerate(apiKey, modelName, parts, timeoutMs = GEMINI_TIMEOUT_MS) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw buildGeminiHttpError(response.status, errorBody);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) {
    throw new Error('Gemini returned empty response');
  }
  return text.trim();
}

async function callModel(apiKey, modelName, base64, mimeType, prompt, timeoutMs = GEMINI_TIMEOUT_MS) {
  return callGeminiGenerate(
    apiKey,
    modelName,
    [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ],
    timeoutMs,
  );
}

/** Startup / health probe — text-only, no image cost. */
export async function probeGeminiApiKey() {
  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    return { ok: false, error: `GEMINI_API_KEY is not set. ${GEMINI_KEY_HELP}` };
  }
  for (const modelName of modelQueue()) {
    try {
      await callGeminiGenerate(apiKey, modelName, [{ text: 'Reply with OK only.' }], 12000);
      return { ok: true, model: modelName };
    } catch (err) {
      if (isAuthError(err)) {
        return { ok: false, error: err.message };
      }
      if (!isModelNotFoundError(err)) {
        return { ok: false, error: err.message };
      }
    }
  }

  return { ok: false, error: 'No Gemini models responded — check API access and billing.' };
}

function parseGeminiJson(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini did not return valid JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    senderName: parsed.senderName ?? null,
    senderAccount: parsed.senderAccount ?? null,
    receiverName: parsed.receiverName ?? null,
    receiverAccount: parsed.receiverAccount ?? null,
    amount: parsed.amount != null ? Number(String(parsed.amount).replace(/,/g, '')) : null,
    date: parsed.date ?? null,
    transactionCode: parsed.transactionCode ?? null,
  };
}

function isRetryableModelError(err) {
  if (isQuotaError(err) || isAuthError(err) || isTimeoutError(err)) return false;
  return isModelNotFoundError(err);
}

export async function extractPaymentFromScreenshot(imagePath, method = 'telebirr') {
  const buffer = await fs.readFile(imagePath);
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png'
    : imagePath.toLowerCase().endsWith('.webp') ? 'image/webp'
      : 'image/jpeg';
  return extractPaymentFromBuffer(buffer, method, mimeType);
}

export async function extractPaymentFromBuffer(buffer, method = 'telebirr', mimeType = 'image/jpeg', options = {}) {
  if (geminiAuthInvalid) {
    throw new Error(`GEMINI_API_KEY is invalid or expired. ${GEMINI_KEY_HELP}`);
  }
  if (Date.now() < geminiQuotaBlockedUntil) {
    throw new Error('Gemini quota exceeded — using QR and official bank lookup');
  }

  const apiKey = resolveGeminiApiKey();
  assertValidApiKey(apiKey);

  const { buffer: ocrBuffer, mime: ocrMime } = options.skipOcrPrep
    ? { buffer, mime: mimeType }
    : await ocrReadyBuffer(buffer, mimeType);
  const base64 = Buffer.from(ocrBuffer).toString('base64');
  const prompt = buildExtractionPrompt(method);

  let lastError = null;
  for (const modelName of modelQueue()) {
    try {
      const text = await callModel(apiKey, modelName, base64, ocrMime, prompt);
      return parseGeminiJson(text);
    } catch (err) {
      lastError = err;
      if (isQuotaError(err)) {
        markGeminiQuotaBlocked();
        console.warn('[Gemini] quota exceeded — skipping remaining models');
        break;
      }
      if (!isRetryableModelError(err)) throw err;
      console.warn(`[Gemini] ${modelName} unavailable, trying next model…`);
    }
  }

  throw lastError || new Error('All Gemini models failed — check GEMINI_API_KEY and quota');
}

const EMPTY_TELEBIRR_OCR = {
  senderName: null,
  senderAccount: null,
  receiverName: null,
  receiverAccount: null,
  amount: null,
  date: null,
  transactionCode: null,
};

/** One fast Gemini call for Telebirr Invoice No. + printed names/amount. Primary model only. */
export async function extractTelebirrOcrFromBuffer(buffer, mimeType = 'image/jpeg', options = {}) {
  if (isGeminiQuotaBlocked()) return { ...EMPTY_TELEBIRR_OCR };

  const apiKey = resolveGeminiApiKey();
  if (!apiKey?.trim() || geminiAuthInvalid) return { ...EMPTY_TELEBIRR_OCR };

  const { buffer: ocrBuffer, mime: ocrMime } = options.skipOcrPrep
    ? { buffer, mime: mimeType }
    : await ocrReadyBuffer(buffer, mimeType);
  const base64 = ocrBuffer.toString('base64');

  for (const modelName of modelQueue()) {
    try {
      const text = await callModel(
        apiKey,
        modelName,
        base64,
        ocrMime,
        TELEBIRR_INVOICE_PROMPT,
        TELEBIRR_INVOICE_TIMEOUT_MS,
      );
      const parsed = parseGeminiJson(text);
      const invoice = normalizeTelebirrInvoiceId(parsed.transactionCode);
      if (invoice) {
        parsed.transactionCode = invoice;
        console.log('[Gemini] Telebirr OCR:', invoice, 'via', modelName);
        return parsed;
      }
      return parsed;
    } catch (err) {
      console.warn(`[Gemini] Telebirr OCR ${modelName}:`, err.message);
      if (isQuotaError(err)) {
        markGeminiQuotaBlocked();
        break;
      }
      if (!isRetryableModelError(err)) break;
    }
  }

  return { ...EMPTY_TELEBIRR_OCR };
}

export async function extractTelebirrInvoiceFromBuffer(buffer, mimeType = 'image/jpeg') {
  const parsed = await extractTelebirrOcrFromBuffer(buffer, mimeType);
  return normalizeTelebirrInvoiceId(parsed.transactionCode) || null;
}

export async function extractBoaOcrFromBuffer(buffer, mimeType = 'image/jpeg', options = {}) {
  if (isGeminiQuotaBlocked()) return { ...EMPTY_TELEBIRR_OCR };

  const apiKey = resolveGeminiApiKey();
  if (!apiKey?.trim() || geminiAuthInvalid) return { ...EMPTY_TELEBIRR_OCR };

  const { buffer: ocrBuffer, mime: ocrMime } = options.skipOcrPrep
    ? { buffer, mime: mimeType }
    : await ocrReadyBuffer(buffer, mimeType);
  const base64 = ocrBuffer.toString('base64');

  for (const modelName of modelQueue()) {
    try {
      const text = await callModel(
        apiKey,
        modelName,
        base64,
        ocrMime,
        BOA_OCR_PROMPT,
        BOA_OCR_TIMEOUT_MS,
      );
      const parsed = parseGeminiJson(text);
      if (parsed.transactionCode) {
        console.log('[Gemini] BOA OCR:', parsed.transactionCode, 'via', modelName);
        return parsed;
      }
      return parsed;
    } catch (err) {
      console.warn(`[Gemini] BOA OCR ${modelName}:`, err.message);
      if (isQuotaError(err)) {
        markGeminiQuotaBlocked();
        break;
      }
      if (!isRetryableModelError(err)) break;
    }
  }

  return { ...EMPTY_TELEBIRR_OCR };
}
