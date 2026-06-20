/**
 * Unit test: BOA edited receipt detection with mocked official API.
 * Run: node scripts/testBoaFraudMock.mjs
 */
import assert from 'assert';
import { validateReceiptSubmission } from '../src/services/receiptValidationService.js';
import { extractBoaFieldsFromQrPayload } from '../src/services/boaQrCrypto.js';

const QR_RAW = '1Ylb4eo4D004fY3MFqHq+qrHP1mgvNHX4gmnAKD6j2/an8szxkRR46HySTZcCVp232YybAfkM7FzUb8I17V467mP5h4t4MxApUDvfLUeNOpt7zb7eqLNC4c5u2HYxl9je7mMRIhE9hNAIi136UeKnA==';

function buildQrFields() {
  const qrData = { raw: QR_RAW };
  const decrypted = extractBoaFieldsFromQrPayload(QR_RAW);
  return {
    qrData,
    qrFields: decrypted ? { ...decrypted, boaQrDecrypted: true } : {},
  };
}

function runCase(label, extracted, boaResolve) {
  const { qrData, qrFields } = buildQrFields();
  const result = validateReceiptSubmission({
    method: 'boa',
    form: {},
    extracted,
    qrData,
    qrFields,
    geminiUsed: true,
    withDetails: false,
    boaResolve,
  });
  console.log(label, 'passed:', result.passed, 'errors:', result.errors);
  return result;
}

const original = runCase('original', {
  senderName: 'BIRUK YEMATAWORK TADESSE',
  senderAccount: '1****493',
  receiverName: 'PETIROS ASMAMAW ABEBE',
  receiverAccount: '1****112',
  amount: 10.07,
  transactionCode: 'FT26169X4SRS',
}, { official: null, screenshotEdited: false, matchedReference: null });

const edited = runCase('edited', {
  senderName: 'BIRUK YEMATAWORK TADESSE',
  senderAccount: '1****493',
  receiverName: 'PETIROS ASMAMAW ABEBE',
  receiverAccount: '1****112',
  amount: 110.07,
  transactionCode: 'FT26169X4SRF',
}, { official: null, screenshotEdited: false, matchedReference: null });

assert.strictEqual(original.passed, true, 'original should pass');
assert.strictEqual(edited.passed, false, 'edited should fail');
console.log('✓ BOA fraud mock tests passed');
