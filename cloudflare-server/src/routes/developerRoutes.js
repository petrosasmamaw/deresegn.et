import { Hono } from 'hono';
import { authenticateUser } from '../middleware/auth.js';
import { success, error } from '../utils/response.js';
import { CheckError } from '../services/checkService.js';
import { adapt } from '../utils/honoAdapter.js';
import {
  getPricingCatalog,
  listUserApiKeys,
  purchaseApiKey,
  renewApiKey,
  revokeApiKey,
  revealApiKey,
  ensureApiKeysTable,
} from '../services/apiKeyService.js';

const app = new Hono();

app.get(
  '/pricing',
  adapt(async (_req, res) => {
    try {
      return success(res, getPricingCatalog(), 'Pricing catalog');
    } catch (err) {
      return error(res, 'Failed to load pricing', 500, err.message);
    }
  }),
);

app.get(
  '/keys',
  authenticateUser,
  adapt(async (req, res) => {
    try {
      await ensureApiKeysTable();
      const keys = await listUserApiKeys(req.userId);
      return success(res, { keys, pricing: getPricingCatalog() }, 'API keys');
    } catch (err) {
      return error(res, 'Failed to list API keys', 500, err.message);
    }
  }),
);

app.post(
  '/keys',
  authenticateUser,
  adapt(async (req, res) => {
    try {
      const packageId = req.body.packageId?.trim();
      const name = req.body.name?.trim();
      const result = await purchaseApiKey(req.userId, { packageId, name });
      return success(res, result, 'API key created. You can reveal it anytime with the eye icon.', 201);
    } catch (err) {
      if (err instanceof CheckError) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
          data: err.details,
        });
      }
      return error(res, 'Failed to create API key', 500, err.message);
    }
  }),
);

app.post(
  '/keys/:id/reveal',
  authenticateUser,
  adapt(async (req, res) => {
    try {
      const data = await revealApiKey(req.userId, req.params.id);
      return success(res, data, 'API key revealed');
    } catch (err) {
      if (err instanceof CheckError) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
          data: err.details,
        });
      }
      return error(res, 'Failed to reveal API key', 500, err.message);
    }
  }),
);

/** @deprecated Prefer POST /keys/:id/reveal */
app.get(
  '/keys/:id/reveal',
  authenticateUser,
  adapt(async (req, res) => {
    try {
      const data = await revealApiKey(req.userId, req.params.id);
      return success(res, data, 'API key revealed');
    } catch (err) {
      if (err instanceof CheckError) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
          data: err.details,
        });
      }
      return error(res, 'Failed to reveal API key', 500, err.message);
    }
  }),
);

app.post(
  '/keys/:id/renew',
  authenticateUser,
  adapt(async (req, res) => {
    try {
      const packageId = req.body.packageId?.trim();
      const result = await renewApiKey(req.userId, req.params.id, { packageId });
      return success(res, result, 'API key renewed — capacity added');
    } catch (err) {
      if (err instanceof CheckError) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
          data: err.details,
        });
      }
      return error(res, 'Failed to renew API key', 500, err.message);
    }
  }),
);

app.post(
  '/keys/:id/revoke',
  authenticateUser,
  adapt(async (req, res) => {
    try {
      const key = await revokeApiKey(req.userId, req.params.id);
      return success(res, { key }, 'API key revoked');
    } catch (err) {
      if (err instanceof CheckError) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
          data: err.details,
        });
      }
      return error(res, 'Failed to revoke API key', 500, err.message);
    }
  }),
);

export default app;
