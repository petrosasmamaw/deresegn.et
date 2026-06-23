import { AlertCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

function VisualDiff({ item }) {
  const rows = []
  if (item.formValue != null) {
    rows.push({ label: 'You entered', value: item.formValue, status: 'entered' })
  }
  if (item.screenshotValue != null) {
    const mismatch = item.formValue != null && item.formValue !== item.screenshotValue
    rows.push({ label: 'Screenshot shows', value: item.screenshotValue, status: mismatch ? 'mismatch' : 'match' })
  }
  if (item.qrValue != null) {
    const mismatch = (item.formValue != null && item.formValue !== item.qrValue)
      || (item.screenshotValue != null && item.screenshotValue !== item.qrValue)
    rows.push({ label: 'Official record', value: item.qrValue, status: mismatch ? 'mismatch' : 'match' })
  }
  if (rows.length === 0) return null

  return (
    <div className="payment-verify-diff" aria-label="Field comparison">
      {rows.map((row) => (
        <div
          key={row.label}
          className={`payment-verify-diff-row payment-verify-diff-row--${row.status === 'mismatch' ? 'mismatch' : 'match'}`}
        >
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
          <span aria-hidden="true">
            {row.status === 'mismatch' ? <XCircle size={14} color="var(--color-maroon)" /> : <CheckCircle2 size={14} color="var(--color-verified)" />}
          </span>
        </div>
      ))}
    </div>
  )
}

const FIELD_LABELS = {
  senderName: 'Sender name',
  senderAccount: 'Sender account',
  receiverName: 'Receiver name',
  receiverAccount: 'Receiver account',
  amount: 'Amount',
  transactionCode: 'Payment ID',
  screenshot: 'Screenshot',
  smsText: 'SMS message',
}

const CODE_LABELS = {
  FRAUD_EDITED_RECEIPT: 'Payment ID error',
  FAKE_QR_CODE: 'Fake QR code detected',
  DUPLICATE_TX: 'Payment ID error',
  QR_MISSING: 'QR code missing',
  QR_UNREADABLE: 'QR code not readable',
  TX_FORM_QR_MISMATCH: 'Payment ID error',
  TX_FORM_SCREENSHOT_MISMATCH: 'Payment ID error',
  TX_CODE_MISMATCH: 'Payment ID error',
  SENDER_NAME_MISMATCH: 'Sender name error',
  SENDER_ACCOUNT_MISMATCH: 'Sender account error',
  RECEIVER_NAME_MISMATCH: 'Receiver name error',
  RECEIVER_ACCOUNT_MISMATCH: 'Receiver account error',
  AMOUNT_FORM_SCREENSHOT_MISMATCH: 'Amount error',
  SCREENSHOT_REQUIRED: 'Screenshot required',
  SMS_PARSE_FAILED: 'SMS parse error',
  SMS_TX_MISMATCH: 'Payment ID error',
  SMS_AMOUNT_MISMATCH: 'Amount error',
  SMS_RECEIVER_MISMATCH: 'Receiver name error',
  SMS_RECEIVER_ACCOUNT_MISMATCH: 'Receiver account error',
  SMS_ACCOUNT_MISMATCH: 'Account error',
  INVALID_SMS: 'Invalid SMS',
  SMS_REQUIRED: 'SMS required',
}

export function VerificationFailureList({ issues = [], title = 'Receipt could not be verified' }) {
  if (!issues.length) return null

  return (
    <div className="payment-verify-fail">
      <div className="payment-verify-fail-header">
        <AlertCircle size={18} strokeWidth={1.5} aria-hidden="true" />
        <p className="font-medium">{title}</p>
      </div>
      <ul className="payment-verify-list">
        {issues.map((item, idx) => (
          <li key={item.code || idx} className="payment-verify-item payment-verify-item-error">
            <span className="payment-verify-item-label">
              {CODE_LABELS[item.code] || FIELD_LABELS[item.field] || item.code?.replace(/_/g, ' ') || 'Error'}
            </span>
            <p className="payment-verify-item-msg">{item.message}</p>
            <VisualDiff item={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function VerificationWarningList({ issues = [] }) {
  const warnings = issues.filter((i) => i.type === 'warning')
  if (!warnings.length) return null

  return (
    <div className="payment-verify-warn">
      <div className="payment-verify-fail-header">
        <AlertTriangle size={18} strokeWidth={1.5} aria-hidden="true" />
        <p className="font-medium">Notes</p>
      </div>
      <ul className="payment-verify-list">
        {warnings.map((item, idx) => (
          <li key={item.code || idx} className="payment-verify-item payment-verify-item-warn">
            <p className="payment-verify-item-msg">{item.message}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function VerificationSuccessNote({ message }) {
  if (!message) return null
  return (
    <div className="payment-verify-success">
      <CheckCircle2 size={18} strokeWidth={1.5} aria-hidden="true" />
      <p>{message}</p>
    </div>
  )
}
