import { submitReceiptCheck, submitReferenceCheck, submitSmsCheck, getCheckHistory, CheckError } from '../services/checkService.js';
import { success, error } from '../utils/response.js';

export async function performCheck(req, res) {
  try {
    if (!req.file) return error(res, 'Receipt screenshot is required', 400);

    const method = req.body.method?.trim();
    const withDetails = req.body.withDetails === 'true' || req.body.withDetails === true;
    const form = {
      senderName: req.body.senderName?.trim() || '',
      senderAccount: req.body.senderAccount?.trim() || '',
      receiverName: req.body.receiverName?.trim() || '',
      receiverAccount: req.body.receiverAccount?.trim() || '',
      amount: req.body.amount || '',
      transactionCode: req.body.transactionCode?.trim() || '',
    };

    if (!method) {
      return error(res, 'Payment method is required', 400);
    }

    if (withDetails) {
      if (!form.senderName || !form.senderAccount || !form.receiverName
        || !form.receiverAccount || !form.amount || !form.transactionCode) {
        return error(res, 'All receipt fields are required', 400);
      }
    }

    const result = await submitReceiptCheck({
      userId: req.userId,
      method,
      form,
      screenshotBuffer: req.file.buffer,
      screenshotMime: req.file.mimetype,
      withDetails,
    });

    return success(res, {
      check: result.check,
      newBalance: result.newBalance,
      validation: result.validation,
      issues: result.issues,
      resolvedDetails: result.resolvedDetails,
    }, result.message, 200);
  } catch (err) {
    if (err instanceof CheckError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        data: err.details,
      });
    }
    return error(res, 'Receipt check failed', 500, err.message);
  }
}

export async function performReferenceCheck(req, res) {
  try {
    const method = req.body.method?.trim();
    const transactionCode = req.body.transactionCode?.trim() || '';
    const accountSuffix = req.body.accountSuffix?.trim() || '';

    if (!method) {
      return error(res, 'Payment method is required', 400);
    }
    if (!transactionCode) {
      return error(res, 'Payment reference is required', 400);
    }

    const result = await submitReferenceCheck({
      userId: req.userId,
      method,
      transactionCode,
      accountSuffix,
    });

    return success(res, {
      check: result.check,
      newBalance: result.newBalance,
      validation: result.validation,
      issues: result.issues,
      resolvedDetails: result.resolvedDetails,
    }, result.message, 200);
  } catch (err) {
    if (err instanceof CheckError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        data: err.details,
      });
    }
    return error(res, 'Payment ID verification failed', 500, err.message);
  }
}

export async function performSmsCheck(req, res) {
  try {
    const method = req.body.method?.trim();
    const smsText = req.body.smsText || '';

    if (!method) {
      return error(res, 'Payment method is required', 400);
    }

    const result = await submitSmsCheck({
      userId: req.userId,
      method,
      smsText,
    });

    return success(res, {
      check: result.check,
      newBalance: result.newBalance,
      validation: result.validation,
      issues: result.issues,
      resolvedDetails: result.resolvedDetails,
    }, result.message, 200);
  } catch (err) {
    if (err instanceof CheckError) {
      return res.status(err.status).json({
        success: false,
        message: err.message,
        data: err.details,
      });
    }
    return error(res, 'SMS verification failed', 500, err.message);
  }
}

export async function getHistory(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const checks = await getCheckHistory(req.userId, limit);
    return success(res, { checks }, 'Check history retrieved');
  } catch (err) {
    return error(res, 'Failed to get check history', 500, err.message);
  }
}
