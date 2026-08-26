import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEthiopianBankName,
  personNamesConflict,
  ETHIOPIAN_BANK_ALIAS_COUNT,
} from '../src/utils/ethiopianBanks.js';

function namesMatch(a, b) {
  return String(a).toLowerCase().trim() === String(b).toLowerCase().trim();
}

describe('ethiopianBanks', () => {
  it('loads at least 15 bank aliases', () => {
    assert.ok(ETHIOPIAN_BANK_ALIAS_COUNT >= 30, `got ${ETHIOPIAN_BANK_ALIAS_COUNT}`);
  });

  it('detects Commercial Bank of Ethiopia / CBE', () => {
    assert.equal(isEthiopianBankName('Commercial Bank of Ethiopia'), true);
    assert.equal(isEthiopianBankName('CBE'), true);
    assert.equal(isEthiopianBankName('commercial bank'), true);
  });

  it('detects Bank of Abyssinia, Dashen, Awash, and others', () => {
    assert.equal(isEthiopianBankName('Bank of Abyssinia'), true);
    assert.equal(isEthiopianBankName('BOA'), true);
    assert.equal(isEthiopianBankName('Dashen Bank'), true);
    assert.equal(isEthiopianBankName('Awash Bank'), true);
    assert.equal(isEthiopianBankName('Cooperative Bank of Oromia'), true);
    assert.equal(isEthiopianBankName('Hibret Bank'), true);
    assert.equal(isEthiopianBankName('Wegagen Bank'), true);
    assert.equal(isEthiopianBankName('Zemen Bank'), true);
    assert.equal(isEthiopianBankName('Telebirr'), true);
  });

  it('does not treat personal names as banks', () => {
    assert.equal(isEthiopianBankName('Miss Lidiya Asmamaw Asfaw'), false);
    assert.equal(isEthiopianBankName('seifeslasie asmamaw abebe'), false);
    assert.equal(isEthiopianBankName('natnael'), false);
  });

  it('skips fraud name conflict when screenshot shows a bank', () => {
    assert.equal(
      personNamesConflict(
        'Commercial Bank of Ethiopia',
        'Miss Lidiya Asmamaw Asfaw',
        namesMatch,
      ),
      false,
    );
  });

  it('still flags real person-name edits', () => {
    assert.equal(
      personNamesConflict('Abebe Kebede', 'Miss Lidiya Asmamaw Asfaw', namesMatch),
      true,
    );
  });
});
