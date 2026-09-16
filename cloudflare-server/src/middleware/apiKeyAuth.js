import { findApiKeyByRaw, ensureApiKeysTable } from '../services/apiKeyService.js';

function extractApiKey(c) {
  const headerKey = c.req.header('x-api-key');
  if (headerKey) return String(headerKey).trim();

  const auth = c.req.header('authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

/** Auth for external `/api/v1/*` — URL + API key (no cookies). */
export async function authenticateApiKey(c, next) {
  try {
    const raw = extractApiKey(c);
    if (!raw) {
      return c.json({
        success: false,
        message: 'Missing API key. Send X-API-Key or Authorization: Bearer dk_live_…',
        code: 'API_KEY_MISSING',
      }, 401);
    }

    await ensureApiKeysTable();

    const row = await findApiKeyByRaw(raw);
    if (!row) {
      return c.json({
        success: false,
        message: 'Invalid API key.',
        code: 'API_KEY_INVALID',
      }, 401);
    }
    if (row.status === 'revoked') {
      return c.json({
        success: false,
        message: 'API key revoked.',
        code: 'API_KEY_REVOKED',
      }, 403);
    }
    if (row.status === 'expired') {
      return c.json({
        success: false,
        message: 'API key expired. Renew a package after topping up your balance.',
        code: 'API_KEY_EXPIRED',
      }, 403);
    }

    c.set('apiKey', row);
    c.set('userId', row.userId);
    await next();
  } catch (err) {
    console.error('[API KEY AUTH]', err);
    return c.json({ success: false, message: 'API key authentication failed' }, 500);
  }
}
