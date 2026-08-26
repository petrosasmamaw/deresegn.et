/** Resize receipt screenshots for fast server OCR (always optimize, not only >4MB). */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.78;
const OPTIMIZE_ABOVE_BYTES = 350 * 1024;

export async function compressImageForUpload(file, maxBytes = 3.5 * 1024 * 1024) {
  if (!file?.type?.startsWith('image/')) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const shouldResize = longEdge > MAX_EDGE || file.size > OPTIMIZE_ABOVE_BYTES;

  if (!shouldResize && file.size <= maxBytes) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / longEdge);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY);
  });

  if (!blob) {
    return file;
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'receipt';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
