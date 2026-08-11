/**
 * Map Axios / network failures to user-facing copy.
 */
export function friendlyErrorMessage(err, t, fallback = 'Request failed') {
  if (!err) return t?.('common.networkError') || fallback

  const code = err.code || err?.cause?.code
  const msg = String(err.message || '').toLowerCase()
  const noResponse = !err.response && (code === 'ERR_NETWORK' || msg.includes('network'))

  if (
    noResponse ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    msg.includes('timeout') ||
    msg.includes('network request failed')
  ) {
    return t?.('common.networkError') || 'Network error. Check your connection and try again.'
  }

  if (typeof err === 'string') return err
  return (
    err.response?.data?.message ||
    err.message ||
    (typeof fallback === 'string' ? fallback : t?.('common.tryAgain') || 'Request failed')
  )
}
