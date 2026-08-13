import { useMemo, useState } from 'react'
import { Smartphone, Building2, RotateCcw, ArrowRight, Upload, ListChecks, Hash, Camera, MessageSquare } from 'lucide-react'
import Modal from './Modal'
import { VerificationFailureList, VerificationSuccessNote, VerificationWarningList } from './VerificationResult'
import VerificationCertificate from './VerificationCertificate'
import ReceiptSummaryCard from './ReceiptSummaryCard'
import ReceiptDetailFields from './ReceiptDetailFields'
import VerificationFormatGuide from './VerificationFormatGuide'
import { useLocale } from '../i18n/LocaleContext'

const TX_PLACEHOLDERS = {
  telebirr: 'e.g. DG65L5I9M5',
  cbe: 'e.g. FT26169D8C5M',
  boa: 'e.g. FT26169X4SRS or TT26171RW0YG',
  dashen: 'e.g. 110IPSS2616900WO',
}

const SMS_SUPPORTED = new Set(['telebirr', 'cbe', 'boa'])

const SMS_PLACEHOLDERS = {
  telebirr: `Dear customer
You have transferred ETB 60.00 to Receiver Name (2519****4025) on 17/06/2026 18:14:15. Your transaction number is DFH51OFIED...
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
  cbe: `Dear Petiros Asmamaw Abebe You have received ETB 2,000.00 from account 1**0947 (Sender Name) to your account 1**7112. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
  boa: `Dear Petros, your account 2*23 was debited with ETB 200.00. Available Balance: ETB 102.63.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=TT26171RW0YG02723
For help, call 8397. Bank of Abyssinia.`,
}

function getCheckCostByAmount(amount) {
  const numAmount = parseFloat(amount) || 0
  if (numAmount < 100) return 2
  if (numAmount < 1000) return 5
  if (numAmount < 5000) return 10
  if (numAmount < 10000) return 15
  return 20
}

const EMPTY_FORM = {
  senderName: '',
  senderAccount: '',
  receiverName: '',
  receiverAccount: '',
  amount: '',
  transactionCode: '',
}

const EMPTY_REFERENCE = {
  transactionCode: '',
  accountSuffix: '',
}

