import { useLocale } from '../i18n/LocaleContext'

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

function FormatTextPanel({ method, mode }) {
  const { t } = useLocale()
  const label = BANK_LABELS[method] || method
  const badgeClass = BANK_BADGE_CLASS[method] || 'bank-badge-cbe'

  if (mode === 'reference') {
    const hintKey = {
      telebirr: 'guide.telebirrHint',
      cbe: 'guide.cbeHint',
      boa: 'guide.boaHint',
      dashen: 'guide.dashenHint',
    }[method]
    if (!hintKey) return null

    const linesByMethod = {
      telebirr: [
        { label: t('guide.field'), value: 'Invoice No.' },
        { label: t('guide.example'), value: 'DG65L5I9M5' },
        { label: t('guide.format'), value: '10 uppercase letters & digits' },
      ],
      cbe: [
        { label: 'FT Reference', value: 'FT26169D8C5M' },
        { label: t('ref.cbeSuffix'), value: '12345678' },
        { label: t('guide.format'), value: 'FT + 12 chars · 8 digits' },
      ],
      boa: [
        { label: 'FT Reference', value: 'FT26169X4SRS' },
        { label: t('ref.boaSuffix'), value: '12345' },
        { label: t('guide.format'), value: 'FT + 12 chars · 5 digits' },
      ],
      dashen: [
        { label: 'IPSS Reference', value: '110IPSS2616900WO' },
        { label: t('guide.format'), value: 'Starts with digits + IPSS' },
      ],
    }

    return (
      <aside className="receipt-example-panel" aria-label={t('guide.paymentIdFormat')}>
        <p className="receipt-example-label">{t('guide.paymentIdFormat')}</p>
        <p className="receipt-example-hint">{t(hintKey)}</p>
        <div className="format-template-block">
          {(linesByMethod[method] || []).map((line) => (
            <div key={`${line.label}-${line.value}`} className="format-template-row">
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
    const hintKey = {
      telebirr: 'guide.telebirrSmsHint',
      cbe: 'guide.cbeSmsHint',
      boa: 'guide.boaSmsHint',
    }[method]
    if (!hintKey) return null

    const bodyByMethod = {
      telebirr: `Dear customer
You have transferred ETB 60.00 to Receiver Name (2519****4025) on 17/06/2026 18:14:15. Your transaction number is DFH51OFIED. Your current balance is ETB 1,240.00.
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
      cbe: `Dear Petiros Asmamaw Abebe You have received ETB 2,000.00 from account 1**0947 (Sender Name) to your account 1**7112. Your current balance is ETB 3,103.06. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
      boa: `Dear Petros, your account 2*23 was credited with ETB 100.00 by Mikiyas Amsalu Admasu. Available Balance: ETB 603.71.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26223W14ZW94077
Feedback: https://cs.bankofabyssinia.com/cs/?trx=CFT26223W14ZW
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.`,
    }
    const body = bodyByMethod[method]
    if (!body) return null

    return (
      <aside className="receipt-example-panel" aria-label={t('guide.smsFormat')}>
        <p className="receipt-example-label">{t('guide.smsFormat')}</p>
        <p className="receipt-example-hint">{t(hintKey)}</p>
        <div className="format-template-block format-template-sms">
          <pre className="format-template-pre">{body}</pre>
        </div>
        <span className={`bank-badge receipt-example-badge ${badgeClass}`}>{label}</span>
      </aside>
    )
  }

  return null
}

export default function VerificationFormatGuide({ method, mode = 'screenshot' }) {
  const { t } = useLocale()
  if (!method) return null

  const label = BANK_LABELS[method] || method
  const badgeClass = BANK_BADGE_CLASS[method] || 'bank-badge-cbe'

  if (mode === 'screenshot' && RECEIPT_IMAGES[method]) {
    return (
      <aside className="receipt-example-panel" aria-label={t('guide.receiptGuide')}>
        <p className="receipt-example-label">{t('guide.receiptGuide')}</p>
        <p className="receipt-example-hint">{t(`upload.${method}`)}</p>
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
