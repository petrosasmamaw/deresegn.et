import { Hono } from 'hono';
import { authenticateUser } from '../middleware/auth.js';
import { adapt } from '../utils/honoAdapter.js';
import {
  performCheck,
  performReferenceCheck,
  performSmsCheck,
  getHistory,
  getCheckDetail,
  getPublicCertificate,
  getVerifyChannelsCatalog,
} from '../controllers/checkController.js';

const app = new Hono();

app.get('/certificate/:token', adapt(getPublicCertificate));
app.get('/channels', adapt(getVerifyChannelsCatalog));
app.post('/', authenticateUser, adapt(performCheck));
app.post('/reference', authenticateUser, adapt(performReferenceCheck));
app.post('/sms', authenticateUser, adapt(performSmsCheck));
app.get('/history', authenticateUser, adapt(getHistory));
app.get('/:id', authenticateUser, adapt(getCheckDetail));

export default app;
