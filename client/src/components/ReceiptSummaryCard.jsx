export default function ReceiptSummaryCard({ details = {}, title = 'Transaction Details' }) {
  const rows = [
    ['From', details.senderName, details.senderAccount],
    ['To', details.receiverName, details.receiverAccount],
    ['Amount', details.amount ? `${details.amount} ETB` : '—'],
    ['Payment ID', details.transactionCode],
  ]

  return (
    <div className="card p-4 space-y-3" style={{ background: 'var(--color-bg-subtle)' }}>
      <p className="font-semibold text-sm text-[var(--color-text-primary)]">{title}</p>
      <dl className="space-y-3">
        {rows.map(([label, primary, secondary]) => (
          <div key={label}>
            <dt className="text-[var(--text-xs)] font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</dt>
            <dd className="text-[var(--text-sm)] font-medium text-[var(--color-text-primary)] mt-0.5">{primary || '—'}</dd>
            {secondary && (
              <dd className="text-[var(--text-xs)] font-mono text-[var(--color-text-secondary)]">{secondary}</dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  )
}
