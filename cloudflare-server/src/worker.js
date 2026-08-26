// Shims for browser globals expected by PDF/canvas libraries in Edge isolates
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {};
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData {};
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D {};
}

import iconv from 'iconv-lite';
if (iconv) {
  iconv.supportsStreams = false;
}

import http from 'node:http';

// Polyfill _write on http.ServerResponse.prototype for Cloudflare Workers unenv
if (!http.ServerResponse.prototype._write) {
  http.ServerResponse.prototype._write = function (chunk, encoding, callback) {
    if (this._chunks) {
      this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    }
    if (callback) callback();
  };
}

let appInstance = null;
async function getApp() {
  if (!appInstance) {
    const mod = await import('./app.js');
    appInstance = mod.app;
  }
  return appInstance;
}

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. Populate process.env before anything else runs
      if (env && typeof env === 'object') {
        for (const [key, value] of Object.entries(env)) {
          if (typeof value === 'string') {
            process.env[key] = value;
          }
        }
      }

      const expressApp = await getApp();

      return await new Promise((resolve, reject) => {
        try {
          const url = new URL(request.url);
          const reqHeaders = {};
          for (const [k, v] of request.headers.entries()) {
            reqHeaders[k.toLowerCase()] = v;
          }

          const ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';

          // 2. Create IncomingMessage
          const req = new http.IncomingMessage({
            encrypted: true,
            readable: true,
            remoteAddress: ip,
            address: () => ({ address: '127.0.0.1', port: 8787, family: 'IPv4' }),
            destroy: () => {},
          });

          req.url = url.pathname + url.search;
          req.method = request.method;
          req.headers = reqHeaders;
          req.ip = ip;

          // 3. Create ServerResponse
          const res = new http.ServerResponse(req);
          res._chunks = [];
          res._finishedResolving = false;

          res._write = function (chunk, encoding, callback) {
            if (chunk) {
              this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
            }
            if (callback) callback();
          };

          const finishResponse = () => {
            if (res._finishedResolving) return;
            res._finishedResolving = true;

            const body = Buffer.concat(res._chunks);
            const headers = new Headers();

            const rawHeaders = res.getHeaders ? res.getHeaders() : {};
            for (const [key, val] of Object.entries(rawHeaders)) {
              if (val === undefined || val === null) continue;
              if (Array.isArray(val)) {
                for (const item of val) headers.append(key, String(item));
              } else {
                headers.set(key, String(val));
              }
            }

            resolve(
              new Response(res.statusCode === 204 || res.statusCode === 304 ? null : body, {
                status: res.statusCode || 200,
                statusText: res.statusMessage || 'OK',
                headers,
              })
            );
          };

          res.end = function (chunk, encoding, callback) {
            if (chunk) {
              this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, typeof encoding === 'string' ? encoding : undefined));
            }
            if (typeof encoding === 'function') encoding();
            if (typeof callback === 'function') callback();
            finishResponse();
            return this;
          };

          // Dispatch into Express
          expressApp(req, res);

          if (['GET', 'HEAD'].includes(request.method)) {
            req.push(null);
          } else {
            request.arrayBuffer().then((buf) => {
              if (buf.byteLength > 0) {
                req.push(Buffer.from(buf));
              }
              req.push(null);
            }).catch(reject);
          }
        } catch (err) {
          reject(err);
        }
      });
    } catch (fatalError) {
      return new Response(
        JSON.stringify({
          error: 'FATAL_WORKER_ERROR',
          message: fatalError.message,
          stack: fatalError.stack,
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
