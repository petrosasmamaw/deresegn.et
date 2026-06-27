import https from 'node:https';
import { URL } from 'node:url';

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Native Node HTTPS GET — forces IPv4, no keep-alive.
 * Telebirr (ethiotelecom.et) often hangs with global fetch() from US cloud hosts (Render).
 */
export function httpsGet(url, { timeoutMs = 45000, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: 'GET',
        family: 4,
        headers: {
          'User-Agent': DEFAULT_UA,
          Connection: 'close',
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`HTTPS timeout after ${timeoutMs}ms`));
    });
    req.on('error', reject);
    req.end();
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
