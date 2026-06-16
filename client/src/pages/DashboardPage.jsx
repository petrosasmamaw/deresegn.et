import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ReceiptText } from 'lucide-react'
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
    <main className="flex-1">
      <div className="container mx-auto py-8 md:py-12 max-w-6xl">
        <div className="mb-10">
          <p className="eyebrow mb-2">Services</p>
          <h1 className="page-title">Receipt Verification</h1>
          <p className="page-subtitle">Verify transaction receipts and manage your balance</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="md:col-span-2">
            <BalanceCard balance={balance} onTopUpClick={() => setTopupOpen(true)} />
          </div>

          <div className="card flex flex-col justify-between">
            <div>
              <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] uppercase font-medium mb-4">Verify Receipt</p>
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mb-4">
                Verify Telebirr or CBE Birr receipts. AI + QR checks compare your input, screenshot, and payment ID. Each check costs 5 units.
              </p>
            </div>
            <button
              onClick={() => setCheckerOpen(true)}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <ReceiptText size={18} />
              Start Verification
            </button>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="section-title">Verification History</h2>
              <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] mt-1">Your recent receipt verifications</p>
            </div>
            <button
              onClick={() => dispatch(fetchCheckHistory())}
              className="btn-secondary"
            >
              Refresh
            </button>
          </div>

          <CheckHistory checks={checks} loading={checksLoading} />
        </div>
      </div>

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
