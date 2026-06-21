import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'

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
            {(item.formValue != null || item.screenshotValue != null || item.qrValue != null) && (
              <dl className="payment-verify-compare">
                {item.formValue != null && (
                  <>
                    <dt>You entered</dt>
                    <dd className="font-mono">{item.formValue}</dd>
                  </>
                )}
                {item.screenshotValue != null && (
                  <>
                    <dt>Screenshot shows</dt>
                    <dd className="font-mono">{item.screenshotValue}</dd>
                  </>
                )}
                {item.qrValue != null && (
                  <>
                    <dt>QR code proves</dt>
                    <dd className="font-mono">{item.qrValue}</dd>
                  </>
                )}
              </dl>
            )}
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
