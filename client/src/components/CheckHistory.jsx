import { CheckCircle2 } from 'lucide-react'
import EmptyState from './EmptyState'

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE Birr',
}

export default function CheckHistory({ checks = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" />)}
      </div>
    )
  }

  if (checks.length === 0) {
    return (
      <EmptyState
        icon={null}
        title="No verifications yet"
        description="Only successful receipt checks are saved here. Each verification costs 5 units."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
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
              <td>{METHOD_LABELS[check.paymentMethod] || check.paymentMethod}</td>
              <td className="font-mono text-[var(--text-sm)]">{check.transactionCode}</td>
              <td className="font-mono">{check.amount} ETB</td>
              <td>
                <div className="badge badge-success flex items-center gap-2">
                  <CheckCircle2 size={12} />
                  Verified
                </div>
              </td>
              <td className="font-mono font-medium">−{check.balanceDeducted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
