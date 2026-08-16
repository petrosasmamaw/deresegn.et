import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { TrendingUp } from 'lucide-react'
import { fetchBalance, submitTopUp, submitTopUpReference, submitTopUpSms } from '../features/balance/balanceSlice'
import { fetchCheckHistory, performCheck, performReferenceCheck, performSmsCheck } from '../features/checks/checksSlice'
import BalanceCard from '../components/BalanceCard'
import BottomNav from '../components/BottomNav'
import TopUpModal from '../components/TopUpModal'
import CheckerModal from '../components/CheckerModal'
import CheckHistory from '../components/CheckHistory'
import BirrVerifyHero from '../components/BirrVerifyHero'
import OnboardingModal from '../components/OnboardingModal'
import { useDashboardUi } from '../context/DashboardUiContext'
import { useLocale } from '../i18n/LocaleContext'

function scrollToVerify() {
  document.getElementById('verify-desk')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { t } = useLocale()
  const { current: balance, submitting: topupLoading, error: balanceError } = useSelector(s => s.balance)
  const { list: checks, loading: checksLoading, submitting: checkLoading, error: checkError, lastCheck, lastResolvedDetails } = useSelector(s => s.checks)
  const { topupOpen, setTopupOpen, setCheckerOpen } = useDashboardUi()
  const [mobileTab, setMobileTab] = useState('home')
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchBalance())
    dispatch(fetchCheckHistory())

    if (!localStorage.getItem('deresegn_onboarding_seen')) {
      setOnboardingOpen(true)
    }
  }, [dispatch])

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
    <section className="dash-history">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h2 className="section-title flex items-center gap-2">
            <TrendingUp size={20} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} className="shrink-0" />
            {t('dash.historyTitle')}
          </h2>
          <p className="section-lead mb-0">{t('dash.historySubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => dispatch(fetchCheckHistory())}
          className="btn-secondary text-sm shrink-0"
        >
          {t('common.refresh')}
        </button>
      </div>
      <div className="card overflow-hidden">
        <CheckHistory checks={checks} loading={checksLoading} />
      </div>
    </section>
  )

  return (
    <main className="flex-1 page-parchment">
      <div className={mobileTab === 'history' ? 'hidden md:block' : undefined}>
        <BirrVerifyHero />
      </div>

      <div className={mobileTab === 'history' ? 'hidden md:block dash-shell' : 'dash-shell'}>
        <div className="dash-stage">
          {verifyPanel}
          <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />
        </div>
        <div className="hidden md:block">
          {historySection}
        </div>
      </div>

      {mobileTab === 'history' && (
        <div className="md:hidden dash-shell">
          <header className="mobile-page-header">
            <h1 className="mobile-page-title">{t('dash.mobileHistory')}</h1>
            <p className="mobile-page-subtitle">{t('dash.mobileHistorySub')}</p>
          </header>
          <CheckHistory checks={checks} loading={checksLoading} />
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

      <BottomNav
        activeTab={mobileTab}
        onTabChange={setMobileTab}
        onFabClick={goVerify}
        onTopUpClick={() => setTopupOpen(true)}
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
