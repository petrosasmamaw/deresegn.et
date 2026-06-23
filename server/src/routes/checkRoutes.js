import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { checkUpload } from '../middleware/multer.js';
import { performCheck, performReferenceCheck, performSmsCheck, getHistory, getCheckDetail, getPublicCertificate } from '../controllers/checkController.js';

const router = express.Router();

router.get('/certificate/:token', getPublicCertificate);
router.post('/', authenticateUser, checkUpload.single('screenshot'), performCheck);
router.post('/reference', authenticateUser, performReferenceCheck);
router.post('/sms', authenticateUser, performSmsCheck);
router.get('/history', authenticateUser, getHistory);
router.get('/:id', authenticateUser, getCheckDetail);

export default router;
