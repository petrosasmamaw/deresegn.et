import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractCbeMbReceiptToken } from '../src/services/qrService.js';
import {
  fetchCbeTransactionFromQr,
  verifyCbeReceipt,
} from '../src/services/cbeReceiptService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sample = path.join(__dirname, '../training/receipt-samples/cbe-success-card.png');

async function main() {
  const tokenUrl = 'https://mbreciept.cbe.com.et/v2-hfHCxzlpFE2Sp5md8y6C';
  const token = extractCbeMbReceiptToken(tokenUrl);
  console.log('token extract:', token);

  const t0 = Date.now();
  const fromToken = await fetchCbeTransactionFromQr({ verificationToken: token, verificationUrl: tokenUrl });
  console.log('token lookup ms:', Date.now() - t0, 'result:', fromToken ? {
    tx: fromToken.transactionCode,
    amount: fromToken.amount,
    source: fromToken.source,
  } : null);

  const buffer = await fs.readFile(sample);
  const t1 = Date.now();
  const result = await verifyCbeReceipt({ buffer, mime: 'image/png' });
  console.log('screenshot verify ms:', Date.now() - t1);
  console.log('screenshot result:', {
    geminiUsed: result.geminiUsed,
    geminiError: result.geminiError,
    qrToken: result.qrData?.verificationToken || extractCbeMbReceiptToken(result.qrData?.raw),
    official: result.cbeOfficial ? {
      tx: result.cbeOfficial.transactionCode,
      amount: result.cbeOfficial.amount,
      source: result.cbeOfficial.source,
    } : null,
    extractedTx: result.extracted?.transactionCode,
  });
}

main().catch((err) => {
  console.error('FAIL', err);
  process.exit(1);
});
