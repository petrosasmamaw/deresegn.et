import { toHono } from '../adapters/expressToHono.js';
import { authenticateUser } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import {
  USER_ACCOUNT_METHODS,
  deleteUserPaymentAccount,
  listUserPaymentAccounts,
  upsertUserPaymentAccount,
} from '../services/userPaymentAccountService.js';

export function registerMeRoutes(app) {
  app.get('/api/me/accounts', toHono(authenticateUser, async (req, res) => {
    try {
      const accounts = await listUserPaymentAccounts(req.userId);
      return success(res, { accounts }, 'Accounts loaded');
    } catch (err) {
      return error(res, 'Failed to load accounts', 500, err.message);
    }
  }));

  app.put('/api/me/accounts/:method', toHono(authenticateUser, async (req, res) => {
    try {
      const method = String(req.params.method || '').toLowerCase();
      if (!USER_ACCOUNT_METHODS.includes(method)) {
        return error(res, 'Unsupported payment method', 400);
      }
      const account = await upsertUserPaymentAccount(req.userId, method, {
        accountName: req.body.accountName,
        accountNumber: req.body.accountNumber,
      });
      return success(res, { account }, 'Account saved');
    } catch (err) {
      const status = /required|must be|Choose|Unsupported/i.test(err.message) ? 400 : 500;
      return error(res, err.message || 'Failed to save account', status);
    }
  }));

  app.delete('/api/me/accounts/:method', toHono(authenticateUser, async (req, res) => {
    try {
      const method = String(req.params.method || '').toLowerCase();
      await deleteUserPaymentAccount(req.userId, method);
      return success(res, { method }, 'Account removed');
    } catch (err) {
      return error(res, 'Failed to remove account', 500, err.message);
    }
  }));
}
