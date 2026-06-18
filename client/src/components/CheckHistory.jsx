import { CheckCircle2, Clock } from 'lucide-react'
import EmptyState from './EmptyState'

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE Birr',
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
        description="Verify receipt scans to see them appear here. Each check costs 5 Birr."
      />
    )
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr style={{ background: 'var(--color-bg-subtle)' }}>
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
              <tr key={check.id} style={{ borderBottomColor: 'var(--color-border)' }}>
                <td className="font-mono text-[var(--text-sm)] font-medium">
                  {new Date(check.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="font-medium text-[var(--text-sm)]">{METHOD_LABELS[check.paymentMethod] || check.paymentMethod}</td>
                <td className="font-mono text-[var(--text-sm)] text-[var(--color-text-secondary)]">{check.transactionCode}</td>
                <td className="font-mono font-semibold">{check.amount} ETB</td>
                <td>
                  <div className="badge badge-success inline-flex items-center gap-2">
                    <CheckCircle2 size={14} strokeWidth={2.5} />
                    Verified
                  </div>
                </td>
                <td className="font-mono font-bold text-[var(--color-text-secondary)]">−{check.balanceDeducted}</td>
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
                <p className="text-xs text-[var(--color-text-secondary)] uppercase font-semibold mb-1">Receipt Verification</p>
                <p className="font-mono text-sm font-medium">
                  {new Date(check.createdAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="badge badge-success inline-flex items-center gap-1 text-xs">
                <CheckCircle2 size={12} strokeWidth={2.5} />
                Verified
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 border-t border-b border-[var(--color-border)]">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Method</p>
                <p className="text-sm font-medium">{METHOD_LABELS[check.paymentMethod] || check.paymentMethod}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-1">Amount</p>
                <p className="font-mono font-semibold text-sm">{check.amount} ETB</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">{check.transactionCode}</p>
              </div>
              <div>
                <p className="font-mono font-bold text-sm text-[var(--color-error)]">−{check.balanceDeducted}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
