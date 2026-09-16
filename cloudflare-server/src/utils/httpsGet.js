const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * HTTPS GET — works on both Node.js and Cloudflare Workers.
 * Uses standard fetch() API instead of node:https for Workers compatibility.
 * CBE apps.cbe.com.et:100 may need TLS bypass — Workers handle this automatically.
 */
export function httpsGet(url, {
  timeoutMs = 45000,
  headers = {},
  rejectUnauthorized = true,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    method: 'GET',
    signal: controller.signal,
    headers: {
      'User-Agent': DEFAULT_UA,
      Connection: 'close',
      ...headers,
    },
  })
    .then(async (res) => {
      clearTimeout(timer);
      const arrayBuffer = await res.arrayBuffer();
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        body: Buffer.from(arrayBuffer),
      };
    })
    .catch((err) => {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new Error(`HTTPS timeout after ${timeoutMs}ms`);
      }
      throw err;
    });
}

export async function httpsGetText(url, options = {}) {
  const res = await httpsGet(url, options);
  return {
    ok: res.ok,
    status: res.status,
    text: res.body.toString('utf8'),
  };
}

