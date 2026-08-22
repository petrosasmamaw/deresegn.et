import { Jimp } from 'jimp';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 78;

/** Shrink large phone screenshots before OCR/QR — faster Gemini and smaller uploads. */
export async function prepareOcrBuffer(buffer, mime = 'image/jpeg') {
  if (!buffer?.length) {
    return { buffer, mime };
  }

  try {
    let image = await Jimp.read(buffer);
    const { width, height } = image.bitmap;
    const longEdge = Math.max(width, height);

    if (longEdge > MAX_EDGE) {
      image = image.clone().scale(MAX_EDGE / longEdge);
    }

    const shouldReencode = longEdge > MAX_EDGE
      || buffer.length > 400_000
      || !/^image\/jpe?g$/i.test(mime);

    if (!shouldReencode) {
      return { buffer, mime };
    }

    const out = await image.getBuffer('image/jpeg', { quality: JPEG_QUALITY });
    return { buffer: out, mime: 'image/jpeg' };
  } catch (err) {
    console.warn('[OCR] prepare buffer failed:', err.message);
    return { buffer, mime };
  }
}
