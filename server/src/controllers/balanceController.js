import { getUserBalance, submitTopUp, TopUpError } from '../services/balanceService.js';
import { success, error } from '../utils/response.js';

export async function getBalance(req, res) {
  try {
    const balance = await getUserBalance(req.userId);
    return success(res, { balance }, 'Balance retrieved');
  } catch (err) {
    return error(res, 'Failed to get balance', 500, err.message);
  }
}

export async function submitTopUpPayment(req, res) {
  try {
    if (!req.file) return error(res, 'Screenshot image is required', 400);

    const method = req.body.method?.trim() || 'telebirr';
    const form = {
      senderName: req.body.senderName?.trim(),
      senderAccount: req.body.senderAccount?.trim(),
      receiverName: req.body.receiverName?.trim(),
      receiverAccount: req.body.receiverAccount?.trim(),
      amount: req.body.amount,
      transactionCode: req.body.transactionCode?.trim(),
    };

    if (!form.senderName || !form.senderAccount || !form.receiverName
      || !form.receiverAccount || !form.amount || !form.transactionCode) {
      return error(res, 'All payment fields are required', 400);
    }

    const result = await submitTopUp({
      userId: req.userId,
      screenshotPath: req.file.path,
      form,
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
