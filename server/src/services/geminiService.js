import fs from 'fs/promises';
import { GoogleGenerativeAI } from '@google/generative-ai';

const EXTRACTION_PROMPT = `You are analyzing a Telebirr or CBE Birr payment receipt screenshot from Ethiopia.

Extract payment details and return ONLY valid JSON (no markdown, no code fences):
{
  "senderName": string or null,
  "senderAccount": string or null,
  "receiverName": string or null,
  "receiverAccount": string or null,
  "amount": number or null,
  "date": string or null,
  "transactionCode": string or null
}

Rules:
- For Telebirr: use "Settled Amount" for amount (NOT "Total Paid Amount" which includes fees).
- For Telebirr: use "Invoice No." as transactionCode.
- For Telebirr: "Payer" = sender, "Credited Party" = receiver.
- For CBE Birr: use the transaction reference as transactionCode.
- For date: return as DD-MM-YYYY exactly as shown (e.g. "12-06-2026").
- For masked accounts like 2519****6956, return them as shown.
- Amount: numeric only, no "Birr" or commas.`;

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

async function callModel(apiKey, modelName, base64, mimeType) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const result = await model.generateContent([
    { text: EXTRACTION_PROMPT },
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

export async function extractPaymentFromScreenshot(imagePath) {
  const apiKey = process.env.GEMINI_API_KEY;
  assertValidApiKey(apiKey);

  const buffer = await fs.readFile(imagePath);
  const base64 = buffer.toString('base64');
  const mimeType = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';

  let lastError = null;
  for (const modelName of MODELS) {
    try {
      const text = await callModel(apiKey, modelName, base64, mimeType);
      return parseGeminiJson(text);
    } catch (err) {
      lastError = err;
      if (!isRetryableModelError(err)) throw err;
      console.warn(`[Gemini] ${modelName} unavailable, trying next model…`);
    }
  }

  throw lastError || new Error('All Gemini models failed — check GEMINI_API_KEY and quota');
}
