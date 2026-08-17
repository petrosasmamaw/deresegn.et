import * as Updates from 'expo-updates'

/**
 * Pull a published EAS Update on cold start (production / preview builds only).
 * Expo Go and `expo start` skip this.
 */
export async function applyOtaUpdateIfAvailable() {
  if (__DEV__) return
  if (!Updates.isEnabled) return
  try {
    const check = await Updates.checkForUpdateAsync()
    if (!check.isAvailable) return
    await Updates.fetchUpdateAsync()
    await Updates.reloadAsync()
  } catch {
    // Offline or channel not configured — continue on the bundled JS.
  }
}
