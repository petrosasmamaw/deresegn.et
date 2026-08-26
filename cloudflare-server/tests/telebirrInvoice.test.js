import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTelebirrInvoiceFromText,
  normalizeTelebirrInvoiceId,
} from '../src/utils/telebirrInvoice.js';

describe('telebirrInvoice — Transaction Detail + Invoice layouts', () => {
  it('reads Transaction No. from Transaction Detail screenshots', () => {
    const text = `
      Transaction Detail
      Transaction Time 2026/20/08 17:40:01
      Transaction No. DHK50UYSH1
      Transaction Type Send Money
      Transaction To natnael
      Transaction Amount -50.00 ETB
      Transaction Status Completed
    `;
    assert.equal(extractTelebirrInvoiceFromText(text), 'DHK50UYSH1');
  });

  it('reads classic Invoice No.', () => {
    assert.equal(
      extractTelebirrInvoiceFromText('Invoice No. DG65L5I9M5 Total Paid Amount 120.00'),
      'DG65L5I9M5',
    );
  });

  it('reads receipt URL invoice', () => {
    assert.equal(
      extractTelebirrInvoiceFromText(
        'https://transactioninfo.ethiotelecom.et/receipt/DFC7TG1O11',
      ),
      'DFC7TG1O11',
    );
  });

  it('normalizes 10-char Telebirr codes', () => {
    assert.equal(normalizeTelebirrInvoiceId('dhk50uysh1'), 'DHK50UYSH1');
    assert.equal(normalizeTelebirrInvoiceId('BAD'), null);
  });
});
