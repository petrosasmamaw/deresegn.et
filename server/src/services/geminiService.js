import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildExtractionPrompt } from './receiptFormats.js';

const MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
];

function assertValidApiKey(apiKey) {
  if (!apiKey?.trim()) {
    throw new Error('GEMINI_API_KEY is not configured in server .env');
  }
}

async function callModel(apiKey, modelName, base64, mimeType, prompt) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType, data: base64 } },
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

function isRetryableModelError(err) {
  const msg = err?.message || '';
  return msg.includes('429')
    || msg.includes('404')
    || msg.includes('not found')
    || msg.includes('is not supported');
}

export async function extractPaymentFromScreenshot(imagePath, method = 'telebirr') {
  const buffer = await fs.readFile(imagePath);
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png'
    : imagePath.toLowerCase().endsWith('.webp') ? 'image/webp'
      : 'image/jpeg';
  return extractPaymentFromBuffer(buffer, method, mimeType);
}

export async function extractPaymentFromBuffer(buffer, method = 'telebirr', mimeType = 'image/jpeg') {
  const apiKey = process.env.GEMINI_API_KEY;
  assertValidApiKey(apiKey);

  const base64 = buffer.toString('base64');
  const prompt = buildExtractionPrompt(method);

  let lastError = null;
  for (const modelName of MODELS) {
    try {
      const text = await callModel(apiKey, modelName, base64, mimeType, prompt);
      return parseGeminiJson(text);
    } catch (err) {
      lastError = err;
      if (!isRetryableModelError(err)) throw err;
      console.warn(`[Gemini] ${modelName} unavailable, trying next model…`);
    }
  }

  throw lastError || new Error('All Gemini models failed — check GEMINI_API_KEY and quota');
}
