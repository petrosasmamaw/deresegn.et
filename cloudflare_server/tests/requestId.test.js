import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestIdExpress } from '../src/middleware/requestId.js'

function mockRes() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v
    },
  }
}

test('generates a request id and echoes it on the response', () => {
  const req = { headers: {} }
  const res = mockRes()
  let called = false
  requestIdExpress(req, res, () => {
    called = true
  })
  assert.equal(called, true)
  assert.equal(typeof req.id, 'string')
  assert.ok(req.id.length > 0)
  assert.equal(res.headers['X-Request-Id'], req.id)
})

test('reuses an inbound X-Request-Id header', () => {
  const req = { headers: { 'x-request-id': 'abc-123' } }
  const res = mockRes()
  requestIdExpress(req, res, () => {})
  assert.equal(req.id, 'abc-123')
  assert.equal(res.headers['X-Request-Id'], 'abc-123')
})
