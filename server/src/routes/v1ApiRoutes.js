import express from 'express';
import { authenticateApiKey } from '../middleware/apiKeyAuth.js';
import { submitReferenceCheck, submitSmsCheck, CheckError } from '../services/checkService.js';
import { success, error } from '../utils/response.js';

const router = express.Router();

function apiError(res, err) {
  if (err instanceof CheckError) {
    return res.status(err.status).json({
      success: false,
      message: err.message,
      code: err.details?.code || undefined,
      data: err.details,
    });
  }
  console.error('[API v1]', err);
  return error(res, 'Verification failed', 500, err.message);
}

/** Public guide — no auth. */
router.get('/', (_req, res) => {
  return success(res, {
    auth: {
      header: 'X-API-Key: dk_live_…',
      alt: 'Authorization: Bearer dk_live_…',
    },
    endpoints: {
      me: 'GET /api/v1/me',
      verifyReference: 'POST /api/v1/verify/reference',
      verifySms: 'POST /api/v1/verify/sms',
    },
    banks: [
      {
        method: 'telebirr',
        body: { method: 'telebirr', transactionCode: 'DG65L5I9M5' },
        note: '10-character Invoice No.',
      },
      {
        method: 'cbe',
        body: { method: 'cbe', transactionCode: 'FT26169D8C5M', accountSuffix: '12345678' },
        note: 'FT reference + last 8 digits of sender account',
      },
      {
        method: 'boa',
        body: { method: 'boa', transactionCode: 'FT26169X4SRS', accountSuffix: '12345' },
        note: 'FT reference + last 5 digits of sender account',
      },
      {
        method: 'dashen',
        body: { method: 'dashen', transactionCode: '110IPSS2616900WO' },
        note: 'IPSS reference from VAT receipt (not Super App QR)',
      },
    ],
    sms: {
      methods: ['telebirr', 'cbe'],
      body: { method: 'telebirr', smsText: 'Paste full bank SMS including receipt link' },
    },
    capacity: 'Sum of verified payment amounts (Birr). When used >= capacity, key status becomes expired — renew after topping up.',
  }, 'Deresegn Paid Verify API');
});

router.get('/me', authenticateApiKey, async (req, res) => {
  try {
    const capacity = Number(req.apiKey.capacityAmount) || 0;
    const used = Number(req.apiKey.usedAmount) || 0;
    return success(res, {
      keyPrefix: req.apiKey.keyPrefix,
      status: req.apiKey.status,
      capacityAmount: capacity,
      usedAmount: used,
      remainingAmount: Math.max(0, capacity - used),
    }, 'API key status');
  } catch (err) {
    return apiError(res, err);
  }
});

/**
 * External verify by payment ID / reference.
 * Header: X-API-Key: dk_live_...   OR   Authorization: Bearer dk_live_...
 * Body: { method, transactionCode, accountSuffix? }
 */
router.post('/verify/reference', authenticateApiKey, async (req, res) => {
  try {
    const method = req.body.method?.trim();
    const transactionCode = req.body.transactionCode?.trim() || '';
    const accountSuffix = req.body.accountSuffix?.trim() || '';

    if (!method) return error(res, 'Payment method is required', 400);
    if (!transactionCode) return error(res, 'Payment reference is required', 400);

    const result = await submitReferenceCheck({
      userId: req.userId,
      method,
      transactionCode,
      accountSuffix,
      billing: { type: 'api_key', apiKeyId: req.apiKey.id, apiKeyRow: req.apiKey },
    });

    return success(res, {
      check: result.check,
      validation: result.validation,
      issues: result.issues,
      resolvedDetails: result.resolvedDetails,
      isRecheck: Boolean(result.isRecheck),
      apiKey: result.apiKey || null,
      message: result.message,
    }, result.message);
  } catch (err) {
    return apiError(res, err);
  }
});

router.post('/verify/sms', authenticateApiKey, async (req, res) => {
  try {
    const method = req.body.method?.trim();
    const smsText = req.body.smsText || '';

    if (!method) return error(res, 'Payment method is required', 400);

    const result = await submitSmsCheck({
      userId: req.userId,
      method,
      smsText,
      billing: { type: 'api_key', apiKeyId: req.apiKey.id, apiKeyRow: req.apiKey },
    });

    return success(res, {
      check: result.check,
      validation: result.validation,
      issues: result.issues,
      resolvedDetails: result.resolvedDetails,
      isRecheck: Boolean(result.isRecheck),
      apiKey: result.apiKey || null,
      message: result.message,
    }, result.message);
  } catch (err) {
    return apiError(res, err);
  }
});

export default router;