export default function CheckerModal({
  isOpen,
  onClose,
  onSubmit,
  onReferenceSubmit,
  onSmsSubmit,
  loading,
  error,
  lastResult,
  lastResolvedDetails,
}) {
  const { t } = useLocale()
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('')
  const [verifyMode, setVerifyMode] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [withDetails, setWithDetails] = useState(false)
  const [successDetails, setSuccessDetails] = useState(null)
  const [successCheck, setSuccessCheck] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [referenceForm, setReferenceForm] = useState(EMPTY_REFERENCE)
  const [smsText, setSmsText] = useState('')

  const methods = useMemo(() => [
    { id: 'telebirr', label: t('method.telebirr'), icon: Smartphone, desc: t('method.telebirrCheckDesc') },
    { id: 'cbe', label: t('method.cbe'), icon: Building2, desc: t('method.cbeCheckDesc') },
    { id: 'boa', label: t('method.boa'), icon: Building2, desc: t('method.boaCheckDesc') },
    { id: 'dashen', label: t('method.dashen'), icon: Building2, desc: t('method.dashenCheckDesc') },
  ], [t])

  const referenceDetailByMethod = useMemo(() => ({
    telebirr: t('ref.telebirrDetail'),
    dashen: t('ref.dashenDetail'),
    cbe: t('ref.cbeDetail'),
    boa: t('ref.boaDetail'),
  }), [t])

  const referenceFieldsByMethod = useMemo(() => ({
    telebirr: [
      { key: 'transactionCode', label: t('ref.invoice'), placeholder: 'DG65L5I9M5', hint: t('ref.invoiceHint') },
    ],
    dashen: [
      { key: 'transactionCode', label: t('ref.ipss'), placeholder: '110IPSS2616900WO', hint: t('ref.ipssHint') },
    ],
    cbe: [
      { key: 'transactionCode', label: t('ref.ft'), placeholder: 'FT26169D8C5M', hint: t('ref.ftHint') },
      { key: 'accountSuffix', label: t('ref.cbeSuffix'), placeholder: '12345678', hint: t('ref.cbeSuffixHint') },
    ],
    boa: [
      { key: 'transactionCode', label: t('ref.boaId'), placeholder: 'TT26171RW0YG', hint: t('ref.boaIdHint') },
      { key: 'accountSuffix', label: t('ref.boaSuffix'), placeholder: '12345', hint: t('ref.boaSuffixHint') },
    ],
  }), [t])

  const uploadHints = useMemo(() => ({
    telebirr: t('upload.telebirr'),
    cbe: t('upload.cbe'),
    boa: t('upload.boa'),
    dashen: t('upload.dashen'),
  }), [t])

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleReferenceChange = (field, value) => {
    setReferenceForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
  }

  const resetForm = () => {
    setStep(1)
    setMethod('')
    setVerifyMode('')
    setScreenshot(null)
    setPreview(null)
    setRejected(false)
    setFailureIssues([])
    setWithDetails(false)
    setSuccessDetails(null)
    setSuccessCheck(null)
    setForm(EMPTY_FORM)
    setReferenceForm(EMPTY_REFERENCE)
    setSmsText('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const successStep = verifyMode === 'reference' || verifyMode === 'sms'
    ? 4
    : (withDetails ? 5 : 4)

  const runVerify = async (useDetails) => {
    if (!screenshot) {
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: t('check.screenshotRequired') }])
      setRejected(true)
      return
    }

    setRejected(false)
    setFailureIssues([])

    const result = await onSubmit({
      screenshot,
      method,
      form: useDetails ? form : EMPTY_FORM,
      withDetails: useDetails,
    })

    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setSuccessDetails(result.resolvedDetails || lastResolvedDetails || null)
      setSuccessCheck(result.check || lastResult || null)
      setStep(successStep)
    }
  }

  const runReferenceVerify = async (e) => {
    e.preventDefault()
    setRejected(false)
    setFailureIssues([])

    const result = await onReferenceSubmit({
      method,
      transactionCode: referenceForm.transactionCode,
      accountSuffix: referenceForm.accountSuffix,
    })

    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setSuccessDetails(result.resolvedDetails || lastResolvedDetails || null)
      setSuccessCheck(result.check || lastResult || null)
      setStep(4)
    }
  }

  const runSmsVerify = async (e) => {
    e.preventDefault()
    setRejected(false)
    setFailureIssues([])

    const result = await onSmsSubmit({ method, smsText })

    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setSuccessDetails(result.resolvedDetails || lastResolvedDetails || null)
      setSuccessCheck(result.check || lastResult || null)
      setStep(4)
    }
  }

  const handleQuickVerify = async (e) => {
    e.preventDefault()
    await runVerify(false)
  }

  const handleDetailVerify = async (e) => {
    e.preventDefault()
    await runVerify(true)
  }

  const referenceFields = referenceFieldsByMethod[method] || []
  const referenceReady = referenceFields.every((f) => String(referenceForm[f.key] || '').trim())

  if (!isOpen) return null

  const summaryDetails = successDetails || lastResolvedDetails || (lastResult ? {
    senderName: lastResult.senderName,
    senderAccount: lastResult.senderAccount,
    receiverName: lastResult.receiverName,
    receiverAccount: lastResult.receiverAccount,
    amount: lastResult.amount,
    transactionCode: lastResult.transactionCode,
  } : null)

  const successMessage = verifyMode === 'sms'
    ? t('check.successSms')
    : verifyMode === 'reference'
      ? t('check.successReference')
      : t('check.successReceipt')

  const previousVerification = (successCheck || lastResult)?.previousVerification || null
  const previousVerificationLabel = previousVerification?.verifiedBy === 'self'
    ? t('check.prevSelf')
    : previousVerification?.verifiedBy === 'other'
      ? t('check.prevOther')
      : null

  const previousVerificationMeta = previousVerification?.checkedAt
    ? (() => {
        const when = new Date(previousVerification.checkedAt)
        return Number.isNaN(when.getTime()) ? null : when.toLocaleString()
      })()
    : null

  const previousVerificationColor = previousVerification?.verifiedBy === 'self'
    ? {
        bg: 'var(--color-info-muted)',
        border: 'var(--color-info)',
        text: 'var(--color-info)',
      }
    : {
        bg: 'rgba(125, 74, 255, 0.10)',
        border: 'rgba(125, 74, 255, 0.35)',
        text: 'rgb(125, 74, 255)',
      }

  const previousVerificationHint = previousVerification?.verifiedBy === 'self'
    ? t('check.prevSelfHint')
    : t('check.prevOtherHint')

  const showFormatGuide = step === 3 && method && ['screenshot', 'reference', 'sms'].includes(verifyMode)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('check.title')}
      wide={showFormatGuide}
    >
        {rejected ? (
          <div className="modal-body space-y-5">
            <VerificationFailureList issues={failureIssues} />
            <div className="modal-footer gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejected(false)
                  if (verifyMode === 'reference' || verifyMode === 'sms') setStep(3)
                  else setStep(withDetails ? 4 : 3)
                }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} strokeWidth={2} />
                {t('common.tryAgain')}
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : step === successStep ? (
          <div className="modal-body space-y-5">
            {previousVerificationLabel && (
              <div
                className="rounded-lg p-3 border"
                style={{
                  background: previousVerificationColor.bg,
                  borderColor: previousVerificationColor.border,
                }}
              >
                <p className="text-[var(--text-sm)] font-semibold" style={{ color: previousVerificationColor.text }}>
                  {previousVerificationLabel}
                </p>
                <p className="text-[var(--text-xs)] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {previousVerificationHint}
                  {previousVerificationMeta ? ` ${t('check.verifiedOn', { when: previousVerificationMeta })}` : ''}
                </p>
              </div>
            )}
            <VerificationSuccessNote message={successMessage} />
            {(successCheck || lastResult) && (
              <VerificationCertificate check={successCheck || lastResult} />
            )}
            {summaryDetails && <ReceiptSummaryCard details={summaryDetails} />}
            <VerificationWarningList issues={lastResult?.validationResult?.issues || successCheck?.validationResult?.issues || []} />
            <div className="bg-[var(--color-info-muted)] rounded-lg p-3 border border-[var(--color-info)]">
              <p className="text-[var(--text-xs)] font-semibold text-[var(--color-info)] mb-1">{t('check.balanceUpdate')}</p>
              <p className="text-[var(--text-sm)] text-[var(--color-text-primary)]">
                {(successCheck || lastResult)?.isRecheck
                  ? t('check.noCharge')
                  : t('check.deducted', { amount: (successCheck || lastResult)?.balanceDeducted || getCheckCostByAmount(summaryDetails?.amount) })}
              </p>
            </div>
            <button onClick={handleClose} className="btn-primary w-full">{t('check.complete')}</button>
          </div>
        ) : (
          <div className="modal-body space-y-5">
            {error && !rejected && (
              <div className="alert alert-error">
                <p className="font-semibold text-sm">{typeof error === 'string' ? error : error.message || t('result.failed')}</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">{t('check.stepMethod')}</p>
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{t('check.stepMethodHint')}</p>
                </div>
                <div className="space-y-2">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMethod(m.id); setStep(2) }}
                      className="w-full card p-4 text-left cursor-pointer transition-all border-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-center gap-3">
                        <m.icon size={20} style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[var(--text-sm)]">{m.label}</p>
                          <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{m.desc}</p>
                        </div>
                        <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-primary)' }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <button type="button" onClick={() => setStep(1)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    {t('check.backMethod')}
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepMode')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {t('check.stepModeHint')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => { setVerifyMode('screenshot'); setStep(3) }}
                  className="w-full card p-4 text-left border-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <Camera size={20} style={{ color: 'var(--color-primary)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--text-sm)]">{t('check.modeScreenshot')}</p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{t('check.modeScreenshotDesc')}</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-primary)' }} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setVerifyMode('reference'); setStep(3) }}
                  className="w-full card p-4 text-left border-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <Hash size={20} style={{ color: 'var(--color-accent)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--text-sm)]">{t('check.modeReference')}</p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{t('check.modeReferenceDesc')}</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-accent)' }} />
                  </div>
                </button>

                {SMS_SUPPORTED.has(method) && (
                  <button
                    type="button"
                    onClick={() => { setVerifyMode('sms'); setStep(3) }}
                    className="w-full card p-4 text-left border-2"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare size={20} style={{ color: 'var(--color-info)' }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[var(--text-sm)]">{t('check.modeSms')}</p>
                        <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{t('check.modeSmsDesc')}</p>
                      </div>
                      <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-info)' }} />
                    </div>
                  </button>
                )}

                <div className="rounded-lg p-4 border text-[var(--text-xs)] font-mono leading-relaxed" style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)' }}>
                  <p className="font-semibold text-[var(--text-sm)] font-sans mb-2">{t('check.paymentIdGuide')}</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">Telebirr</span> → {t('ref.telebirrDetail')}</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">Dashen</span> → {t('ref.dashenDetail')}</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">CBE</span> → {t('ref.cbeDetail')}</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">BOA</span> → {t('ref.boaDetail')}</p>
                  {SMS_SUPPORTED.has(method) && (
                    <p className="text-[var(--color-text-secondary)] mt-2 font-sans"><span className="text-[var(--color-text-primary)]">SMS</span> → {t('check.smsGuide')}</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && verifyMode === 'screenshot' && (
              <div className="modal-split modal-split-bleed">
                <form onSubmit={handleQuickVerify} className="modal-split-main modal-split-main-pad space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(2)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    {t('check.backType')}
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepUpload')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {method === 'telebirr'
                      ? t('check.stepUploadHintTelebirr')
                      : t('check.stepUploadHintOther')}
                  </p>
                </div>

                <div>
                  <label className="label mb-3">{t('check.screenshotLabel')}</label>
                  <div className="drop-zone p-8 text-center cursor-pointer">
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" required />
                    {preview ? (
                      <p className="text-sm font-semibold">{t('check.screenshotUploaded')}</p>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={24} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
                        <p className="text-sm font-semibold">{t('check.uploadReceipt')}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{uploadHints[method]}</p>
                      </div>
                    )}
                  </div>
                  {preview && (
                    <img src={preview} alt="Receipt preview" className="mt-3 rounded-lg border max-h-40 mx-auto object-contain w-full" />
                  )}
                </div>

                <div className="modal-footer gap-3 flex-col sm:flex-row">
                  <button
                    type="button"
                    disabled={loading || !screenshot}
                    onClick={() => { setWithDetails(true); setStep(4) }}
                    className="btn-secondary flex-1 flex items-center justify-center gap-2"
                  >
                    <ListChecks size={16} />
                    {t('check.withDetails')}
                  </button>
                  <button type="submit" disabled={loading || !screenshot} className="btn-primary flex-1">
                    {loading && !withDetails ? t('check.verifying') : t('check.verifyBtn')}
                  </button>
                </div>
              </form>
              <VerificationFormatGuide method={method} mode="screenshot" />
              </div>
            )}

            {step === 3 && verifyMode === 'reference' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={runReferenceVerify} className="modal-split-main modal-split-main-pad space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(2)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    {t('check.backType')}
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepPaymentId')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {t('check.stepPaymentIdHint')}
                  </p>
                </div>

                <div className="rounded-lg p-3 border text-[var(--text-xs)]" style={{ background: 'var(--color-accent-muted)', borderColor: 'var(--color-accent-border)' }}>
                  <p className="font-semibold text-[var(--text-sm)] mb-1">
                    {methods.find((m) => m.id === method)?.label}
                  </p>
                  <p className="text-[var(--color-text-secondary)]">
                    {referenceDetailByMethod[method]}
                  </p>
                </div>

                {referenceFields.map((field) => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder={field.placeholder}
                      value={referenceForm[field.key]}
                      onChange={(e) => handleReferenceChange(field.key, e.target.value)}
                      required
                    />
                    {field.hint && (
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">{field.hint}</p>
                    )}
                  </div>
                ))}

                <button type="submit" disabled={loading || !referenceReady} className="btn-primary w-full">
                  {loading ? t('check.verifying') : t('check.verifyPaymentId')}
                </button>
                <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] text-center">
                  {t('check.costRange')}
                </p>
              </form>
              <VerificationFormatGuide method={method} mode="reference" />
              </div>
            )}

            {step === 3 && verifyMode === 'sms' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={runSmsVerify} className="modal-split-main modal-split-main-pad space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(2)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    {t('check.backType')}
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepSms')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {t('check.stepSmsHint')}
                  </p>
                </div>

                <div>
                  <label className="label">{t('check.smsLabel')}</label>
                  <textarea
                    className="input w-full min-h-[180px] font-mono text-[var(--text-xs)]"
                    placeholder={SMS_PLACEHOLDERS[method]}
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    required
                  />
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-2">
                    {method === 'telebirr'
                      ? t('check.stepSmsHintTelebirr')
                      : t('check.stepSmsHintCbe')}
                  </p>
                </div>

                <button type="submit" disabled={loading || smsText.trim().length < 40} className="btn-primary w-full">
                  {loading ? t('check.verifying') : t('check.verifySms')}
                </button>
                <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] text-center">
                  {t('check.costRange')}
                </p>
              </form>
              <VerificationFormatGuide method={method} mode="sms" />
              </div>
            )}

            {step === 4 && verifyMode === 'screenshot' && (
              <form onSubmit={handleDetailVerify} className="space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(3)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    {t('check.backScreenshot')}
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepDetails')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {t('check.stepDetailsHint')}
                  </p>
                </div>

                <ReceiptDetailFields form={form} onChange={handleChange} txPlaceholder={TX_PLACEHOLDERS[method]} />

                {form.amount && (
                  <div className="bg-[var(--color-info-muted)] rounded-lg p-3 border border-[var(--color-info)]">
                    <p className="text-[var(--text-xs)] font-semibold text-[var(--color-info)] mb-1">{t('check.verificationCost')}</p>
                    <p className="text-[var(--text-sm)]">{t('check.verificationCostValue', { cost: getCheckCostByAmount(form.amount) })}</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? t('check.verifying') : t('check.verifyWithDetails')}
                </button>
              </form>
            )}
          </div>
        )}
    </Modal>
  )
}
