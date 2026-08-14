import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildExtractionPrompt } from './receiptFormats.js';
import { normalizeTelebirrInvoiceId } from '../utils/telebirrInvoice.js';

const TELEBIRR_INVOICE_PROMPT = `This is a Telebirr mobile wallet payment receipt screenshot.
Find the "Invoice No." field (10 characters, e.g. DFC7TG1O11, DF52MV8ILW, or DG65L5I9M5).
Also check for receipt URLs like transactioninfo.ethiotelecom.et/receipt/...
Return ONLY valid JSON (no markdown): { "transactionCode": string or null }`;

/** Primary extractor: gemini-2.0-flash (fast OCR for Ethiopian receipts). Override with GEMINI_MODEL. */
const PRIMARY_MODEL = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

function modelQueue() {
  return [...new Set([PRIMARY_MODEL, ...FALLBACK_MODELS].filter(Boolean))];
}

const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 18000;
const TELEBIRR_INVOICE_TIMEOUT_MS = Number(process.env.TELEBIRR_INVOICE_TIMEOUT_MS) || 8000;

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
    cachedModels.set(modelName, cachedGenAI.getGenerativeModel({ model: modelName }));
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

/** Fast Telebirr invoice-only OCR — same primary model as full receipt extract. */
export async function extractTelebirrInvoiceFromBuffer(buffer, mimeType = 'image/jpeg') {
  if (isGeminiQuotaBlocked()) return null;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) return null;

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
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) continue;
      const parsed = JSON.parse(jsonMatch[0]);
      const invoice = normalizeTelebirrInvoiceId(parsed.transactionCode);
      if (invoice) {
        console.log('[Gemini] Telebirr invoice OCR:', invoice, 'via', modelName);
        return invoice;
      }
    } catch (err) {
      console.warn(`[Gemini] invoice OCR ${modelName}:`, err.message);
      if (isQuotaError(err)) {
        markGeminiQuotaBlocked();
        return null;
      }
      if (!isRetryableModelError(err) && !/timed out/i.test(err.message || '')) {
        // try next preferred model
      }
    }
  }

  return null;
}
