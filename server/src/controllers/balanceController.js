import { getUserBalance, submitTopUp, TopUpError } from '../services/balanceService.js';
import { getAllTopUpReceiverAccounts, isTopUpMethod } from '../services/topUpAccountService.js';
import { success, error } from '../utils/response.js';

export async function getBalance(req, res) {
  try {
    const balance = await getUserBalance(req.userId);
    return success(res, { balance }, 'Balance retrieved');
  } catch (err) {
    return error(res, 'Failed to get balance', 500, err.message);
  }
}

export async function getTopUpAccounts(req, res) {
  try {
    const accounts = await getAllTopUpReceiverAccounts();
    return success(res, { accounts }, 'Top-up accounts retrieved');
  } catch (err) {
    return error(res, 'Failed to get top-up accounts', 500, err.message);
  }
}

export async function submitTopUpPayment(req, res) {
  try {
    if (!req.file) return error(res, 'Screenshot image is required', 400);

    const method = req.body.method?.trim().toLowerCase() || 'telebirr';
    if (!isTopUpMethod(method)) {
      return error(res, 'Top-up only supports Telebirr and CBE', 400);
    }

    const result = await submitTopUp({
      userId: req.userId,
      screenshotPath: req.file.path,
      method,
    });

    return success(res, result, result.message, 200);
  } catch (err) {
    if (err instanceof TopUpError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        data: err.details,
      });
    }
    return error(res, 'Top-up submission failed', 500, err.message);
  }
}
