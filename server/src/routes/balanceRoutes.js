import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { topUpUpload } from '../middleware/multer.js';
import { getBalance, submitTopUpPayment } from '../controllers/balanceController.js';

const router = express.Router();

router.get('/', authenticateUser, getBalance);
router.post('/topup', authenticateUser, topUpUpload.single('screenshot'), submitTopUpPayment);

export default router;
