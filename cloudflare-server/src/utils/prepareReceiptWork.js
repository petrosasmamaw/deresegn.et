import { Jimp } from './jimp.js';
import { isWorkersRuntime } from '../config/runtime.js';

const OCR_MAX_EDGE = 1600;
const OCR_JPEG_QUALITY = 78;
const IS_WORKERS = isWorkersRuntime();
const QR_SCAN_MAX_DIM = IS_WORKERS
  ? Number(process.env.QR_SCAN_MAX_DIM) || 1400
  : Number(process.env.QR_SCAN_MAX_DIM) || 2200;
const QR_SCAN_MIN_DIM = 400;

/**
 * One Jimp read for both QR scan and Gemini OCR — avoids duplicate decode on large screenshots.
 */
export async function prepareReceiptWork(buffer, mime = 'image/jpeg') {
  if (!buffer?.length) {
    return { qrImage: null, ocrBuffer: buffer, ocrMime: mime };
  }

  try {
    let image = await Jimp.read(buffer);
    const { width, height } = image.bitmap;
    const maxDim = Math.max(width, height);
    const minDim = Math.min(width, height);

    let qrImage = image;
    if (maxDim > QR_SCAN_MAX_DIM) {
      qrImage = image.clone().scale(QR_SCAN_MAX_DIM / maxDim);
    } else if (minDim < QR_SCAN_MIN_DIM) {
      const factor = Math.min(
        Math.max(QR_SCAN_MIN_DIM / minDim, 400 / width, 400 / height, 1),
        3,
      );
      qrImage = image.clone().scale(factor);
    }

    const qrLong = Math.max(qrImage.bitmap.width, qrImage.bitmap.height);
    let ocrImage = qrImage;
    if (qrLong > OCR_MAX_EDGE) {
      ocrImage = qrImage.clone().scale(OCR_MAX_EDGE / qrLong);
    }

    const shouldReencode = qrLong > OCR_MAX_EDGE
      || buffer.length > 400_000
      || !/^image\/jpe?g$/i.test(mime);

    if (!shouldReencode) {
      return { qrImage, ocrBuffer: buffer, ocrMime: mime };
    }

    const ocrBuffer = await ocrImage.getBuffer('image/jpeg', { quality: OCR_JPEG_QUALITY });
    return { qrImage, ocrBuffer, ocrMime: 'image/jpeg' };
  } catch (err) {
    console.warn('[Receipt] prepare work failed:', err.message);
    return { qrImage: null, ocrBuffer: buffer, ocrMime: mime };
  }
}
