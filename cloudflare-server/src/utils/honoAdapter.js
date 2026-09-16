/**
 * Express-to-Hono route handler adapter for Cloudflare Workers.
 *
 * Allows existing controller functions (which expect (req, res)) to execute
 * seamlessly inside Hono without rewriting business logic, validation,
 * or response formatting.
 */
export function adapt(handler) {
  return async (c) => {
    let body = {};
    let file = null;
    const contentType = c.req.header('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        body = await c.req.json().catch(() => ({}));
      } else if (
        contentType.includes('multipart/form-data') ||
        contentType.includes('application/x-www-form-urlencoded')
      ) {
        const parsed = await c.req.parseBody({ all: true }).catch(() => ({}));
        body = { ...parsed };

        // Support 'screenshot' or generic file fields
        const candidateFile = parsed.screenshot || parsed.file;
        if (candidateFile && typeof candidateFile === 'object') {
          const fileObj = Array.isArray(candidateFile) ? candidateFile[0] : candidateFile;
          if (fileObj && typeof fileObj.arrayBuffer === 'function') {
            const buffer = Buffer.from(await fileObj.arrayBuffer());
            file = {
              buffer,
              mimetype: fileObj.type || 'image/jpeg',
              originalname: fileObj.name || 'screenshot.jpg',
              size: fileObj.size || buffer.length,
            };
          }
        }
      }
    } catch {
      body = {};
    }

    const req = {
      body,
      query: c.req.query(),
      params: c.req.param(),
      headers: Object.fromEntries(c.req.raw.headers.entries()),
      file,
      ip: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1',
      originalUrl: c.req.path,
      path: c.req.path,
      method: c.req.method,
      user: c.get('user') || null,
      userId: c.get('userId') || null,
      userRole: c.get('userRole') || null,
      apiKey: c.get('apiKey') || null,
      header: (name) => c.req.header(name),
      get: (name) => c.req.header(name),
    };

    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = null;
    let isJson = false;

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      setHeader(name, value) {
        responseHeaders[name.toLowerCase()] = String(value);
        return res;
      },
      header(name, value) {
        responseHeaders[name.toLowerCase()] = String(value);
        return res;
      },
      json(data) {
        responseBody = JSON.stringify(data);
        responseHeaders['content-type'] = 'application/json';
        isJson = true;
        return res;
      },
      send(data) {
        if (typeof data === 'object' && data !== null) {
          return res.json(data);
        }
        responseBody = String(data ?? '');
        return res;
      },
      redirect(url, code = 302) {
        statusCode = code;
        responseHeaders['location'] = url;
        responseBody = '';
        return res;
      },
      end(data) {
        if (data !== undefined) responseBody = data;
        return res;
      },
    };

    try {
      await handler(req, res);
    } catch (err) {
      console.error('[HonoAdapter Error]', err);
      return c.json(
        {
          success: false,
          message: err.message || 'Internal Server Error',
        },
        500,
      );
    }

    for (const [key, value] of Object.entries(responseHeaders)) {
      c.header(key, value);
    }

    if (isJson) {
      return c.body(responseBody, statusCode, { 'Content-Type': 'application/json' });
    }

    return c.body(responseBody, statusCode);
  };
}
