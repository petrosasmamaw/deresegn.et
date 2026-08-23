import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../../auth.mjs';
import { getUserById } from '../services/userService.js';

export async function authenticateUser(req, res, next) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
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
