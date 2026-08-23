import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import {
  USER_ACCOUNT_METHODS,
  deleteUserPaymentAccount,
  listUserPaymentAccounts,
  upsertUserPaymentAccount,
} from '../services/userPaymentAccountService.js';

const router = express.Router();

router.get('/accounts', authenticateUser, async (req, res) => {
  try {
    const accounts = await listUserPaymentAccounts(req.userId);
    return success(res, { accounts }, 'Accounts loaded');
  } catch (err) {
    return error(res, 'Failed to load accounts', 500, err.message);
  }
});

router.put('/accounts/:method', authenticateUser, async (req, res) => {
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
});

router.delete('/accounts/:method', authenticateUser, async (req, res) => {
  try {
    const method = String(req.params.method || '').toLowerCase();
    await deleteUserPaymentAccount(req.userId, method);
    return success(res, { method }, 'Account removed');
  } catch (err) {
    return error(res, 'Failed to remove account', 500, err.message);
  }
});

export default router;
