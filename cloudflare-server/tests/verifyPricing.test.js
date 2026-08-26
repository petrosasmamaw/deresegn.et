import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCheckCostByAmount, VERIFY_FEE_TIERS } from '../src/services/verifyPricing.js';

describe('getCheckCostByAmount', () => {
  it('charges 2 Birr for amounts under 100', () => {
    assert.equal(getCheckCostByAmount(0), 2);
    assert.equal(getCheckCostByAmount(50), 2);
    assert.equal(getCheckCostByAmount(99.99), 2);
  });

  it('charges 5 Birr for 100–999 ETB', () => {
    assert.equal(getCheckCostByAmount(100), 5);
    assert.equal(getCheckCostByAmount(500), 5);
    assert.equal(getCheckCostByAmount(999), 5);
  });

  it('charges 10 Birr for 1,000–4,999 ETB', () => {
    assert.equal(getCheckCostByAmount(1000), 10);
    assert.equal(getCheckCostByAmount(2500), 10);
  });

  it('charges 15 Birr for 5,000–9,999 ETB', () => {
    assert.equal(getCheckCostByAmount(5000), 15);
    assert.equal(getCheckCostByAmount(9000), 15);
  });

  it('charges 20 Birr for 10,000+ ETB', () => {
    assert.equal(getCheckCostByAmount(10000), 20);
    assert.equal(getCheckCostByAmount(50000), 20);
  });

  it('handles invalid amounts as tier-1 (under 100)', () => {
    assert.equal(getCheckCostByAmount(null), 2);
    assert.equal(getCheckCostByAmount(''), 2);
    assert.equal(getCheckCostByAmount('not-a-number'), 2);
  });

  it('VERIFY_FEE_TIERS covers all positive ranges without gaps', () => {
    assert.equal(VERIFY_FEE_TIERS.length, 5);
    assert.equal(VERIFY_FEE_TIERS.at(-1).maxExclusive, null);
  });
});
