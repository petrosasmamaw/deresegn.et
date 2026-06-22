export default function ReceiptSummaryCard({ details = {}, title = 'Transaction Details' }) {
  const rows = [
    ['From', details.senderName, details.senderAccount],
    ['To', details.receiverName, details.receiverAccount],
    ['Amount', details.amount ? `${details.amount} ETB` : '—'],
    ['Payment ID', details.transactionCode],
  ]

  return (
    <div className="receipt-card">
      <div className="receipt-card-header">{title}</div>
      <div className="receipt-card-body">
        {rows.map(([label, primary, secondary]) => (
          <div key={label} className="receipt-card-row">
            <span className="receipt-label">{label}</span>
            <span className="receipt-value">{primary || '—'}</span>
            {secondary && (
              <span className="receipt-value-secondary">{secondary}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
