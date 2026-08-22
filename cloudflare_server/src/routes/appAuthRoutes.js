import { toHono } from '../adapters/expressToHono.js';
import { authenticateUser } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import { getUserById } from '../services/userService.js';
import { ensureUserBalance } from '../services/checkService.js';
import { ensureRegistrationBonus } from '../services/balanceLedgerService.js';

async function getProfile(req, res) {
  await ensureRegistrationBonus(req.userId);
  const user = await getUserById(req.userId);
  await ensureUserBalance(req.userId);
  return success(res, { user }, 'Current user retrieved');
}

export function registerAppAuthRoutes(app) {
  app.post('/api/users', toHono(authenticateUser, getProfile));
  app.get('/api/users/me', toHono(authenticateUser, getProfile));
}
