import { Hono } from 'hono';
import { authenticateUser } from '../middleware/auth.js';
import { adapt } from '../utils/honoAdapter.js';
import {
  getBalance,
  submitTopUpPayment,
  submitTopUpReferencePayment,
  submitTopUpSmsPayment,
  getTopUpAccounts,
} from '../controllers/balanceController.js';

const app = new Hono();

app.get('/', authenticateUser, adapt(getBalance));
app.get('/topup-accounts', authenticateUser, adapt(getTopUpAccounts));
app.post('/topup', authenticateUser, adapt(submitTopUpPayment));
app.post('/topup/reference', authenticateUser, adapt(submitTopUpReferencePayment));
app.post('/topup/sms', authenticateUser, adapt(submitTopUpSmsPayment));

export default app;
