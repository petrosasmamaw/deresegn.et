import { Alert } from 'react-native'

/** Block network actions while offline. Returns true when safe to proceed. */
export function alertIfOffline(online, t) {
  if (online) return true
  Alert.alert(t('offline.title'), t('offline.actionBlocked'))
  return false
}
