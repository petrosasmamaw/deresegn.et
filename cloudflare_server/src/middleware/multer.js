import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { isWorkersRuntime } from '../config/runtime.js';

if (!isWorkersRuntime() && !fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

function createUploadMiddleware(prefix) {
  const storage = isWorkersRuntime()
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: 'uploads/',
        filename: (_req, file, cb) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          const unique = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${ext}`);
        },
      });

  return multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new Error('Only JPG, PNG, or WEBP screenshots are allowed'));
    },
  });
}

export const topUpUpload = createUploadMiddleware('topup');

export const checkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only JPG, PNG, or WEBP screenshots are allowed'));
  },
});
