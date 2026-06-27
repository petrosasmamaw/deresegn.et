const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/html, application/pdf, */*',
};

/**
 * fetch() wrapper for bank receipt APIs — timeouts, browser-like headers, optional retry.
 * Render/cloud egress can be slower or pickier than local dev.
 */
export async function outboundFetch(url, options = {}) {
  const {
    timeoutMs = 15000,
    retries = 1,
    headers = {},
    ...rest
  } = options;

  let lastError = null;

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
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
