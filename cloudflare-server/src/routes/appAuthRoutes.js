import { Hono } from 'hono';
import { authenticateUser } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import { getUserById } from '../services/userService.js';
import { ensureUserBalance } from '../services/checkService.js';
import { ensureRegistrationBonus } from '../services/balanceLedgerService.js';
import { adapt } from '../utils/honoAdapter.js';

const app = new Hono();

async function getProfile(req, res) {
  await ensureRegistrationBonus(req.userId);
  const user = await getUserById(req.userId);
  await ensureUserBalance(req.userId);
  return success(res, { user }, 'Current user retrieved');
}

app.post('/', authenticateUser, adapt(getProfile));
app.get('/me', authenticateUser, adapt(getProfile));

export default app;
