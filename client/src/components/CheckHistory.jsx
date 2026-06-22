import { CheckCircle2, Clock } from 'lucide-react'
import EmptyState from './EmptyState'

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
}

const BANK_BADGE_CLASS = {
  telebirr: 'bank-badge-telebirr',
  cbe: 'bank-badge-cbe',
  boa: 'bank-badge-boa',
  dashen: 'bank-badge-dashen',
}

function BankBadge({ method }) {
  const label = METHOD_LABELS[method] || method
  const badgeClass = BANK_BADGE_CLASS[method] || 'bank-badge-cbe'
  return <span className={`bank-badge ${badgeClass}`}>{label}</span>
}

export default function CheckHistory({ checks = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: '60px' }} />)}
      </div>
    )
  }

  if (checks.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No verifications yet"
        description="Verify receipt scans to see them appear here. Cost varies: 2-20 Birr per check based on amount."
      />
    )
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto rounded-lg border" style={{ borderColor: 'rgba(14, 36, 32, 0.12)' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Payment ID</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr key={check.id}>
                <td className="font-mono text-[var(--text-sm)]">
                  {new Date(check.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td>
                  <BankBadge method={check.paymentMethod} />
                </td>
                <td className="tx-mono">{check.transactionCode}</td>
                <td className="amount-mono">{check.amount} ETB</td>
                <td>
                  <span className="badge badge-success inline-flex items-center gap-1">
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                    Verified
                  </span>
                </td>
                <td className="font-mono font-medium text-[var(--color-text-secondary)]">−{check.balanceDeducted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {checks.map((check) => (
          <div key={check.id} className="card space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="receipt-label mb-1">Receipt Verification</p>
                <p className="font-mono text-sm">
                  {new Date(check.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span className="badge badge-success inline-flex items-center gap-1">
                <CheckCircle2 size={12} strokeWidth={2.5} />
                Verified
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 border-t border-b" style={{ borderColor: 'rgba(14, 36, 32, 0.08)' }}>
              <div>
                <p className="receipt-label">Method</p>
                <BankBadge method={check.paymentMethod} />
              </div>
              <div>
                <p className="receipt-label">Amount</p>
                <p className="amount-mono text-sm">{check.amount} ETB</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="tx-mono">{check.transactionCode}</p>
              <p className="font-mono font-medium text-sm text-[var(--color-text-secondary)]">−{check.balanceDeducted}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
