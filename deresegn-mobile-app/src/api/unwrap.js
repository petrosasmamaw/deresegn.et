/**
 * Mirrors client/src/api/unwrap.js
 */
export function unwrap(responseLike) {
  const status = responseLike.status
  const body = responseLike.data
  if (status >= 400) {
    throw new Error(body?.message || 'Request failed')
  }
  if (body?.success === false) {
    throw new Error(body.message || 'Request failed')
  }
  if (body?.success === true && 'data' in body) {
    return body.data
  }
  return body
}
