import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { topUpUpload } from '../middleware/multer.js';
import { getBalance, submitTopUpPayment, submitTopUpReferencePayment, submitTopUpSmsPayment, getTopUpAccounts } from '../controllers/balanceController.js';

const router = express.Router();

router.get('/', authenticateUser, getBalance);
router.get('/topup-accounts', authenticateUser, getTopUpAccounts);
router.post('/topup', topUpUpload.single('screenshot'), authenticateUser, submitTopUpPayment);
router.post('/topup/reference', authenticateUser, submitTopUpReferencePayment);
router.post('/topup/sms', authenticateUser, submitTopUpSmsPayment);

export default router;
