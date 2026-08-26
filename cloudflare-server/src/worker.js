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
    appInstance = mod.app || mod.default;
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
      if (typeof expressApp !== 'function') {
        throw new Error('Express app failed to load');
      }

      // Read incoming body buffer before initializing IncomingMessage
      let bodyBuffer = null;
      if (!['GET', 'HEAD'].includes(request.method)) {
        const ab = await request.arrayBuffer();
        if (ab.byteLength > 0) {
          bodyBuffer = Buffer.from(ab);
        }
      }

      return await new Promise((resolve) => {
        try {
          const url = new URL(request.url);
          const reqHeaders = {};
          for (const [k, v] of request.headers.entries()) {
            reqHeaders[k.toLowerCase()] = v;
          }

          const ip = request.headers.get('cf-connecting-ip') || '127.0.0.1';

          const socket = {
            encrypted: true,
            readable: true,
            remoteAddress: ip,
            address: () => ({ address: '127.0.0.1', port: 8787, family: 'IPv4' }),
            destroy: () => {},
            on: () => {},
            once: () => {},
            emit: () => {},
          };

          // 2. Create IncomingMessage
          const req = new http.IncomingMessage(socket);
          req.url = url.pathname + url.search;
          req.method = request.method;
          req.headers = reqHeaders;
          req.ip = ip;
          req.socket = socket;
          req.connection = socket;

          if (bodyBuffer) {
            req.push(bodyBuffer);
          }
          req.push(null);
          req.readable = true;

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

            const responseHeaders = res.getHeaders ? res.getHeaders() : {};
            for (const [key, val] of Object.entries(responseHeaders)) {
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

          res.on = function (event, listener) {
            if (event === 'finish' || event === 'close') {
              // noop or hook
            }
            return this;
          };

          // Dispatch into Express with error callback
          expressApp(req, res, (err) => {
            if (err) {
              console.error('[EXPRESS_ERROR]', err);
              if (!res._finishedResolving) {
                res.statusCode = err.status || 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: false,
                  message: err.message || 'Internal Server Error',
                }));
              }
            }
          });
        } catch (innerErr) {
          console.error('[WORKER_INNER_ERROR]', innerErr);
          resolve(
            new Response(
              JSON.stringify({
                success: false,
                message: innerErr.message,
                stack: innerErr.stack,
              }),
              {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          );
        }
      });
    } catch (fatalError) {
      console.error('[WORKER_FATAL_ERROR]', fatalError);
      return new Response(
        JSON.stringify({
          success: false,
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
