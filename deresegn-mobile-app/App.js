import { StatusBar } from 'expo-status-bar'
import { Provider } from 'react-redux'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { store } from './src/store'
import { LocaleProvider } from './src/i18n/LocaleContext'
import RootNavigator from './src/navigation/RootNavigator'

export default function App() {
  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <LocaleProvider>
          <StatusBar style="dark" />
          <RootNavigator />
        </LocaleProvider>
      </SafeAreaProvider>
    </Provider>
  )
}
