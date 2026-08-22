/**
 * Express-compatible (req,res,next) + Hono factory.
 */
function makeId(inbound) {
  return (
    inbound ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`)
  );
}

/** Express-style middleware (used by unit tests / adapters). */
export function requestIdExpress(req, res, next) {
  const id = makeId(req.headers?.['x-request-id']);
  req.id = id;
  if (typeof res.setHeader === 'function') {
    res.setHeader('X-Request-Id', id);
  }
  next();
}

/** Hono middleware factory. */
export function requestId() {
  return async (c, next) => {
    const id = makeId(c.req.header('x-request-id'));
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  };
}

// Default export name used historically
export { requestIdExpress as requestIdMiddleware };
