import { useState, useEffect, useMemo } from 'react'
import { Smartphone, Building2, Upload, CheckCircle2, RotateCcw, ArrowRight, Camera, Hash, MessageSquare } from 'lucide-react'
import Modal from './Modal'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { VerificationFailureList } from './VerificationResult'
import ReceiptSummaryCard from './ReceiptSummaryCard'
import VerificationFormatGuide from './VerificationFormatGuide'
import { useLocale } from '../i18n/LocaleContext'

const SMS_PLACEHOLDERS = {
  telebirr: `Dear customer
You have transferred ETB 60.00 to Receiver Name (2519****4025)...
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
  cbe: `Dear Petiros Asmamaw Abebe You have received ETB 2,000.00 from account 1**0947 (Sender Name) to your account 1**7112. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
}

const EMPTY_REFERENCE = {
  transactionCode: '',
  accountSuffix: '',
}

export default function TopUpModal({
  isOpen,
  onClose,
  onSubmit,
  onReferenceSubmit,
  onSmsSubmit,
  loading,
  error,
}) {
  const { t } = useLocale()
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('telebirr')
  const [verifyMode, setVerifyMode] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [successDetails, setSuccessDetails] = useState(null)
  const [receiverAccounts, setReceiverAccounts] = useState([])
  const [referenceForm, setReferenceForm] = useState(EMPTY_REFERENCE)
  const [smsText, setSmsText] = useState('')

  const methods = useMemo(() => [
    { id: 'telebirr', label: t('method.telebirr'), icon: Smartphone, desc: t('method.telebirrTopupDesc') },
    { id: 'cbe', label: t('method.cbe'), icon: Building2, desc: t('method.cbeTopupDesc') },
  ], [t])

  const methodLabels = useMemo(() => ({
    telebirr: t('method.telebirr'),
    cbe: 'CBE',
  }), [t])

  const referenceDetailByMethod = useMemo(() => ({
    telebirr: t('ref.telebirrDetail'),
    cbe: t('ref.cbeDetail'),
  }), [t])

  const referenceFieldsByMethod = useMemo(() => ({
    telebirr: [
      { key: 'transactionCode', label: t('ref.invoice'), placeholder: 'DG65L5I9M5', hint: t('ref.invoiceHint') },
    ],
    cbe: [
      { key: 'transactionCode', label: t('ref.cbeToken'), placeholder: 'FT26226GC3H3 or v2-…', hint: t('ref.cbeTokenHint') },
      { key: 'accountSuffix', label: t('ref.cbeAccount'), placeholder: '33687112', hint: t('ref.cbeAccountHintShort'), legacyOnly: true },
    ],
  }), [t])

  useEffect(() => {
    if (!isOpen) return
    axios.get('/balance/topup-accounts')
      .then((res) => {
        const data = unwrap(res)
        setReceiverAccounts(data.accounts || [])
      })
      .catch(() => setReceiverAccounts([]))
  }, [isOpen])

  const selectedAccount = receiverAccounts.find((a) => a.method === method)
  const referenceFields = useMemo(() => {
    const fields = referenceFieldsByMethod[method] || []
    if (method !== 'cbe') return fields
    if (/^FT[A-Z0-9]{8,}/i.test(String(referenceForm.transactionCode || '').trim().replace(/\s+/g, ''))
      && !/mbreciept\.cbe\.com\.et|^v2-/i.test(String(referenceForm.transactionCode || '').trim())) {
      return fields
    }
    return fields.filter((f) => !f.legacyOnly)
  }, [method, referenceFieldsByMethod, referenceForm.transactionCode])
  const referenceReady = referenceFields.every((f) => String(referenceForm[f.key] || '').trim())
  const successStep = 4

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
  }

  const reset = () => {
    setStep(1)
    setMethod('telebirr')
    setVerifyMode('')
    setScreenshot(null)
    setPreview(null)
    setRejected(false)
    setFailureIssues([])
    setSuccessDetails(null)
    setReferenceForm(EMPTY_REFERENCE)
    setSmsText('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFailure = (result) => {
    setFailureIssues(result.issues || [])
    setRejected(true)
  }

  const runTopUpScreenshot = async () => {
    if (!screenshot) {
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: t('topup.screenshotRequired') }])
      setRejected(true)
      return
    }
    setRejected(false)
    setFailureIssues([])
    const result = await onSubmit({ screenshot, method })
    if (result?.failed) return handleFailure(result)
    if (result?.success) {
      setSuccessDetails(result.resolvedDetails)
      setStep(successStep)
    }
  }

  const runTopUpReference = async (e) => {
    e.preventDefault()
    setRejected(false)
    setFailureIssues([])
    const result = await onReferenceSubmit({
      method,
      transactionCode: referenceForm.transactionCode,
      accountSuffix: referenceForm.accountSuffix,
    })
    if (result?.failed) return handleFailure(result)
    if (result?.success) {
      setSuccessDetails(result.resolvedDetails)
      setStep(successStep)
    }
  }

  const runTopUpSms = async (e) => {
    e.preventDefault()
    setRejected(false)
    setFailureIssues([])
    const result = await onSmsSubmit({ method, smsText })
    if (result?.failed) return handleFailure(result)
    if (result?.success) {
      setSuccessDetails(result.resolvedDetails)
      setStep(successStep)
    }
  }

  const successSubtext = verifyMode === 'sms'
    ? t('topup.subSms')
    : verifyMode === 'reference'
      ? t('topup.subReference')
      : method === 'telebirr'
        ? t('topup.subTelebirr')
        : t('topup.subQr')

  if (!isOpen) return null

  const showFormatGuide = step === 3 && method && ['screenshot', 'reference', 'sms'].includes(verifyMode)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('topup.title')}
      wide={showFormatGuide}
    >
        {rejected ? (
          <div className="modal-body space-y-5">
            <VerificationFailureList issues={failureIssues} />
            <div className="modal-footer gap-3">
              <button
                type="button"
                onClick={() => { setRejected(false); setStep(3) }}
                className="btn-secondary flex-1 flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                {t('common.tryAgain')}
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">{t('common.close')}</button>
            </div>
          </div>
        ) : step === successStep ? (
          <div className="modal-body space-y-5">
            <div className="card p-4 flex items-center gap-3" style={{ background: 'var(--color-success-muted)', borderColor: 'var(--color-success)', borderWidth: '2px' }}>
              <CheckCircle2 size={28} style={{ color: 'var(--color-success)' }} />
              <div>
                <p className="font-bold" style={{ color: 'var(--color-success)' }}>{t('topup.verified')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{successSubtext}</p>
              </div>
            </div>
            {successDetails && <ReceiptSummaryCard details={successDetails} title={t('topup.paymentSummary')} />}
            <button onClick={handleClose} className="btn-primary w-full">{t('topup.done')}</button>
          </div>
        ) : (
          <div className="modal-body space-y-6">
            {error && !rejected && (
              <div className="alert alert-error">
                <p className="font-semibold">{typeof error === 'string' ? error : error.message}</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm font-semibold">{t('topup.stepMethod')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{t('topup.stepMethodHint')}</p>
                <div className="grid grid-cols-1 gap-3">
                  {methods.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMethod(m.id); setStep(2) }}
                      className="card p-4 text-left border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <m.icon size={20} style={{ color: 'var(--color-primary)' }} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm">{m.label}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{m.desc}</p>
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
                <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← {t('common.back')}</button>
                <p className="text-sm font-semibold">{t('topup.stepMode')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('topup.stepModeHint')}
                </p>

                {selectedAccount && (
                  <div className="card p-4 space-y-2" style={{ background: 'var(--color-info-muted)', borderColor: 'var(--color-info)' }}>
                    <p className="text-xs font-semibold uppercase text-[var(--color-info)]">{t('topup.sendTo')}</p>
                    <p className="text-sm font-semibold">{selectedAccount.receiverName}</p>
                    <p className="text-sm font-mono">{selectedAccount.receiverAccount}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => { setVerifyMode('screenshot'); setStep(3) }}
                  className="w-full card p-4 text-left border-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <Camera size={20} style={{ color: 'var(--color-primary)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{t('check.modeScreenshot')}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {method === 'telebirr'
                          ? t('topup.modeScreenshotDescTelebirr')
                          : t('topup.modeScreenshotDesc')}
                      </p>
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
                      <p className="font-semibold text-sm">{t('check.modeReference')}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t('topup.modeReferenceDesc')}</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-accent)' }} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { setVerifyMode('sms'); setStep(3) }}
                  className="w-full card p-4 text-left border-2"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare size={20} style={{ color: 'var(--color-info)' }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">{t('check.modeSms')}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{t('topup.modeSmsDesc')}</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-info)' }} />
                  </div>
                </button>
              </div>
            )}

            {step === 3 && verifyMode === 'screenshot' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={(e) => { e.preventDefault(); runTopUpScreenshot() }} className="modal-split-main modal-split-main-pad space-y-5">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← {t('common.back')}</button>
                <p className="text-sm font-semibold">{t('topup.stepUpload')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('topup.stepUploadHint', { method: methodLabels[method] })}
                  {method === 'telebirr' && t('topup.stepUploadHintTelebirrExtra')}
                </p>

                <div className="drop-zone p-8 text-center cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {preview ? <p className="text-sm font-semibold">{t('topup.screenshotReady')}</p> : (
                    <div className="space-y-2">
                      <Upload size={24} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
                      <p className="text-sm font-semibold">{t('topup.uploadReceipt')}</p>
                    </div>
                  )}
                </div>
                {preview && <img src={preview} alt="Preview" className="mt-3 rounded-lg border max-h-40 mx-auto object-contain w-full" />}

                <button type="submit" disabled={loading || !screenshot} className="btn-primary w-full">
                  {loading ? t('topup.processing') : t('topup.verifyBtn')}
                </button>
              </form>
              <VerificationFormatGuide method={method} mode="screenshot" />
              </div>
            )}

            {step === 3 && verifyMode === 'reference' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={runTopUpReference} className="modal-split-main modal-split-main-pad space-y-5">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← {t('common.back')}</button>
                <p className="text-sm font-semibold">{t('topup.stepPaymentId')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('topup.stepPaymentIdHint', { detail: referenceDetailByMethod[method] })}
                </p>

                {referenceFields.map((field) => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder={field.placeholder}
                      value={referenceForm[field.key]}
                      onChange={(e) => setReferenceForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      required
                    />
                    {field.hint && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{field.hint}</p>}
                  </div>
                ))}

                <button type="submit" disabled={loading || !referenceReady} className="btn-primary w-full">
                  {loading ? t('topup.processing') : t('topup.verifyBtn')}
                </button>
              </form>
              <VerificationFormatGuide method={method} mode="reference" />
              </div>
            )}

            {step === 3 && verifyMode === 'sms' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={runTopUpSms} className="modal-split-main modal-split-main-pad space-y-5">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← {t('common.back')}</button>
                <p className="text-sm font-semibold">{t('topup.stepSms')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('topup.stepSmsHint')}
                </p>

                <textarea
                  className="input w-full min-h-[180px] font-mono text-xs"
                  placeholder={SMS_PLACEHOLDERS[method]}
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  required
                />

                <button type="submit" disabled={loading || smsText.trim().length < 40} className="btn-primary w-full">
                  {loading ? t('topup.processing') : t('topup.verifyBtn')}
                </button>
              </form>
              <VerificationFormatGuide method={method} mode="sms" />
              </div>
            )}
          </div>
        )}
    </Modal>
  )
}
