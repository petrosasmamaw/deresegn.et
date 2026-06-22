import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CheckCircle2, Zap, TrendingUp, ChevronLeft } from 'lucide-react'
import { fetchBalance, submitTopUp, submitTopUpReference, submitTopUpSms } from '../features/balance/balanceSlice'
import { fetchCheckHistory, performCheck, performReferenceCheck, performSmsCheck } from '../features/checks/checksSlice'
import BalanceCard from '../components/BalanceCard'
import BottomNav from '../components/BottomNav'
import TopUpModal from '../components/TopUpModal'
import CheckerModal from '../components/CheckerModal'
import CheckHistory from '../components/CheckHistory'
import BirrVerifyHero from '../components/BirrVerifyHero'
import { useDashboardUi } from '../context/DashboardUiContext'

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { current: balance, submitting: topupLoading, error: balanceError } = useSelector(s => s.balance)
  const { list: checks, loading: checksLoading, submitting: checkLoading, error: checkError, lastCheck, lastResolvedDetails } = useSelector(s => s.checks)
  const { topupOpen, setTopupOpen, checkerOpen, setCheckerOpen, openVerify } = useDashboardUi()
  const [mobileTab, setMobileTab] = useState('home')

  useEffect(() => {
    dispatch(fetchBalance())
    dispatch(fetchCheckHistory())
  }, [dispatch])

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

  const handleCheckSubmit = async ({ screenshot, method, form, withDetails }) => {
    const result = await dispatch(performCheck({ screenshot, method, form, withDetails }))
    if (performCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return {
        success: true,
        resolvedDetails: result.payload.resolvedDetails,
      }
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

  const handleReferenceCheckSubmit = async ({ method, transactionCode, accountSuffix }) => {
    const result = await dispatch(performReferenceCheck({ method, transactionCode, accountSuffix }))
    if (performReferenceCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return {
        success: true,
        resolvedDetails: result.payload.resolvedDetails,
      }
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

  const handleSmsCheckSubmit = async ({ method, smsText }) => {
    const result = await dispatch(performSmsCheck({ method, smsText }))
    if (performSmsCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return {
        success: true,
        resolvedDetails: result.payload.resolvedDetails,
      }
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
      <div className="hidden md:block container mx-auto py-8 max-w-6xl">
        {/* Primary Grid: Balance + Verification */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {/* Balance Card (Hero - Spans 2 cols) */}
          <div className="md:col-span-2">
            <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />
          </div>

          {/* Quick Actions Card */}
          <div className="action-card flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={18} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
                <p className="font-display font-bold text-sm" style={{ color: 'var(--color-foil-gold)' }}>Quick Action</p>
              </div>
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                Verify with a receipt screenshot + QR, or enter the payment ID only (Invoice / FT / IPSS).
              </p>
            </div>
            <button
              onClick={() => setCheckerOpen(true)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} strokeWidth={2} />
              Verify Receipt
            </button>
          </div>
        </div>

        {/* History Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-title flex items-center gap-2">
                <TrendingUp size={20} style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
                Verification History
              </h2>
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-2">Your recent receipt verifications</p>
            </div>
            <button
              onClick={() => dispatch(fetchCheckHistory())}
              className="btn-secondary text-sm"
            >
              Refresh
            </button>
          </div>

          <CheckHistory checks={checks} loading={checksLoading} />
        </div>
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden">
        {mobileTab === 'home' && <BirrVerifyHero onVerifyClick={openVerify} />}

        <div className="mobile-shell">
        {mobileTab === 'history' && (
        <header className="mobile-page-header">
          <h1 className="mobile-page-title">History</h1>
          <p className="mobile-page-subtitle">Your recent verifications</p>
        </header>
        )}

        {mobileTab === 'home' ? (
          <div className="flex-1 mobile-stack pb-2">
            <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />

            <div className="action-card flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Zap size={15} style={{ color: 'var(--color-foil-gold)' }} strokeWidth={2} />
                <p className="font-display font-semibold text-[13px]" style={{ color: 'var(--color-foil-gold)' }}>Quick Verify</p>
              </div>
              <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                Tap the + button below to verify. Use screenshot + QR or payment ID only (no image).
              </p>
            </div>

            {lastCheck && (
              <div className="stat-card">
                <p className="receipt-label mb-3">Last Verification</p>
                <div className="space-y-2.5">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">Amount</span>
                    <span className="amount-mono text-[15px]">{lastCheck.amount} ETB</span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">Status</span>
                    <span className="badge badge-success inline-flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      Verified
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-[13px] text-[var(--color-text-secondary)]">Cost</span>
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
    </main>
  )
}
