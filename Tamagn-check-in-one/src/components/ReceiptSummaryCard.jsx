import { useLocale } from '../i18n/LocaleContext'

export default function ReceiptSummaryCard({ details = {}, title }) {
  const { t } = useLocale()
  const heading = title ?? t('field.transactionDetails')
  const rows = [
    [t('field.from'), details.senderName, details.senderAccount],
    [t('field.to'), details.receiverName, details.receiverAccount],
    [t('field.amountShort'), details.amount ? `${details.amount} ETB` : '—'],
    [t('field.paymentId'), details.transactionCode],
  ]

  return (
    <div className="receipt-card">
      <div className="receipt-card-header">{heading}</div>
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
