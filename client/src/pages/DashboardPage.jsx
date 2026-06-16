import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CheckCircle2, Zap, TrendingUp } from 'lucide-react'
import { fetchBalance, submitTopUp } from '../features/balance/balanceSlice'
import { fetchCheckHistory, performCheck } from '../features/checks/checksSlice'
import BalanceCard from '../components/BalanceCard'
import TopUpModal from '../components/TopUpModal'
import CheckerModal from '../components/CheckerModal'
import CheckHistory from '../components/CheckHistory'

export default function DashboardPage() {
  const dispatch = useDispatch()
  const { current: balance, submitting: topupLoading, error: balanceError } = useSelector(s => s.balance)
  const { list: checks, loading: checksLoading, submitting: checkLoading, error: checkError, lastCheck } = useSelector(s => s.checks)
  const [topupOpen, setTopupOpen] = useState(false)
  const [checkerOpen, setCheckerOpen] = useState(false)

  useEffect(() => {
    dispatch(fetchBalance())
    dispatch(fetchCheckHistory())
  }, [dispatch])

  const handleTopUpSubmit = async ({ screenshot, form, method }) => {
    const result = await dispatch(submitTopUp({ screenshot, form, method }))
    if (submitTopUp.fulfilled.match(result)) {
      setTopupOpen(false)
      dispatch(fetchBalance())
    }
  }

  const handleCheckSubmit = async ({ screenshot, method, form }) => {
    const result = await dispatch(performCheck({ screenshot, method, form }))
    if (performCheck.fulfilled.match(result)) {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory())
      return { success: true }
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

  return (
    <main className="flex-1" style={{ background: 'linear-gradient(180deg, var(--color-bg-base) 0%, var(--color-bg-subtle) 100%)' }}>
      <div className="container mx-auto py-8 md:py-12 max-w-6xl">
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
                Upload a receipt to verify its authenticity. QR code + form comparison. Each verification costs 5 units.
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
        loading={checkLoading}
        error={checkError}
        lastResult={lastCheck}
      />
    </main>
  )
}
