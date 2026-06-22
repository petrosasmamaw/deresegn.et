const RECEIPT_IMAGES = {
  telebirr: '/telebirr.jpg',
  cbe: '/cbe.jpg',
  boa: '/boa.jpg',
  dashen: '/dashen.jpg',
}

const BANK_BADGE_CLASS = {
  telebirr: 'bank-badge-telebirr',
  cbe: 'bank-badge-cbe',
  boa: 'bank-badge-boa',
  dashen: 'bank-badge-dashen',
}

const BANK_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
}

export default function ReceiptFormatExample({ method }) {
  if (!method || !RECEIPT_IMAGES[method]) return null

  const imageSrc = RECEIPT_IMAGES[method]
  const label = BANK_LABELS[method] || method
  const badgeClass = BANK_BADGE_CLASS[method] || 'bank-badge-cbe'

  return (
    <aside className="receipt-example-panel" aria-label="Example receipt format">
      <p className="receipt-example-label">Receipt format guide</p>
      <p className="receipt-example-hint">
        Your screenshot should look like this example — include the full receipt with QR code visible.
      </p>
      <div className="receipt-example-frame">
        <img
          src={imageSrc}
          alt={`${label} receipt example`}
          className="receipt-example-image"
        />
      </div>
      <span className={`bank-badge receipt-example-badge ${badgeClass}`}>{label}</span>
    </aside>
  )
}

export { RECEIPT_IMAGES }
