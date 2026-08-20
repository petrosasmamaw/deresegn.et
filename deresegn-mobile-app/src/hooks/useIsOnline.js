import { useEffect, useState } from 'react'
import NetInfo from '@react-native-community/netinfo'

/**
 * Reactive online/offline flag. Used to block auth/verify/top-up submits
 * while offline — the banner alone is informational; this hook guards actions.
 */
export function useIsOnline() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const noLink = state.isConnected === false
      const noNet = state.isInternetReachable === false
      setOnline(!(noLink || noNet))
    })
    return () => unsub()
  }, [])

  return online
}

export default useIsOnline
