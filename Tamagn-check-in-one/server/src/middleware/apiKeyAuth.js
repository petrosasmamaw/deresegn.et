import { findApiKeyByRaw, ensureApiKeysTable } from '../services/apiKeyService.js';

function extractApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  if (headerKey) return String(headerKey).trim();

  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

/** Auth for external `/api/v1/*` — URL + API key (no cookies). */
export async function authenticateApiKey(req, res, next) {
  try {
    await ensureApiKeysTable();
    const raw = extractApiKey(req);
    if (!raw) {
      return res.status(401).json({
        success: false,
        message: 'Missing API key. Send X-API-Key or Authorization: Bearer dk_live_…',
        code: 'API_KEY_MISSING',
      });
    }

    const row = await findApiKeyByRaw(raw);
    if (!row) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.',
        code: 'API_KEY_INVALID',
      });
    }
    if (row.status === 'revoked') {
      return res.status(403).json({
        success: false,
        message: 'API key revoked.',
        code: 'API_KEY_REVOKED',
      });
    }
    if (row.status === 'expired') {
      return res.status(403).json({
        success: false,
        message: 'API key expired. Renew a package after topping up your balance.',
        code: 'API_KEY_EXPIRED',
      });
    }

    req.apiKey = row;
    req.userId = row.userId;
    next();
  } catch (err) {
    console.error('[API KEY AUTH]', err);
    return res.status(500).json({ success: false, message: 'API key authentication failed' });
  }
}
