import { auth } from '../../auth.mjs';
import { getUserById } from '../services/userService.js';

export async function authenticateUser(c, next) {
  try {
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      return c.json({ success: false, message: 'Unauthorized' }, 401);
    }

    const user = session.user;
    c.set('user', user);
    c.set('userId', user.id);
    c.set('userRole', user.role || 'user');
    await next();
  } catch (err) {
    console.error('[AUTH]', err);
    return c.json({ success: false, message: 'Authentication error' }, 500);
  }
}
