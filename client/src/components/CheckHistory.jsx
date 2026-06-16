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
        description="Verify receipt scans to see them appear here. Each check costs 5 units."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
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
  )
}
