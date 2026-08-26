import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTrustedOrigin, getTrustedOrigins } from '../src/config/clientOrigins.js'

test('trusts the production website origin', () => {
  assert.equal(isTrustedOrigin('https://tamagncheck.online'), true)
})

test('rejects an unknown origin', () => {
  assert.equal(isTrustedOrigin('https://evil.example.com'), false)
})

test('allows empty origin (non-browser tools / same-origin)', () => {
  assert.equal(isTrustedOrigin(''), true)
  assert.equal(isTrustedOrigin(null), true)
})

test('normalizes origins (ignores trailing path/slash)', () => {
  assert.equal(isTrustedOrigin('https://tamagncheck.online/'), true)
})

test('getTrustedOrigins returns a de-duplicated list', () => {
  const origins = getTrustedOrigins()
  assert.equal(Array.isArray(origins), true)
  assert.equal(origins.length, new Set(origins).size)
})
