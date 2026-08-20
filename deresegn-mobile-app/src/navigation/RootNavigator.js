import { useCallback, useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import NetInfo from '@react-native-community/netinfo'
import { useDispatch, useSelector } from 'react-redux'
import { fetchSession } from '../features/auth/authSlice'
import SplashScreen from '../screens/SplashScreen'
import LoginScreen from '../screens/LoginScreen'
import RegisterScreen from '../screens/RegisterScreen'
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen'
import AdminHomeScreen from '../screens/AdminHomeScreen'
import MainTabs from './MainTabs'
import { colors } from '../theme/tokens'

const Stack = createNativeStackNavigator()

export default function RootNavigator() {
  const dispatch = useDispatch()
  const { user, initializing, sessionNetworkError } = useSelector((s) => s.auth)
  const [gateOpen, setGateOpen] = useState(true)

  useEffect(() => {
    dispatch(fetchSession())
  }, [dispatch])

  // Retry session restore when connectivity returns after a transient boot failure.
  useEffect(() => {
    if (!sessionNetworkError) return undefined
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false
      if (online) dispatch(fetchSession())
    })
    return () => unsub()
  }, [sessionNetworkError, dispatch])

  const finishSplash = useCallback(() => {
    setGateOpen(false)
  }, [])

  if (gateOpen) {
    return (
      <SplashScreen
        onFinished={finishSplash}
        initializing={initializing}
        sessionNetworkError={sessionNetworkError}
        onRetry={() => dispatch(fetchSession())}
      />
    )
  }

  const navKey = user?.id ?? (sessionNetworkError ? 'offline' : 'guest')

  return (
    <NavigationContainer key={navKey}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.parchment },
          animation: 'fade',
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : user.role === 'admin' ? (
          <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
