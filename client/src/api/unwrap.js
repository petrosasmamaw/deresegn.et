export function unwrap(response) {
  if (response.status >= 400) throw new Error('Request failed')
  return response.data
}
