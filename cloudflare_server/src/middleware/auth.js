import { auth } from '../../auth.mjs';
import { getUserById } from '../services/userService.js';

function headersFromExpressReq(req) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }
  return headers;
}

export async function authenticateUser(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: headersFromExpressReq(req),
    });

    if (!session?.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const profile = await getUserById(session.user.id);
    req.user = profile || session.user;
    req.userId = session.user.id;
    req.userRole = req.user.role;
    next();
  } catch (err) {
    console.error('[AUTH]', err);
    res.status(500).json({ success: false, message: 'Authentication error' });
  }
}
