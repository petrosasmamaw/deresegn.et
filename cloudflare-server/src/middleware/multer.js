import multer from 'multer';

function createMemoryUploadMiddleware() {
  return multer({
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
}

export const topUpUpload = createMemoryUploadMiddleware();
export const checkUpload = createMemoryUploadMiddleware();
