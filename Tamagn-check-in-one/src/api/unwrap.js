export function unwrap(response) {
  if (response.status >= 400) throw new Error('Request failed')
  const body = response.data
  if (body?.success === false) {
    throw new Error(body.message || 'Request failed')
  }
  if (body?.success === true && 'data' in body) {
    return body.data
  }
  return body
}
