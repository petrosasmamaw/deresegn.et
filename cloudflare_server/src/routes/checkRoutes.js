import { toHono, multipartFile } from '../adapters/expressToHono.js';
import { authenticateUser } from '../middleware/auth.js';
import {
  performCheck,
  performReferenceCheck,
  performSmsCheck,
  getHistory,
  getCheckDetail,
  getPublicCertificate,
  getVerifyChannelsCatalog,
} from '../controllers/checkController.js';

export function registerCheckRoutes(app) {
  app.get('/api/check/certificate/:token', toHono(getPublicCertificate));
  app.get('/api/check/channels', toHono(authenticateUser, getVerifyChannelsCatalog));
  app.post(
    '/api/check',
    multipartFile('screenshot'),
    toHono(authenticateUser, performCheck),
  );
  app.post('/api/check/reference', toHono(authenticateUser, performReferenceCheck));
  app.post('/api/check/sms', toHono(authenticateUser, performSmsCheck));
  app.get('/api/check/history', toHono(authenticateUser, getHistory));
  app.get('/api/check/:id', toHono(authenticateUser, getCheckDetail));
}
