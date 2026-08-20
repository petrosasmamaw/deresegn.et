import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseCookieHeader,
  mergeSetCookieHeaders,
  extractSetCookieList,
  cookieFromAuthBody,
} from '../src/api/cookieUtils.js'

test('parseCookieHeader parses name=value pairs', () => {
  const jar = parseCookieHeader('a=1; b=2; c=three')
  assert.deepEqual(jar, { a: '1', b: '2', c: 'three' })
})

test('mergeSetCookieHeaders adds and overrides cookies', () => {
  const merged = mergeSetCookieHeaders('a=1; b=2', ['b=99; Path=/; HttpOnly', 'c=3'])
  const jar = parseCookieHeader(merged)
  assert.equal(jar.a, '1')
  assert.equal(jar.b, '99')
  assert.equal(jar.c, '3')
})

test('mergeSetCookieHeaders removes cleared cookies', () => {
  const merged = mergeSetCookieHeaders('session=abc; keep=1', ['session=; Max-Age=0'])
  const jar = parseCookieHeader(merged)
  assert.equal(jar.session, undefined)
  assert.equal(jar.keep, '1')
})

test('extractSetCookieList handles array and fetch-style headers', () => {
  assert.deepEqual(extractSetCookieList({ 'set-cookie': ['a=1', 'b=2'] }), ['a=1', 'b=2'])

  // fetch-style Headers with getSetCookie() (what modern axios/undici expose).
  const fetchHeaders = {
    getSetCookie: () => ['x=9'],
  }
  assert.deepEqual(extractSetCookieList(fetchHeaders), ['x=9'])

  assert.deepEqual(extractSetCookieList(null), [])
})

test('cookieFromAuthBody synthesizes the session cookie from a token', () => {
  const cookie = cookieFromAuthBody({ token: 'tok123' }, '')
  const jar = parseCookieHeader(cookie)
  assert.equal(jar['better-auth.session_token'], 'tok123')
  assert.equal(jar['__Secure-better-auth.session_token'], 'tok123')
})

test('cookieFromAuthBody returns existing cookie when no token present', () => {
  assert.equal(cookieFromAuthBody({}, 'a=1'), 'a=1')
})
