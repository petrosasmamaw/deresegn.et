import { useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { store } from './src/store'
import { LocaleProvider } from './src/i18n/LocaleContext'
import { setUnauthorizedHandler } from './src/api/sessionExpired'
import { logout, sessionExpired } from './src/features/auth/authSlice'
import { applyOtaUpdateIfAvailable } from './src/lib/checkOtaUpdate'
import OfflineBanner from './src/components/OfflineBanner'
import RootNavigator from './src/navigation/RootNavigator'

function AuthAndUpdateBridge() {
  useEffect(() => {
    setUnauthorizedHandler(() => {
      store.dispatch(sessionExpired())
      store.dispatch(logout())
    })
    applyOtaUpdateIfAvailable()
    return () => setUnauthorizedHandler(null)
  }, [])
  return null
}

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <LocaleProvider>
          <StatusBar style="dark" />
          <AuthAndUpdateBridge />
          <OfflineBanner />
          <RootNavigator />
        </LocaleProvider>
      </SafeAreaProvider>
    </Provider>
  )
}
