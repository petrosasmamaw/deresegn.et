const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Edge-compatible HTTPS GET utility using Web standard fetch.
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
        ...headers,
      },
      signal: controller.signal,
    });
    const arrayBuf = await res.arrayBuffer();
    return {
      ok: res.ok,
      status: res.status,
      body: Buffer.from(arrayBuf),
    };
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
