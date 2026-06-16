import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { checkUpload } from '../middleware/multer.js';
import { performCheck, getHistory } from '../controllers/checkController.js';

const router = express.Router();

router.post('/', authenticateUser, checkUpload.single('screenshot'), performCheck);
router.get('/history', authenticateUser, getHistory);

export default router;
