import { randomUUID } from 'crypto';

/**
 * Attach a per-request id for correlating logs. Honors an inbound
 * X-Request-Id (from a proxy/load balancer) when present, otherwise generates
 * one. Echoes it back on the response so clients/support can reference it.
 */
export function requestId(req, res, next) {
  const incoming = req.headers['x-request-id'];
  const id = (typeof incoming === 'string' && incoming.trim()) || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}

export default requestId;
