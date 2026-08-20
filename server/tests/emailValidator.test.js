import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDisposableEmail,
  isRealEmailDomain,
  extractEmailDomain,
  validateEmailForRegistration,
} from '../src/utils/emailValidator.js';

describe('emailValidator', () => {
  test('extractEmailDomain extracts normalized lowercase domains', () => {
    assert.equal(extractEmailDomain('Test.User@Gmail.Com'), 'gmail.com');
    assert.equal(extractEmailDomain('user@SUB.Example.org'), 'sub.example.org');
    assert.equal(extractEmailDomain('invalid-email'), null);
    assert.equal(extractEmailDomain(''), null);
    assert.equal(extractEmailDomain(null), null);
  });

  test('isDisposableEmail detects known temporary email domains', () => {
    assert.equal(isDisposableEmail('test@mailinator.com'), true);
    assert.equal(isDisposableEmail('test@guerrillamail.com'), true);
    assert.equal(isDisposableEmail('test@10minutemail.com'), true);
    assert.equal(isDisposableEmail('test@tempmail.com'), true);
    assert.equal(isDisposableEmail('test@trashmail.com'), true);
    assert.equal(isDisposableEmail('user@gmail.com'), false);
    assert.equal(isDisposableEmail('user@outlook.com'), false);
  });

  test('isRealEmailDomain fast-paths known legitimate providers', async () => {
    const start = Date.now();
    const isGmail = await isRealEmailDomain('user@gmail.com');
    const isYahoo = await isRealEmailDomain('user@yahoo.com');
    const isOutlook = await isRealEmailDomain('user@outlook.com');
    const duration = Date.now() - start;

    assert.equal(isGmail, true);
    assert.equal(isYahoo, true);
    assert.equal(isOutlook, true);
    assert.ok(duration < 50, `Fast-path should be instantaneous, took ${duration}ms`);
  });

  test('isRealEmailDomain rejects non-existent domains with no MX', async () => {
    const isFake = await isRealEmailDomain('fake@thisisabsolutelyfake987654321xyz.com');
    assert.equal(isFake, false);
  });

  test('validateEmailForRegistration returns user-friendly validation messages', async () => {
    const valid = await validateEmailForRegistration('valid.user@gmail.com');
    assert.equal(valid.valid, true);

    const disposable = await validateEmailForRegistration('spammer@mailinator.com');
    assert.equal(disposable.valid, false);
    assert.match(disposable.message, /disposable or temporary/i);

    const fake = await validateEmailForRegistration('user@thisisabsolutelyfake987654321xyz.com');
    assert.equal(fake.valid, false);
    assert.match(fake.message, /does not appear to exist/i);

    const empty = await validateEmailForRegistration('');
    assert.equal(empty.valid, false);
  });
});
