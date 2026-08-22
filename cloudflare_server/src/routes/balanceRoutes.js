import { toHono, multipartFile } from '../adapters/expressToHono.js';
import { authenticateUser } from '../middleware/auth.js';
import {
  getBalance,
  submitTopUpPayment,
  submitTopUpReferencePayment,
  submitTopUpSmsPayment,
  getTopUpAccounts,
} from '../controllers/balanceController.js';

export function registerBalanceRoutes(app) {
  app.get('/api/balance', toHono(authenticateUser, getBalance));
  app.get('/api/balance/topup-accounts', toHono(authenticateUser, getTopUpAccounts));
  app.post(
    '/api/balance/topup',
    multipartFile('screenshot'),
    toHono(authenticateUser, submitTopUpPayment),
  );
  app.post('/api/balance/topup/reference', toHono(authenticateUser, submitTopUpReferencePayment));
  app.post('/api/balance/topup/sms', toHono(authenticateUser, submitTopUpSmsPayment));
}
