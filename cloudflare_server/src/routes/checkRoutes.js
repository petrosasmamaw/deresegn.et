import express from 'express';
import { authenticateUser } from '../middleware/auth.js';
import { checkUpload } from '../middleware/multer.js';
import { performCheck, performReferenceCheck, performSmsCheck, getHistory, getCheckDetail, getPublicCertificate, getVerifyChannelsCatalog } from '../controllers/checkController.js';

const router = express.Router();

router.get('/certificate/:token', getPublicCertificate);
router.get('/channels', authenticateUser, getVerifyChannelsCatalog);
router.post('/', checkUpload.single('screenshot'), authenticateUser, performCheck);
router.post('/reference', authenticateUser, performReferenceCheck);
router.post('/sms', authenticateUser, performSmsCheck);
router.get('/history', authenticateUser, getHistory);
router.get('/:id', authenticateUser, getCheckDetail);

export default router;
