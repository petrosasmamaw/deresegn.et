import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { getAdminDashboardData, getUserDetailData, updateAdminUser, deleteAdminUser } from '../services/adminService.js';
import {
  getAllTopUpReceiverAccounts,
  updateTopUpReceiverAccount,
  isTopUpMethod,
} from '../services/topUpAccountService.js';
import {
  getRegistrationBonusSettings,
  setSetting,
} from '../services/balanceLedgerService.js';
import { getAllVerifications, getAllTopups } from '../services/adminService.js';

const router = express.Router();

async function checkAdminRole(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

async function getDashboardData(req, res) {
  try {
    const data = await getAdminDashboardData();
    return success(res, data, 'Admin dashboard data retrieved');
  } catch (err) {
    return error(res, 'Failed to get dashboard data', 500, err.message);
  }
}

async function getUserDetails(req, res) {
  try {
    const { userId } = req.params;
    const data = await getUserDetailData(userId);
    return success(res, data, 'User details retrieved');
  } catch (err) {
    return error(res, err.message || 'Failed to get user details', err.message === 'User not found' ? 404 : 500);
  }
}

async function patchUser(req, res) {
  try {
    const { userId } = req.params;
    const data = await updateAdminUser(userId, req.body || {});
    return success(res, data, 'User updated');
  } catch (err) {
    const status = /not found/i.test(err.message) ? 404 : 400;
    return error(res, err.message || 'Failed to update user', status);
  }
}

async function removeUser(req, res) {
  try {
    const { userId } = req.params;
    const result = await deleteAdminUser(userId, req.userId);
    return success(res, result, 'User deleted');
  } catch (err) {
    const status = /not found/i.test(err.message) ? 404 : 400;
    return error(res, err.message || 'Failed to delete user', status);
  }
}

async function getTopUpAccounts(req, res) {
  try {
    const accounts = await getAllTopUpReceiverAccounts();
    return success(res, { accounts }, 'Top-up accounts retrieved');
  } catch (err) {
    return error(res, 'Failed to get top-up accounts', 500, err.message);
  }
}

async function updateTopUpAccount(req, res) {
  try {
    const method = req.params.method?.trim().toLowerCase();
    if (!isTopUpMethod(method)) {
      return error(res, 'Only Telebirr and CBE accounts can be updated', 400);
    }

    const { receiverName, receiverAccount } = req.body || {};
    const updated = await updateTopUpReceiverAccount(method, { receiverName, receiverAccount });
    return success(res, { account: updated }, 'Top-up account updated');
  } catch (err) {
    return error(res, err.message || 'Failed to update top-up account', 400);
  }
}

async function updateRegistrationBonusSettings(req, res) {
  try {
    const { amount, enabled } = req.body || {};
    if (amount != null) {
      const parsed = parseFloat(amount);
      if (Number.isNaN(parsed) || parsed < 0) {
        return error(res, 'Bonus amount must be a non-negative number', 400);
      }
      await setSetting('registration_bonus_amount', String(parsed));
    }
    if (enabled != null) {
      await setSetting('registration_bonus_enabled', enabled ? 'true' : 'false');
    }
    const settings = await getRegistrationBonusSettings();
    return success(res, { settings }, 'Registration bonus settings updated');
  } catch (err) {
    return error(res, 'Failed to update bonus settings', 500, err.message);
  }
}

async function listVerifications(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const checks = await getAllVerifications(limit);
    return success(res, { checks }, 'Verifications retrieved');
  } catch (err) {
    return error(res, 'Failed to list verifications', 500, err.message);
  }
}

async function listTopups(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const topups = await getAllTopups(limit);
    return success(res, { topups }, 'Top-ups retrieved');
  } catch (err) {
    return error(res, 'Failed to list top-ups', 500, err.message);
  }
}

router.get('/dashboard', authenticateUser, checkAdminRole, getDashboardData);
router.get('/users/:userId', authenticateUser, checkAdminRole, getUserDetails);
router.put('/users/:userId', authenticateUser, checkAdminRole, patchUser);
router.delete('/users/:userId', authenticateUser, checkAdminRole, removeUser);
router.get('/topup-accounts', authenticateUser, checkAdminRole, getTopUpAccounts);
router.put('/topup-accounts/:method', authenticateUser, checkAdminRole, updateTopUpAccount);
router.get('/settings/registration-bonus', authenticateUser, checkAdminRole, async (req, res) => {
  try {
    const settings = await getRegistrationBonusSettings();
    return success(res, { settings }, 'Registration bonus settings retrieved');
  } catch (err) {
    return error(res, 'Failed to get bonus settings', 500, err.message);
  }
});
router.put('/settings/registration-bonus', authenticateUser, checkAdminRole, updateRegistrationBonusSettings);
router.get('/verifications', authenticateUser, checkAdminRole, listVerifications);
router.get('/topups', authenticateUser, checkAdminRole, listTopups);

export default router;
