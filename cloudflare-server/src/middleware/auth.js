import { auth } from '../../auth.mjs';
import { db } from '../config/drizzle.js';
import * as schema from '../db/schema.js';
import { eq } from 'drizzle-orm';

export async function authenticateUser(c, next) {
  try {
    let session = null;

    // 1. Try Better Auth's native getSession
    try {
      session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
    } catch (authErr) {
      console.warn('[AUTH] getSession native check failed:', authErr.message);
    }

    // 2. Fallback: extract token if Better Auth native getSession did not resolve (e.g. cookie blocked or Bearer)
    if (!session?.user) {
      const authHeader = c.req.header('authorization') || c.req.header('Authorization');
      let token = null;

      if (authHeader && /^Bearer\s+/i.test(authHeader)) {
        token = authHeader.replace(/^Bearer\s+/i, '').trim();
      } else {
        token = c.req.header('x-session-token');
        if (!token) {
          const cookieHeader = c.req.header('cookie') || '';
          const match = cookieHeader.match(/(?:better-auth\.session_token|__Secure-better-auth\.session_token)=([^;]+)/);
          if (match) {
            token = decodeURIComponent(match[1].trim());
          }
        }
      }

      if (token) {
        try {
          const sessions = await db
            .select()
            .from(schema.session)
            .where(eq(schema.session.token, token))
            .limit(1);

          if (sessions.length > 0) {
            const dbSession = sessions[0];
            const expiresAt = new Date(dbSession.expiresAt).getTime();
            if (expiresAt > Date.now()) {
              const users = await db
                .select()
                .from(schema.user)
                .where(eq(schema.user.id, dbSession.userId))
                .limit(1);

              if (users.length > 0) {
                session = {
                  session: dbSession,
                  user: users[0],
                };
              }
            }
          }
        } catch (dbErr) {
          console.warn('[AUTH] DB session fallback error:', dbErr.message);
        }
      }
    }

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
