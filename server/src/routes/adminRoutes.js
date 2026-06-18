import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { getAdminDashboardData, getUserDetailData } from '../services/adminService.js';

const router = express.Router();

async function checkAdminRole(req, res, next) {
  // This would be expanded to check actual admin role in production
  // For now, you can set specific user IDs as admin or check role from auth
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

router.get('/dashboard', authenticateUser, checkAdminRole, getDashboardData);
router.get('/users/:userId', authenticateUser, checkAdminRole, getUserDetails);

export default router;
