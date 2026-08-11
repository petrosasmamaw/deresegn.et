import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useDispatch, useSelector } from 'react-redux'
import { DashboardUiProvider, useDashboardUi } from '../context/DashboardUiContext'
import AppBottomBar from '../components/AppBottomBar'
import CheckerModal from '../components/CheckerModal'
import TopUpModal from '../components/TopUpModal'
import HomeScreen from '../screens/HomeScreen'
import HistoryScreen from '../screens/HistoryScreen'
import DeveloperApiScreen from '../screens/DeveloperApiScreen'
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
  const { check, resolvedDetails } = result.payload
  return {
    success: true,
    resolvedDetails,
    check: {
      ...check,
      previousVerification: check?.previousVerification || null,
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
  const { openVerify } = useDashboardUi()

  return (
    <Tab.Navigator
      tabBar={(props) => <AppBottomBar {...props} onFabPress={openVerify} />}
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
  const { verifyOpen, closeVerify, topUpOpen, closeTopUp } = useDashboardUi()
  const {
    submitting: checkSubmitting,
    error: checkError,
    lastCheck,
    lastResolvedDetails,
  } = useSelector((s) => s.checks)
  const { submitting: topUpSubmitting, error: topUpError } = useSelector((s) => s.balance)

  const handleCheckSubmit = async ({ screenshot, method, form, withDetails }) => {
    const result = await dispatch(performCheck({ screenshot, method, form, withDetails }))
    if (performCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successCheck(result)
    }
    return failureFrom(result.payload, t('result.couldNotVerify'))
  }

  const handleReferenceCheckSubmit = async ({ method, transactionCode, accountSuffix }) => {
    const result = await dispatch(
      performReferenceCheck({ method, transactionCode, accountSuffix }),
    )
    if (performReferenceCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successCheck(result)
    }
    return failureFrom(result.payload, 'Payment ID could not be verified')
  }

  const handleSmsCheckSubmit = async ({ method, smsText }) => {
    const result = await dispatch(performSmsCheck({ method, smsText }))
    if (performSmsCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successCheck(result)
    }
    return failureFrom(result.payload, 'SMS could not be verified')
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
      </Stack.Navigator>

      <CheckerModal
        visible={verifyOpen}
        onClose={closeVerify}
        onSubmit={handleCheckSubmit}
        onReferenceSubmit={handleReferenceCheckSubmit}
        onSmsSubmit={handleSmsCheckSubmit}
        loading={checkSubmitting}
        error={checkError}
        lastResult={lastCheck}
        lastResolvedDetails={lastResolvedDetails}
      />
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
