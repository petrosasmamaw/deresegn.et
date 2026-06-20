/**
 * Train / benchmark Dashen verification on sample receipts (success + VAT).
 * Usage: node scripts/trainDashen.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { verifyDashenReceipt } from '../src/services/dashenService.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.join(__dirname, '../training/receipt-samples');

const SAMPLES = [
  {
    file: 'dashen-success-paid.png',
    type: 'success_screen',
    expectQr: /superappreceipt_/i,
    expectAmount: '100',
  },
  {
    file: 'dashen-vat-receipt.png',
    type: 'vat_receipt',
    expectQr: /110IPSS|receipt\.dashensuperapp/i,
    expectAmount: '100',
    expectTx: '110IPSS',
  },
];

let failed = 0;

for (const sample of SAMPLES) {
  const filePath = path.join(SAMPLES_DIR, sample.file);
  const buffer = fs.readFileSync(filePath);
  const t0 = Date.now();

  const result = await verifyDashenReceipt({ buffer, mime: 'image/png' });
  const ms = Date.now() - t0;

  const qrOk = sample.expectQr.test(result.qrData?.raw || '');
  const amountOk = result.qrFields?.amount === sample.expectAmount
    || result.extracted?.amount == sample.expectAmount;
  const txOk = !sample.expectTx
    || String(result.qrFields?.transactionCode || '').includes(sample.expectTx);
  const typeOk = result.receiptType === sample.type;

  const pass = qrOk && amountOk && txOk && typeOk;
  if (!pass) failed += 1;

  console.log(
    pass ? '✓' : '✗',
    sample.file,
    `${ms}ms`,
    `type=${result.receiptType}`,
    `qr=${(result.qrData?.raw || 'none').slice(0, 36)}`,
    `amount=${result.qrFields?.amount}`,
    `tx=${(result.qrFields?.transactionCode || '').slice(0, 24)}`,
  );
}

process.exit(failed > 0 ? 1 : 0);
