import * as Clipboard from 'expo-clipboard'
import { Share } from 'react-native'
import { getWebBaseUrl } from '../api/apiBase'

export function buildShareUrl(shareToken) {
  if (!shareToken) return null
  return `${getWebBaseUrl()}/verify/${shareToken}`
}

export async function copyCertLink(shareToken) {
  const url = buildShareUrl(shareToken)
  if (!url) throw new Error('No share token')
  await Clipboard.setStringAsync(url)
  return url
}

export async function shareCertLink(shareToken, title = 'Verification certificate') {
  const url = buildShareUrl(shareToken)
  if (!url) throw new Error('No share token')
  await Share.share({
    message: `${title}\n${url}`,
    url,
    title,
  })
  return url
}
