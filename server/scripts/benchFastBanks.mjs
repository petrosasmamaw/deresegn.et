/**
 * Benchmark Telebirr / BOA / Dashen (CBE left alone per request).
 * Usage: node scripts/benchFastBanks.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { verifyTelebirrReceipt } from '../src/services/telebirrVerifyService.js';
import { verifyBoaReceipt } from '../src/services/boaReceiptService.js';
import { verifyDashenReceipt } from '../src/services/dashenService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(__dirname, '../training/receipt-samples');

const SAMPLES = [
  { file: 'boa-receipt.png', fn: verifyBoaReceipt, label: 'BOA' },
  { file: 'dashen-success-paid.png', fn: verifyDashenReceipt, label: 'Dashen-success' },
  { file: 'dashen-vat-receipt.png', fn: verifyDashenReceipt, label: 'Dashen-VAT' },
];

// Optional telebirr sample if present
for (const name of ['telebirr-receipt.png', 'telebirr.png', 'telebirr-invoice.png']) {
  if (fs.existsSync(path.join(SAMPLES_DIR, name))) {
    SAMPLES.unshift({ file: name, fn: verifyTelebirrReceipt, label: 'Telebirr' });
    break;
  }
}

let failed = 0;

for (const sample of SAMPLES) {
  const filePath = path.join(SAMPLES_DIR, sample.file);
  if (!fs.existsSync(filePath)) {
    console.log('–', sample.label, sample.file, '(missing)');
    continue;
  }
  const buffer = fs.readFileSync(filePath);
  const t0 = Date.now();
  const result = await sample.fn({ buffer, mime: 'image/png' });
  const ms = Date.now() - t0;
  const tx = result.qrFields?.transactionCode || result.extracted?.transactionCode || 'none';
  const amount = result.qrFields?.amount ?? result.extracted?.amount ?? 'none';
  const qr = result.qrData?.raw ? 'yes' : 'no';
  const official = result.qrFields?.boaApiSource
    || result.qrFields?.boaQrDecrypted
    || result.qrFields?.telebirrApiSource
    || result.qrFields?.dashenApiSource
    || result.qrFields?.dashenSuperAppSource
    || result.telebirrResolve?.official
    || result.boaResolve?.official;
  const pass = Boolean(official || result.qrData?.raw || result.telebirrResolve?.matchedInvoice);
  if (!pass) failed += 1;
  console.log(
    pass ? '✓' : '✗',
    sample.label,
    `${ms}ms`,
    `qr=${qr}`,
    `official=${official ? 'yes' : 'no'}`,
    `tx=${String(tx).slice(0, 28)}`,
    `amount=${amount}`,
  );
}

process.exit(failed > 0 ? 1 : 0);
