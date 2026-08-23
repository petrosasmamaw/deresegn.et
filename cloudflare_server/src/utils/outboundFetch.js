import { isWorkersRuntime } from '../config/runtime.js';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/html, application/pdf, */*',
  Connection: 'keep-alive',
};

const isProduction = process.env.NODE_ENV === 'production';

export const BANK_FETCH_TIMEOUT_MS = Number(process.env.BANK_FETCH_TIMEOUT_MS)
  || (isWorkersRuntime() ? 12000 : (isProduction ? 25000 : 15000));

export const BANK_FETCH_RETRIES = Number(process.env.BANK_FETCH_RETRIES)
  || (isWorkersRuntime() ? 1 : (isProduction ? 2 : 1));

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
    logHost = null,
    ...rest
  } = options;

  let lastError = null;
  const host = logHost || (() => {
    try { return new URL(url).hostname; } catch { return 'outbound'; }
  })();

  const safeErrMessage = (err) => {
    let msg = String(err?.message || err || 'request failed');
    try {
      const realHost = new URL(url).hostname;
      if (realHost) msg = msg.split(realHost).join(host);
    } catch {
      // ignore
    }
    // Redact known third-party host fragments without hardcoding brand text in logs.
    const needles = [
      Buffer.from('bGV1bHplbmViZS5wcm8=', 'base64').toString('utf8'),
      Buffer.from('dmVyaWZ5LmxldWwuZXQ=', 'base64').toString('utf8'),
      Buffer.from('bGV1bA==', 'base64').toString('utf8'),
    ];
    for (const needle of needles) {
      msg = msg.replace(new RegExp(needle.replace(/\./g, '\\.'), 'gi'), host === 'outbound' ? 'petros' : host);
    }
    return msg;
  };

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
        console.warn(`[Bank fetch] retry ${attempt + 1}/${retries} ${host}:`, safeErrMessage(err));
        await sleep(500 * (attempt + 1));
      } else if (attempt >= retries) {
        console.warn(`[Bank fetch] failed ${host}:`, safeErrMessage(err));
      }
    }
  }

  throw lastError;
}
