import { useLocale } from '../i18n/LocaleContext'

export default function ReceiptDetailFields({ form, onChange, txPlaceholder }) {
  const { t } = useLocale()

  return (
    <div className="space-y-3">
      <div>
        <label className="label">{t('field.senderName')}</label>
        <input className="input" value={form.senderName} onChange={(e) => onChange('senderName', e.target.value)} placeholder={t('field.senderNamePh')} required />
      </div>
      <div>
        <label className="label">{t('field.senderAccount')}</label>
        <input className="input font-mono" value={form.senderAccount} onChange={(e) => onChange('senderAccount', e.target.value)} placeholder={t('field.senderAccountPh')} required />
      </div>
      <div>
        <label className="label">{t('field.receiverName')}</label>
        <input className="input" value={form.receiverName} onChange={(e) => onChange('receiverName', e.target.value)} placeholder={t('field.receiverNamePh')} required />
      </div>
      <div>
        <label className="label">{t('field.receiverAccount')}</label>
        <input className="input font-mono" value={form.receiverAccount} onChange={(e) => onChange('receiverAccount', e.target.value)} placeholder={t('field.receiverAccountPh')} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">{t('field.amount')}</label>
          <input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => onChange('amount', e.target.value)} placeholder="0.00" required />
        </div>
        <div>
          <label className="label">{t('field.paymentId')}</label>
          <input className="input font-mono" value={form.transactionCode} onChange={(e) => onChange('transactionCode', e.target.value)} placeholder={txPlaceholder || t('field.txPh')} required />
        </div>
      </div>
    </div>
  )
}
