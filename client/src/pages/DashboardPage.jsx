import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { fetchBalance, submitTopUp, submitTopUpReference, submitTopUpSms } from '../features/balance/balanceSlice'
import { fetchCheckHistory, performCheck, performReferenceCheck, performSmsCheck } from '../features/checks/checksSlice'
import BalanceCard from '../components/BalanceCard'
import TopUpModal from '../components/TopUpModal'
import CheckerModal from '../components/CheckerModal'
import CheckHistory from '../components/CheckHistory'
import OnboardingModal from '../components/OnboardingModal'
import { useDashboardUi } from '../context/DashboardUiContext'
import { useLocale } from '../i18n/LocaleContext'
import { useToast } from '../components/Toast'

function scrollToVerify() {
  document.getElementById('verify-desk')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { t } = useLocale()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const { current: balance, submitting: topupLoading, error: balanceError, loadError: balanceLoadError } = useSelector(s => s.balance)
  const { list: checks, loading: checksLoading, submitting: checkLoading, error: checkError, loadError: historyLoadError, lastCheck, lastResolvedDetails } = useSelector(s => s.checks)
  const { topupOpen, setTopupOpen, setCheckerOpen, mobileTab, setMobileTab } = useDashboardUi()
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'history') {
      setMobileTab('history')
    } else if (tabParam === 'verify' || tabParam === 'home') {
      setMobileTab('home')
    }
  }, [searchParams, setMobileTab])

  useEffect(() => {
    dispatch(fetchBalance())
    dispatch(fetchCheckHistory())

    if (!localStorage.getItem('deresegn_onboarding_seen')) {
      setOnboardingOpen(true)
    }
  }, [dispatch])

  // Surface background read-path failures (previously silent) as toasts.
  useEffect(() => {
    if (balanceLoadError) toast.error(t('errors.loadBalance'))
  }, [balanceLoadError, toast, t])

  useEffect(() => {
    if (historyLoadError) toast.error(t('errors.loadHistory'))
  }, [historyLoadError, toast, t])

  useEffect(() => {
    setCheckerOpen(false)
  }, [setCheckerOpen])

  const closeOnboarding = () => {
    localStorage.setItem('deresegn_onboarding_seen', '1')
    setOnboardingOpen(false)
  }

  const successPayload = (result) => ({
    success: true,
    resolvedDetails: result.payload.resolvedDetails,
    check: {
      ...(result.payload.check || {}),
      previousVerification:
        result.payload.check?.previousVerification || result.payload.previousVerification || null,
    },
    isRecheck: result.payload.isRecheck,
  })

  const handleTopUpSubmit = async ({ screenshot, method }) => {
    const result = await dispatch(submitTopUp({ screenshot, method }))
    if (submitTopUp.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return {
        success: true,
        resolvedDetails: result.payload.resolvedDetails,
      }
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length ? issues : [{ message: payload.message || 'Top-up could not be verified' }],
    }
  }

  const handleTopUpReferenceSubmit = async ({ method, transactionCode, accountSuffix }) => {
    const result = await dispatch(submitTopUpReference({ method, transactionCode, accountSuffix }))
    if (submitTopUpReference.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return {
        success: true,
        resolvedDetails: result.payload.resolvedDetails,
      }
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length ? issues : [{ message: payload.message || 'Top-up could not be verified' }],
    }
  }

  const handleTopUpSmsSubmit = async ({ method, smsText }) => {
    const result = await dispatch(submitTopUpSms({ method, smsText }))
    if (submitTopUpSms.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return {
        success: true,
        resolvedDetails: result.payload.resolvedDetails,
      }
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length ? issues : [{ message: payload.message || 'Top-up could not be verified' }],
    }
  }

  const handleCheckSubmit = async ({ screenshot, method, form, withDetails, matchMyAccount }) => {
    const result = await dispatch(performCheck({ screenshot, method, form, withDetails: false, matchMyAccount }))
    if (performCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successPayload(result)
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length
        ? issues
        : [{ message: payload.message || 'Receipt could not be verified' }],
    }
  }

  const handleReferenceCheckSubmit = async ({ method, transactionCode, accountSuffix, matchMyAccount }) => {
    const result = await dispatch(performReferenceCheck({ method, transactionCode, accountSuffix, matchMyAccount }))
    if (performReferenceCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successPayload(result)
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length
        ? issues
        : [{ message: payload.message || 'Payment ID could not be verified' }],
    }
  }

  const handleSmsCheckSubmit = async ({ method, smsText, matchMyAccount }) => {
    const result = await dispatch(performSmsCheck({ method, smsText, matchMyAccount }))
    if (performSmsCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return successPayload(result)
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length
        ? issues
        : [{ message: payload.message || 'SMS could not be verified' }],
    }
  }

  const goVerify = () => {
    setMobileTab('home')
    window.setTimeout(scrollToVerify, 50)
  }

  const verifyPanel = (
    <CheckerModal
      embedded
      isOpen
      onClose={() => {}}
      onSubmit={handleCheckSubmit}
      onReferenceSubmit={handleReferenceCheckSubmit}
      onSmsSubmit={handleSmsCheckSubmit}
      loading={checkLoading}
      error={checkError}
      lastResult={lastCheck}
      lastResolvedDetails={lastResolvedDetails}
    />
  )

  const historySection = (
    <section className="dash-history mt-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={20} className="text-[#C6A24E] shrink-0" strokeWidth={2.2} />
            <h2 className="text-xl sm:text-2xl font-black text-[#091A16] tracking-tight">
              {t('dash.historyTitle') || 'Verification History'}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[#40564C] font-medium leading-relaxed">
            {t('dash.historySubtitle') || 'Official cryptographic audit ledger of checked Ethiopian bank payments & receipts.'}
          </p>
        </div>
      </div>
      <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] overflow-hidden shadow-sm">
        <CheckHistory
          checks={checks}
          loading={checksLoading}
          error={historyLoadError}
          onRetry={() => dispatch(fetchCheckHistory())}
        />
      </div>
    </section>
  )

  return (
    <main className="flex-1 landing-content-canvas min-h-screen relative overflow-x-hidden pt-6 sm:pt-10 pb-20">
      {/* Soft ambient light glows matching landing page aesthetics */}
      <div className="absolute top-10 -left-20 w-96 h-96 bg-[#1B463A]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -right-20 w-96 h-96 bg-[#C6A24E]/8 rounded-full blur-3xl pointer-events-none" />

      <div className={mobileTab === 'history' ? 'hidden md:block dash-shell relative z-10' : 'dash-shell relative z-10'}>
        <div className="dash-stage space-y-6 max-w-xl sm:max-w-2xl mx-auto pt-4 sm:pt-6">
          {verifyPanel}
          <BalanceCard balance={balance} error={balanceLoadError} onTopUpClick={() => setTopupOpen(true)} />
        </div>
        <div className="hidden md:block mt-8 max-w-xl sm:max-w-2xl mx-auto">
          {historySection}
        </div>
      </div>

      {mobileTab === 'history' && (
        <div className="md:hidden dash-shell">
          <header className="mobile-page-header">
            <h1 className="mobile-page-title">{t('dash.mobileHistory')}</h1>
            <p className="mobile-page-subtitle">{t('dash.mobileHistorySub')}</p>
          </header>
          <CheckHistory
            checks={checks}
            loading={checksLoading}
            error={historyLoadError}
            onRetry={() => dispatch(fetchCheckHistory())}
          />
        </div>
      )}

      <TopUpModal
        isOpen={topupOpen}
        onClose={() => setTopupOpen(false)}
        onSubmit={handleTopUpSubmit}
        onReferenceSubmit={handleTopUpReferenceSubmit}
        onSmsSubmit={handleTopUpSmsSubmit}
        loading={topupLoading}
        error={balanceError}
      />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={closeOnboarding}
        onTopUp={() => { closeOnboarding(); setTopupOpen(true) }}
        onVerify={() => { closeOnboarding(); goVerify() }}
      />
    </main>
  )
}
