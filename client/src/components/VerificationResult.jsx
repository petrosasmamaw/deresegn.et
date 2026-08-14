import { AlertCircle, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext'

function VisualDiff({ item }) {
  const { t } = useLocale()
  const rows = []
  if (item.formValue != null) {
    rows.push({
      label: item.code?.startsWith('MY_ACCOUNT') ? t('result.yourSaved') : t('result.youEntered'),
      value: item.formValue,
      status: 'entered',
    })
  }
  if (item.screenshotValue != null) {
    const mismatch = item.formValue != null && item.formValue !== item.screenshotValue
    rows.push({ label: t('result.screenshotShows'), value: item.screenshotValue, status: mismatch ? 'mismatch' : 'match' })
  }
  if (item.qrValue != null) {
    const mismatch = (item.formValue != null && item.formValue !== item.qrValue)
      || (item.screenshotValue != null && item.screenshotValue !== item.qrValue)
    rows.push({ label: t('result.officialRecord'), value: item.qrValue, status: mismatch ? 'mismatch' : 'match' })
  }
  if (rows.length === 0) return null

  return (
    <div className="payment-verify-diff" aria-label={t('result.fieldCompare')}>
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

function issueLabel(t, item) {
  if (item.code && t(`code.${item.code}`) !== `code.${item.code}`) {
    return t(`code.${item.code}`)
  }
  const fieldMap = {
    senderName: 'field.senderName',
    senderAccount: 'field.senderAccount',
    receiverName: 'field.receiverName',
    receiverAccount: 'field.receiverAccount',
    amount: 'common.amount',
    transactionCode: 'field.paymentId',
    screenshot: 'result.screenshot',
    smsText: 'result.smsMessage',
  }
  if (item.field && fieldMap[item.field]) return t(fieldMap[item.field])
  return item.code?.replace(/_/g, ' ') || t('result.error')
}

export function VerificationFailureList({ issues = [], title }) {
  const { t } = useLocale()
  if (!issues.length) return null
  const heading = title || t('result.couldNotVerify')

  return (
    <div className="payment-verify-fail">
      <div className="payment-verify-fail-header">
        <AlertCircle size={18} strokeWidth={1.5} aria-hidden="true" />
        <p className="font-medium">{heading}</p>
      </div>
      <ul className="payment-verify-list">
        {issues.map((item, idx) => (
          <li key={`${item.code || 'issue'}-${item.field || 'f'}-${idx}`} className="payment-verify-item payment-verify-item-error">
            <span className="payment-verify-item-label">
              {issueLabel(t, item)}
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
  const { t } = useLocale()
  const warnings = issues.filter((i) => i.type === 'warning')
  if (!warnings.length) return null

  return (
    <div className="payment-verify-warn">
      <div className="payment-verify-fail-header">
        <AlertTriangle size={18} strokeWidth={1.5} aria-hidden="true" />
        <p className="font-medium">{t('result.notes')}</p>
      </div>
      <ul className="payment-verify-list">
        {warnings.map((item, idx) => (
          <li key={`${item.code || 'warn'}-${item.field || 'f'}-${idx}`} className="payment-verify-item payment-verify-item-warn">
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
