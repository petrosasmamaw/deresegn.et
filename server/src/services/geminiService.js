import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildExtractionPrompt } from './receiptFormats.js';
import { normalizeTelebirrInvoiceId } from '../utils/telebirrInvoice.js';

const TELEBIRR_INVOICE_PROMPT = `This is a Telebirr mobile wallet payment receipt screenshot.
Read these fields exactly as printed (do not guess or correct them):
- Invoice No. (10 characters, e.g. DFC7TG1O11, DF52MV8ILW, DG65L5I9M5) or a transactioninfo.ethiotelecom.et/receipt/... URL
- Payer / sender name
- Payer telebirr / sender account
- Credited party / receiver name
- Credited party account
- Total Paid Amount or transfer amount (number only, no ETB)
Return ONLY valid JSON (no markdown):
{ "transactionCode": string or null, "amount": number or null, "senderName": string or null, "senderAccount": string or null, "receiverName": string or null, "receiverAccount": string or null }`;

/** gemini-2.0-flash shut down June 1 2026. Fast OCR: 3.1 Flash-Lite; fallbacks still live. */
const PRIMARY_MODEL = (process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite').trim();
const FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

const SHUT_DOWN_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
]);

function modelQueue() {
  const requested = (process.env.GEMINI_MODEL || PRIMARY_MODEL).trim();
  const primary = SHUT_DOWN_MODELS.has(requested) ? PRIMARY_MODEL : requested;
  return [...new Set([primary, ...FALLBACK_MODELS].filter((id) => id && !SHUT_DOWN_MODELS.has(id)))];
}

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 18000;
const TELEBIRR_INVOICE_TIMEOUT_MS = Number(process.env.TELEBIRR_INVOICE_TIMEOUT_MS) || 5000;
const BOA_OCR_TIMEOUT_MS = Number(process.env.BOA_OCR_TIMEOUT_MS) || 5000;

const BOA_OCR_PROMPT = `This is a Bank of Abyssinia (BOA) payment receipt screenshot.
Read these fields exactly as printed (do not guess):
- Transaction Reference / Payment ID starting with FT or TT (e.g. FT26169X4SRS, TT26171RW0YG)
- Or a slip URL like cs.bankofabyssinia.com/slip/?trx=TT26171RW0YG02723
- Payer / sender name and account
- Receiver / beneficiary name and account
- Transferred Amount only (number, no fees)
Return ONLY valid JSON (no markdown):
{ "transactionCode": string or null, "amount": number or null, "senderName": string or null, "senderAccount": string or null, "receiverName": string or null, "receiverAccount": string or null }`;

let cachedGenAI = null;
let cachedApiKey = null;
const cachedModels = new Map();
let geminiQuotaBlockedUntil = 0;

function assertValidApiKey(apiKey) {
  if (!apiKey?.trim()) {
    throw new Error('GEMINI_API_KEY is not configured in server .env');
  }
}

export function isGeminiQuotaBlocked() {
  return Date.now() < geminiQuotaBlockedUntil;
}

function markGeminiQuotaBlocked() {
  geminiQuotaBlockedUntil = Date.now() + 90_000;
}

function getGenerativeModel(apiKey, modelName) {
  if (!cachedGenAI || cachedApiKey !== apiKey) {
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    cachedApiKey = apiKey;
    cachedModels.clear();
  }
  if (!cachedModels.has(modelName)) {
    cachedModels.set(modelName, cachedGenAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 1024,
      },
    }));
  }
  return cachedModels.get(modelName);
}

async function callModel(apiKey, modelName, base64, mimeType, prompt, timeoutMs = GEMINI_TIMEOUT_MS) {
  const model = getGenerativeModel(apiKey, modelName);
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Gemini request timed out')), timeoutMs);
  });
  const result = await Promise.race([
    model.generateContent([
      { text: prompt },
      { inlineData: { mimeType, data: base64 } },
    ]),
    timeout,
  ]);
  return result.response.text().trim();
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

function isQuotaError(err) {
  const msg = String(err?.message || '');
  return msg.includes('429') || msg.includes('limit: 0');
}

function isRetryableModelError(err) {
  const msg = err?.message || '';
  if (isQuotaError(err)) return false;
  return msg.includes('404')
    || msg.includes('not found')
    || msg.includes('is not supported')
    || msg.includes('no longer available');
}

export async function extractPaymentFromScreenshot(imagePath, method = 'telebirr') {
  const buffer = await fs.readFile(imagePath);
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png'
    : imagePath.toLowerCase().endsWith('.webp') ? 'image/webp'
      : 'image/jpeg';
  return extractPaymentFromBuffer(buffer, method, mimeType);
}

export async function extractPaymentFromBuffer(buffer, method = 'telebirr', mimeType = 'image/jpeg') {
  if (isGeminiQuotaBlocked()) {
    throw new Error('Gemini quota exceeded — using QR and official Telebirr lookup');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  assertValidApiKey(apiKey);

  const base64 = buffer.toString('base64');
  const prompt = buildExtractionPrompt(method);

  let lastError = null;
  for (const modelName of modelQueue()) {
    try {
      const text = await callModel(apiKey, modelName, base64, mimeType, prompt);
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
export async function extractTelebirrOcrFromBuffer(buffer, mimeType = 'image/jpeg') {
  if (isGeminiQuotaBlocked()) return { ...EMPTY_TELEBIRR_OCR };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) return { ...EMPTY_TELEBIRR_OCR };

  const base64 = buffer.toString('base64');

  for (const modelName of modelQueue()) {
    try {
      const text = await callModel(
        apiKey,
        modelName,
        base64,
        mimeType,
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
      if (parsed.amount != null || parsed.senderName || parsed.receiverName) {
        return parsed;
      }
    } catch (err) {
      console.warn(`[Gemini] Telebirr OCR ${modelName}:`, err.message);
      if (isQuotaError(err)) {
        markGeminiQuotaBlocked();
        break;
      }
    }
  }

  return { ...EMPTY_TELEBIRR_OCR };
}

export async function extractTelebirrInvoiceFromBuffer(buffer, mimeType = 'image/jpeg') {
  const parsed = await extractTelebirrOcrFromBuffer(buffer, mimeType);
  return normalizeTelebirrInvoiceId(parsed.transactionCode) || null;
}

export async function extractBoaOcrFromBuffer(buffer, mimeType = 'image/jpeg') {
  if (isGeminiQuotaBlocked()) return { ...EMPTY_TELEBIRR_OCR };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) return { ...EMPTY_TELEBIRR_OCR };

  const base64 = buffer.toString('base64');

  for (const modelName of modelQueue()) {
    try {
      const text = await callModel(
        apiKey,
        modelName,
        base64,
        mimeType,
        BOA_OCR_PROMPT,
        BOA_OCR_TIMEOUT_MS,
      );
      const parsed = parseGeminiJson(text);
      if (parsed.transactionCode) {
        console.log('[Gemini] BOA OCR:', parsed.transactionCode, 'via', modelName);
        return parsed;
      }
      if (parsed.amount != null || parsed.senderName || parsed.receiverName) {
        return parsed;
      }
    } catch (err) {
      console.warn(`[Gemini] BOA OCR ${modelName}:`, err.message);
      if (isQuotaError(err)) {
        markGeminiQuotaBlocked();
        break;
      }
    }
  }

  return { ...EMPTY_TELEBIRR_OCR };
}
