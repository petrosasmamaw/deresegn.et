const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Workers-compatible HTTPS GET (fetch). Same return shape as the Node httpsGet.
 */
export async function httpsGet(url, {
  timeoutMs = 45000,
  headers = {},
  rejectUnauthorized = true,
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_UA,
        Connection: 'close',
        ...headers,
      },
      signal: controller.signal,
      // Cloudflare fetch does not expose rejectUnauthorized; bank TLS quirks
      // are handled via Petros proxy when direct bank TLS fails.
      cf: rejectUnauthorized === false ? undefined : undefined,
    });
    const ab = await res.arrayBuffer();
    return {
      ok: res.ok,
      status: res.status,
      body: Buffer.from(ab),
    };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`HTTPS timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function httpsGetText(url, options = {}) {
  const res = await httpsGet(url, options);
  return {
    ok: res.ok,
    status: res.status,
    text: res.body.toString('utf8'),
  };
}
