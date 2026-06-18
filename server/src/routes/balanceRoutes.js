import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { topUpUpload } from '../middleware/multer.js';
import { getBalance, submitTopUpPayment, getTopUpAccounts } from '../controllers/balanceController.js';

const router = express.Router();

router.get('/', authenticateUser, getBalance);
router.get('/topup-accounts', authenticateUser, getTopUpAccounts);
router.post('/topup', authenticateUser, topUpUpload.single('screenshot'), submitTopUpPayment);

export default router;
