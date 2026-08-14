import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CheckCircle2, TrendingUp, KeyRound, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
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

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { t } = useLocale()
  const { current: balance, submitting: topupLoading, error: balanceError } = useSelector(s => s.balance)
  const { list: checks, loading: checksLoading, submitting: checkLoading, error: checkError, lastCheck, lastResolvedDetails } = useSelector(s => s.checks)
  const { topupOpen, setTopupOpen, checkerOpen, setCheckerOpen, openVerify } = useDashboardUi()
  const [mobileTab, setMobileTab] = useState('home')
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  useEffect(() => {
    dispatch(fetchBalance())
    dispatch(fetchCheckHistory())

    if (!localStorage.getItem('deresegn_onboarding_seen')) {
      setOnboardingOpen(true)
    }
  }, [dispatch])

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

  return (
    <main className="flex-1 page-parchment">
      {/* Unified dashboard hero — desktop */}
      <div className="hidden md:block">
        <BirrVerifyHero onVerifyClick={openVerify} />
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:block container mx-auto py-8 max-w-6xl px-4">
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2 min-w-0">
            <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />
          </div>

          <aside className="min-w-0 flex flex-col justify-center gap-3 px-1">
            <h2 className="section-title" style={{ color: 'var(--color-birr-green)' }}>
              {t('dash.quickAction')}
            </h2>
            <p className="section-lead mb-1">
              {t('dash.quickActionDesc')}
            </p>
            <button
              onClick={() => setCheckerOpen(true)}
              className="btn-primary w-full flex items-center justify-center gap-2 min-h-11"
            >
              <CheckCircle2 size={18} strokeWidth={2} />
              {t('dash.verifyReceipt')}
            </button>
            <Link
              to="/accounts"
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm min-h-11"
            >
              <Wallet size={16} strokeWidth={2} />
              {t('nav.myAccounts')}
            </Link>
            <Link
              to="/developer"
              className="btn-secondary w-full flex items-center justify-center gap-2 text-sm min-h-11"
            >
              <KeyRound size={16} strokeWidth={2} />
              {t('nav.getApi')}
            </Link>
          </aside>
        </div>

        {/* History Section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
            <div className="min-w-0">
              <h2 className="section-title flex items-center gap-2">
                <TrendingUp size={20} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} className="shrink-0" />
                {t('dash.historyTitle')}
              </h2>
              <p className="section-lead mb-0">{t('dash.historySubtitle')}</p>
            </div>
            <button
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
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {mobileTab === 'home' && <BirrVerifyHero onVerifyClick={openVerify} />}

        <div className="mobile-shell">
        {mobileTab === 'history' && (
        <header className="mobile-page-header">
          <h1 className="mobile-page-title">{t('dash.mobileHistory')}</h1>
          <p className="mobile-page-subtitle">{t('dash.mobileHistorySub')}</p>
        </header>
        )}

        {mobileTab === 'home' ? (
          <div className="flex-1 mobile-stack pb-2">
            <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />

            <div className="px-0.5">
              <Link to="/developer" className="btn-secondary w-full text-sm flex items-center justify-center gap-2 min-h-11">
                <KeyRound size={15} /> {t('nav.getApi')}
              </Link>
            </div>

            {lastCheck && (
              <div className="stat-card">
                <p className="meta-label mb-3">{t('dash.lastVerification')}</p>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">{t('common.amount')}</span>
                    <span className="amount-mono text-[15px]">{lastCheck.amount} ETB</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">{t('common.status')}</span>
                    <span className="badge badge-success inline-flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      {t('common.verified')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">{t('common.cost')}</span>
                    <span className="font-mono text-[14px] font-medium" style={{ color: 'var(--color-maroon)' }}>−{lastCheck.balanceDeducted}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 mobile-stack pb-2">
            <CheckHistory checks={checks} loading={checksLoading} />
          </div>
        )}
        </div>
      </div>

      {/* Modals */}
      <TopUpModal
        isOpen={topupOpen}
        onClose={() => setTopupOpen(false)}
        onSubmit={handleTopUpSubmit}
        onReferenceSubmit={handleTopUpReferenceSubmit}
        onSmsSubmit={handleTopUpSmsSubmit}
        loading={topupLoading}
        error={balanceError}
      />

      <CheckerModal
        isOpen={checkerOpen}
        onClose={() => setCheckerOpen(false)}
        onSubmit={handleCheckSubmit}
        onReferenceSubmit={handleReferenceCheckSubmit}
        onSmsSubmit={handleSmsCheckSubmit}
        loading={checkLoading}
        error={checkError}
        lastResult={lastCheck}
        lastResolvedDetails={lastResolvedDetails}
      />

      {/* Mobile Bottom Navigation with FAB */}
      <BottomNav activeTab={mobileTab} onTabChange={setMobileTab} onFabClick={() => setCheckerOpen(true)} />

      <OnboardingModal
        isOpen={onboardingOpen}
        onClose={closeOnboarding}
        onTopUp={() => { closeOnboarding(); setTopupOpen(true) }}
        onVerify={() => { closeOnboarding(); openVerify() }}
      />
    </main>
  )
}
