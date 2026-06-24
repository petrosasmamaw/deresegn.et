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

const PAYMENT_ID_TEMPLATES = {
  telebirr: {
    title: 'Payment ID format',
    hint: 'Enter the 10-character Invoice No. from your Telebirr receipt.',
    lines: [
      { label: 'Field', value: 'Invoice No.' },
      { label: 'Example', value: 'DF52MV8ILW' },
      { label: 'Format', value: '10 uppercase letters & digits' },
    ],
  },
  cbe: {
    title: 'Payment ID format',
    hint: 'Enter the FT reference and the last 8 digits of the sender account.',
    lines: [
      { label: 'FT Reference', value: 'FT26169D8C5M' },
      { label: 'Sender account (last 8)', value: '12345678' },
      { label: 'Format', value: 'FT + 12 chars · 8 digits' },
    ],
  },
  boa: {
    title: 'Payment ID format',
    hint: 'Enter the FT reference and the last 5 digits of the sender account.',
    lines: [
      { label: 'FT Reference', value: 'FT26169X4SRS' },
      { label: 'Sender account (last 5)', value: '12345' },
      { label: 'Format', value: 'FT + 12 chars · 5 digits' },
    ],
  },
  dashen: {
    title: 'Payment ID format',
    hint: 'Enter the IPSS reference from a Dashen VAT receipt (not Super App QR).',
    lines: [
      { label: 'IPSS Reference', value: '110IPSS2616900WO' },
      { label: 'Format', value: 'Starts with digits + IPSS' },
    ],
  },
}

const SMS_TEMPLATES = {
  telebirr: {
    title: 'SMS format',
    hint: 'Paste the full Telebirr transaction SMS including the receipt link.',
    body: `Dear customer
You have transferred ETB 60.00 to Receiver Name (2519****4025) on 17/06/2026 18:14:15. Your transaction number is DFH51OFIED. Your current balance is ETB 1,240.00.
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
  },
  cbe: {
    title: 'SMS format',
    hint: 'Paste the full CBE SMS including the BranchReceipt link.',
    body: `Dear Mr Petros your Account 1****7112 has been credited with ETB 100.00 on 17-JUN-26 from Sender Name(1****2345) with Ref No FT2616987RR0. Your Current Balance is ETB 5,420.00.
for Reciept https://apps.cbe.com.et:100/BranchReceipt/FT2616987RR0&33687112`,
  },
}

function FormatTextPanel({ method, mode }) {
  const label = BANK_LABELS[method] || method
  const badgeClass = BANK_BADGE_CLASS[method] || 'bank-badge-cbe'

  if (mode === 'reference') {
    const template = PAYMENT_ID_TEMPLATES[method]
    if (!template) return null

    return (
      <aside className="receipt-example-panel" aria-label="Payment ID format guide">
        <p className="receipt-example-label">{template.title}</p>
        <p className="receipt-example-hint">{template.hint}</p>
        <div className="format-template-block">
          {template.lines.map((line) => (
            <div key={line.label} className="format-template-row">
              <span className="format-template-key">{line.label}</span>
              <span className="format-template-value">{line.value}</span>
            </div>
          ))}
        </div>
        <span className={`bank-badge receipt-example-badge ${badgeClass}`}>{label}</span>
      </aside>
    )
  }

  if (mode === 'sms') {
    const template = SMS_TEMPLATES[method]
    if (!template) return null

    return (
      <aside className="receipt-example-panel" aria-label="SMS format guide">
        <p className="receipt-example-label">{template.title}</p>
        <p className="receipt-example-hint">{template.hint}</p>
        <div className="format-template-block format-template-sms">
          <pre className="format-template-pre">{template.body}</pre>
        </div>
        <span className={`bank-badge receipt-example-badge ${badgeClass}`}>{label}</span>
      </aside>
    )
  }

  return null
}

export default function VerificationFormatGuide({ method, mode = 'screenshot' }) {
  if (!method) return null

  const label = BANK_LABELS[method] || method
  const badgeClass = BANK_BADGE_CLASS[method] || 'bank-badge-cbe'

  if (mode === 'screenshot' && RECEIPT_IMAGES[method]) {
    return (
      <aside className="receipt-example-panel" aria-label="Example receipt format">
        <p className="receipt-example-label">Receipt format guide</p>
        <p className="receipt-example-hint">
          Your screenshot should look like this example — include the full receipt with QR code visible.
        </p>
        <div className="receipt-example-frame">
          <img
            src={RECEIPT_IMAGES[method]}
            alt={`${label} receipt example`}
            className="receipt-example-image"
          />
        </div>
        <span className={`bank-badge receipt-example-badge ${badgeClass}`}>{label}</span>
      </aside>
    )
  }

  if (mode === 'reference' || mode === 'sms') {
    return <FormatTextPanel method={method} mode={mode} />
  }

  return null
}
