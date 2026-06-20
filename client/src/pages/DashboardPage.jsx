import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CheckCircle2, Zap, TrendingUp, ChevronLeft } from 'lucide-react'
import { fetchBalance, submitTopUp } from '../features/balance/balanceSlice'
import { fetchCheckHistory, performCheck, performReferenceCheck } from '../features/checks/checksSlice'
import BalanceCard from '../components/BalanceCard'
import BottomNav from '../components/BottomNav'
import TopUpModal from '../components/TopUpModal'
import CheckerModal from '../components/CheckerModal'
import CheckHistory from '../components/CheckHistory'

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { current: balance, submitting: topupLoading, error: balanceError } = useSelector(s => s.balance)
  const { list: checks, loading: checksLoading, submitting: checkLoading, error: checkError, lastCheck, lastResolvedDetails } = useSelector(s => s.checks)
  const [topupOpen, setTopupOpen] = useState(false)
  const [checkerOpen, setCheckerOpen] = useState(false)
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

  return (
    <main className="flex-1" style={{ background: 'linear-gradient(180deg, var(--color-bg-base) 0%, var(--color-bg-subtle) 100%)' }}>
      {/* Desktop Layout */}
      <div className="hidden md:block container mx-auto py-8 md:py-12 max-w-6xl">
        {/* Page Header */}
        <div className="mb-12">
          <p className="eyebrow mb-3">Dashboard</p>
          <h1 className="page-title mb-2">Receipt Verification</h1>
          <p className="page-subtitle">Manage your balance and verify transaction receipts</p>
        </div>

        {/* Primary Grid: Balance + Verification */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {/* Balance Card (Hero - Spans 2 cols) */}
          <div className="md:col-span-2">
            <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />
          </div>

          {/* Quick Actions Card */}
          <div className="card flex flex-col justify-between" style={{ background: `linear-gradient(135deg, var(--color-accent-muted) 0%, rgba(245, 158, 11, 0.08) 100%)`, borderColor: 'var(--color-accent-border)', borderWidth: '2px' }}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap size={18} style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
                <p className="font-display font-bold text-sm" style={{ color: 'var(--color-accent)' }}>Quick Action</p>
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
      <div className="md:hidden flex flex-col min-h-screen px-4 pt-6">
        {/* Mobile Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            {mobileTab === 'home' ? 'Balance & Verify' : 'History'}
          </h1>
        </div>

        {/* Mobile Content Tabs */}
        {mobileTab === 'home' ? (
          <div className="flex-1 space-y-4">
            {/* Balance Card */}
            <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />

            {/* Quick Verify Card */}
            <div className="card flex flex-col gap-4" style={{ background: `linear-gradient(135deg, var(--color-accent-muted) 0%, rgba(245, 158, 11, 0.08) 100%)`, borderColor: 'var(--color-accent-border)', borderWidth: '2px' }}>
              <div className="flex items-center gap-2">
                <Zap size={16} style={{ color: 'var(--color-accent)' }} strokeWidth={2} />
                <p className="font-bold text-sm" style={{ color: 'var(--color-accent)' }}>Quick Verify</p>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                Tap the + button below to verify. Use screenshot + QR or payment ID only (no image).
              </p>
            </div>

            {/* Last Check Summary */}
            {lastCheck && (
              <div className="card border-l-4" style={{ borderLeftColor: 'var(--color-primary)' }}>
                <p className="text-xs text-[var(--color-text-secondary)] uppercase font-semibold mb-2">Last Verification</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--color-text-secondary)]">Amount:</span>
                    <span className="font-mono font-bold">{lastCheck.amount} ETB</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--color-text-secondary)]">Status:</span>
                    <span className="badge badge-success inline-flex items-center gap-1 text-xs">
                      <CheckCircle2 size={12} />
                      Verified
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-[var(--color-text-secondary)]">Cost:</span>
                    <span className="font-mono font-bold text-[var(--color-error)]">−{lastCheck.balanceDeducted}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1">
            <div className="space-y-3">
              <CheckHistory checks={checks} loading={checksLoading} />
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <TopUpModal
        isOpen={topupOpen}
        onClose={() => setTopupOpen(false)}
        onSubmit={handleTopUpSubmit}
        loading={topupLoading}
        error={balanceError}
      />

      <CheckerModal
        isOpen={checkerOpen}
        onClose={() => setCheckerOpen(false)}
        onSubmit={handleCheckSubmit}
        onReferenceSubmit={handleReferenceCheckSubmit}
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
