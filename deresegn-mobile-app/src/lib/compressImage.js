/**
 * Compress receipt screenshots for upload (mirrors web compressImage.js).
 * Uses expo-image-manipulator.
 */
import * as ImageManipulator from 'expo-image-manipulator'

const MAX_EDGE = 1600
const JPEG_QUALITY = 0.78

/**
 * @param {{ uri: string, width?: number, height?: number, mimeType?: string, fileName?: string }} asset
 * @returns {Promise<{ uri: string, name: string, type: string }>}
 */
export async function compressImageForUpload(asset) {
  if (!asset?.uri) {
    throw new Error('No image selected')
  }

  const actions = []
  const w = asset.width || 0
  const h = asset.height || 0
  const longEdge = Math.max(w, h)

  if (longEdge > MAX_EDGE) {
    const scale = MAX_EDGE / longEdge
    if (w >= h) {
      actions.push({ resize: { width: Math.max(1, Math.round(w * scale)) } })
    } else {
      actions.push({ resize: { height: Math.max(1, Math.round(h * scale)) } })
    }
  }

  const result = await ImageManipulator.manipulateAsync(
    asset.uri,
    actions,
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  )

  return {
    uri: result.uri,
    name: 'receipt.jpg',
    type: 'image/jpeg',
  }
}
