import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { success } from '../utils/response.js';
import { getUserById } from '../services/userService.js';
import { ensureUserBalance } from '../services/checkService.js';

const router = express.Router();

async function getProfile(req, res) {
  const user = await getUserById(req.userId);
  await ensureUserBalance(req.userId);
  return success(res, { user }, 'Current user retrieved');
}

router.post('/', authenticateUser, getProfile);
router.get('/me', authenticateUser, getProfile);

export default router;
