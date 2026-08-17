import { useEffect } from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useDispatch, useSelector } from 'react-redux'
import { DashboardUiProvider, useDashboardUi } from '../context/DashboardUiContext'
import AppBottomBar from '../components/AppBottomBar'
import TopUpModal from '../components/TopUpModal'
import HomeScreen from '../screens/HomeScreen'
import HistoryScreen from '../screens/HistoryScreen'
import DeveloperApiScreen from '../screens/DeveloperApiScreen'
import MyAccountsScreen from '../screens/MyAccountsScreen'
import {
  fetchCheckHistory,
  performCheck,
  performReferenceCheck,
  performSmsCheck,
} from '../features/checks/checksSlice'
import {
  fetchBalance,
  submitTopUp,
  submitTopUpReference,
  submitTopUpSms,
} from '../features/balance/balanceSlice'
import { useLocale } from '../i18n/LocaleContext'
import { colors } from '../theme/tokens'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

function successCheck(result) {
  const { check, resolvedDetails, previousVerification } = result.payload
  return {
    success: true,
    resolvedDetails,
    check: {
      ...check,
      previousVerification: check?.previousVerification || previousVerification || null,
    },
  }
}

function successTopUp(result) {
  return {
    success: true,
    resolvedDetails: result.payload.resolvedDetails,
  }
}

function failureFrom(payload, fallback) {
  const p = payload || {}
  const issues = p.data?.issues || p.issues || []
  return {
    failed: true,
    issues: issues.length ? issues : [{ message: p.message || fallback }],
  }
}

function ClientTabs() {
  const { openVerify, openTopUp } = useDashboardUi()

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <AppBottomBar
          {...props}
          onFabPress={() => {
            if (props.state?.routes?.[props.state.index]?.name !== 'HomeTab') {
              props.navigation.navigate('HomeTab')
            }
            openVerify()
          }}
          onTopUpPress={openTopUp}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.parchment },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} />
      <Tab.Screen name="HistoryTab" component={HistoryScreen} />
    </Tab.Navigator>
  )
}

function MainWithModals() {
  const { t } = useLocale()
  const dispatch = useDispatch()
  const { topUpOpen, closeTopUp, setVerifyHandlers } = useDashboardUi()
  const { submitting: topUpSubmitting, error: topUpError } = useSelector((s) => s.balance)

  const handleCheckSubmit = async ({ screenshot, method, form, withDetails, matchMyAccount }) => {
    const result = await dispatch(performCheck({ screenshot, method, form, withDetails: false, matchMyAccount }))
    if (performCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successCheck(result)
    }
    return failureFrom(result.payload, t('result.couldNotVerify'))
  }

  const handleReferenceCheckSubmit = async ({ method, transactionCode, accountSuffix, matchMyAccount }) => {
    const result = await dispatch(
      performReferenceCheck({ method, transactionCode, accountSuffix, matchMyAccount }),
    )
    if (performReferenceCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successCheck(result)
    }
    return failureFrom(result.payload, t('check.paymentIdFailed'))
  }

  const handleSmsCheckSubmit = async ({ method, smsText, matchMyAccount }) => {
    const result = await dispatch(performSmsCheck({ method, smsText, matchMyAccount }))
    if (performSmsCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successCheck(result)
    }
    return failureFrom(result.payload, t('check.smsFailed'))
  }

  const handleTopUpSubmit = async ({ screenshot, method }) => {
    const result = await dispatch(submitTopUp({ screenshot, method }))
    if (submitTopUp.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return successTopUp(result)
    }
    return failureFrom(result.payload, t('topup.failed'))
  }

  const handleTopUpReferenceSubmit = async ({ method, transactionCode, accountSuffix }) => {
    const result = await dispatch(
      submitTopUpReference({ method, transactionCode, accountSuffix }),
    )
    if (submitTopUpReference.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return successTopUp(result)
    }
    return failureFrom(result.payload, t('topup.failed'))
  }

  const handleTopUpSmsSubmit = async ({ method, smsText }) => {
    const result = await dispatch(submitTopUpSms({ method, smsText }))
    if (submitTopUpSms.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return successTopUp(result)
    }
    return failureFrom(result.payload, t('topup.failed'))
  }

  useEffect(() => {
    setVerifyHandlers({
      onSubmit: handleCheckSubmit,
      onReferenceSubmit: handleReferenceCheckSubmit,
      onSmsSubmit: handleSmsCheckSubmit,
    })
  }, [setVerifyHandlers, t])

  return (
    <>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.parchment },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Tabs" component={ClientTabs} />
        <Stack.Screen name="DeveloperApi" component={DeveloperApiScreen} />
        <Stack.Screen name="MyAccounts" component={MyAccountsScreen} />
      </Stack.Navigator>

      <TopUpModal
        visible={topUpOpen}
        onClose={closeTopUp}
        onSubmit={handleTopUpSubmit}
        onReferenceSubmit={handleTopUpReferenceSubmit}
        onSmsSubmit={handleTopUpSmsSubmit}
        loading={topUpSubmitting}
        error={topUpError}
      />
    </>
  )
}

export default function MainTabs() {
  return (
    <DashboardUiProvider>
      <MainWithModals />
    </DashboardUiProvider>
  )
}
