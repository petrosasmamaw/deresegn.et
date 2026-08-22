/**
 * Express-style (req, res, next) handler chain → Hono handler.
 */
export function toHono(...handlers) {
  return async (c) => {
    const req = c.get('expressReq') || (await buildExpressReq(c));
    // Refresh params from current route match
    req.params = { ...req.params, ...c.req.param() };
    c.set('expressReq', req);

    let statusCode = 200;
    const outHeaders = {};
    let bodyData;
    let ended = false;

    const res = {
      statusCode: 200,
      headersSent: false,
      status(code) {
        statusCode = Number(code) || 200;
        this.statusCode = statusCode;
        return this;
      },
      setHeader(key, value) {
        outHeaders[key] = String(value);
        return this;
      },
      json(data) {
        bodyData = data;
        outHeaders['Content-Type'] = 'application/json; charset=utf-8';
        ended = true;
        this.headersSent = true;
        return this;
      },
      send(data) {
        bodyData = data;
        ended = true;
        this.headersSent = true;
        return this;
      },
      end(data) {
        if (data !== undefined) bodyData = data;
        ended = true;
        this.headersSent = true;
        return this;
      },
    };

    try {
      await runHandlers(handlers, req, res);
    } catch (err) {
      console.error('[hono-adapter]', err);
      return c.json(
        { success: false, message: err.message || 'Internal Server Error' },
        err.status || err.statusCode || 500,
      );
    }

    if (bodyData !== undefined) {
      const response = c.json(bodyData, statusCode);
      for (const [k, v] of Object.entries(outHeaders)) {
        if (k.toLowerCase() === 'content-type') continue;
        response.headers.set(k, v);
      }
      return response;
    }
    return c.body(null, statusCode);
  };
}

function runHandlers(handlers, req, res) {
  return new Promise((resolve, reject) => {
    let i = 0;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const origJson = res.json.bind(res);
    res.json = (data) => {
      const out = origJson(data);
      finish();
      return out;
    };

    const next = (err) => {
      if (err) {
        fail(err);
        return;
      }
      if (res.headersSent) {
        finish();
        return;
      }
      if (i >= handlers.length) {
        finish();
        return;
      }
      const handler = handlers[i++];
      try {
        const result = handler(req, res, next);
        if (result && typeof result.then === 'function') {
          result.then(() => {
            if (res.headersSent) finish();
          }).catch(fail);
        }
      } catch (e) {
        fail(e);
      }
    };

    next();
  });
}

export async function buildExpressReq(c) {
  const url = new URL(c.req.url);
  const headerObj = {};
  c.req.raw.headers.forEach((value, key) => {
    headerObj[key.toLowerCase()] = value;
  });

  let body = c.get('parsedBody');
  if (body === undefined) {
    const contentType = headerObj['content-type'] || '';
    if (contentType.includes('application/json')) {
      try {
        body = await c.req.json();
      } catch {
        body = {};
      }
    } else if (contentType.includes('multipart/form-data')) {
      body = {};
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        body = await c.req.parseBody();
      } catch {
        body = {};
      }
    } else {
      body = {};
    }
    c.set('parsedBody', body);
  }

  return {
    method: c.req.method,
    url: url.pathname + url.search,
    originalUrl: url.pathname + url.search,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    params: c.req.param(),
    headers: headerObj,
    body,
    file: c.get('uploadedFile') || null,
    files: c.get('uploadedFiles') || null,
    user: undefined,
    userId: undefined,
    userRole: undefined,
    apiKey: undefined,
    get(name) {
      return headerObj[String(name).toLowerCase()];
    },
  };
}

export function multipartFile(fieldName = 'screenshot') {
  return async (c, next) => {
    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      await next();
      return;
    }
    const body = await c.req.parseBody({ all: true });
    const file = body[fieldName];
    const fields = {};
    for (const [key, value] of Object.entries(body)) {
      if (key === fieldName) continue;
      fields[key] = value;
    }
    c.set('parsedBody', fields);

    if (file && typeof file === 'object' && typeof file.arrayBuffer === 'function') {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = file.type || 'image/jpeg';
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowed.includes(mime)) {
        return c.json({ success: false, message: 'Only JPG, PNG, or WEBP screenshots are allowed' }, 400);
      }
      if (buf.length > 10 * 1024 * 1024) {
        return c.json({ success: false, message: 'File too large (max 10MB)' }, 400);
      }
      c.set('uploadedFile', {
        buffer: buf,
        mimetype: mime,
        originalname: file.name || 'screenshot.jpg',
        size: buf.length,
        path: null,
      });
    }
    await next();
  };
}
