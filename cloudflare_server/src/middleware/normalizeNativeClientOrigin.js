import { getPrimaryClientOrigin } from '../config/clientOrigins.js'

function isOfficialMobile(req) {
  return (
    req.headers['x-tamagn-client'] === '1' &&
    String(req.headers['x-tamagn-platform'] || '').toLowerCase() === 'mobile'
  )
}

function isBadNativeOrigin(origin) {
  if (!origin) return true
  if (origin === 'null') return true
  if (/^exp:\/\//i.test(origin)) return true
  return false
}

/**
 * Installed Expo apps send Origin: null — Better Auth rejects that.
 * Official mobile clients are identified by X-Tamagn-* headers.
 */
export function normalizeNativeClientOrigin(req, _res, next) {
  if (!isOfficialMobile(req)) return next()
  if (!isBadNativeOrigin(req.headers.origin)) return next()

  const primary = getPrimaryClientOrigin()
  if (primary) {
    req.headers.origin = primary
    if (!req.headers.referer && !req.headers.referrer) {
      req.headers.referer = `${primary}/`
    }
  }
  next()
}
