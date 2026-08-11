import { useCallback, useEffect, useState } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useDispatch, useSelector } from 'react-redux'
import { fetchSession } from '../features/auth/authSlice'
import SplashScreen from '../screens/SplashScreen'
import LoginScreen from '../screens/LoginScreen'
import RegisterScreen from '../screens/RegisterScreen'
import AdminHomeScreen from '../screens/AdminHomeScreen'
import MainTabs from './MainTabs'
import { colors } from '../theme/tokens'

const Stack = createNativeStackNavigator()

export default function RootNavigator() {
  const dispatch = useDispatch()
  const { user, initializing } = useSelector((s) => s.auth)
  const [gateOpen, setGateOpen] = useState(true)

  useEffect(() => {
    dispatch(fetchSession())
  }, [dispatch])

  const finishSplash = useCallback(() => {
    setGateOpen(false)
  }, [])

  if (gateOpen) {
    return <SplashScreen onFinished={finishSplash} initializing={initializing} />
  }

  return (
    <NavigationContainer>
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
