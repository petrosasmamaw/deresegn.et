import dns from 'node:dns';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/html, application/pdf, */*',
  Connection: 'keep-alive',
};

const isProduction = process.env.NODE_ENV === 'production';

// Cloud hosts (Render) often fail on broken IPv6 routes to .et domains.
dns.setDefaultResultOrder('ipv4first');

export const BANK_FETCH_TIMEOUT_MS = Number(process.env.BANK_FETCH_TIMEOUT_MS)
  || (isProduction ? 25000 : 15000);

export const BANK_FETCH_RETRIES = Number(process.env.BANK_FETCH_RETRIES)
  || (isProduction ? 2 : 1);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * fetch() wrapper for Ethiopian bank APIs — IPv4-first, retries, browser-like headers.
 * All verify modes (screenshot, payment ID, SMS) depend on this from Render.
 */
export async function outboundFetch(url, options = {}) {
  const {
    timeoutMs = BANK_FETCH_TIMEOUT_MS,
    retries = BANK_FETCH_RETRIES,
    headers = {},
    ...rest
  } = options;

  let lastError = null;
  const host = (() => {
    try { return new URL(url).hostname; } catch { return url; }
  })();

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...rest,
        signal: controller.signal,
        headers: { ...DEFAULT_HEADERS, ...headers },
      });
      clearTimeout(timer);
      return response;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const retryable = err.name === 'AbortError'
        || /ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|network/i.test(err.message || '');
      if (attempt < retries && retryable) {
        console.warn(`[Bank fetch] retry ${attempt + 1}/${retries} ${host}:`, err.message);
        await sleep(500 * (attempt + 1));
      } else if (attempt >= retries) {
        console.warn(`[Bank fetch] failed ${host}:`, err.message);
      }
    }
  }

  throw lastError;
}
