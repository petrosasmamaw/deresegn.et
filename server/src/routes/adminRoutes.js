import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { getAdminDashboardData, getUserDetailData } from '../services/adminService.js';
import {
  getAllTopUpReceiverAccounts,
  updateTopUpReceiverAccount,
  isTopUpMethod,
} from '../services/topUpAccountService.js';

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
    return error(res, 'Failed to get user details', 500, err.message);
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

router.get('/dashboard', authenticateUser, checkAdminRole, getDashboardData);
router.get('/users/:userId', authenticateUser, checkAdminRole, getUserDetails);
router.get('/topup-accounts', authenticateUser, checkAdminRole, getTopUpAccounts);
router.put('/topup-accounts/:method', authenticateUser, checkAdminRole, updateTopUpAccount);

export default router;
