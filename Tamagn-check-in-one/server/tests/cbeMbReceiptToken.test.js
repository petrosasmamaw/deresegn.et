import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractCbeMbReceiptToken } from '../src/services/qrService.js';

describe('extractCbeMbReceiptToken', () => {
  it('reads v2 tokens from public mbreciept URLs', () => {
    assert.equal(
      extractCbeMbReceiptToken('https://mbreciept.cbe.com.et/v2-hfHCxzlpFE2Sp5md8y6C'),
      'v2-hfHCxzlpFE2Sp5md8y6C',
    );
  });

  it('reads a bare v2 token', () => {
    assert.equal(
      extractCbeMbReceiptToken('v2-hfHCxzlpFE2Sp5md8y6C'),
      'v2-hfHCxzlpFE2Sp5md8y6C',
    );
  });

  it('reads /receipt/ path tokens', () => {
    assert.equal(
      extractCbeMbReceiptToken('https://mbreciept.cbe.com.et/receipt/v2-hfHCxzlpFE2Sp5md8y6C'),
      'v2-hfHCxzlpFE2Sp5md8y6C',
    );
  });
});
