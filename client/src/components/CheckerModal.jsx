import { useState } from 'react'
import { X, Smartphone, Building2, CheckCircle2, RotateCcw, ArrowRight, Upload, ListChecks, Hash, Camera, MessageSquare } from 'lucide-react'
import Modal from './Modal'
import { VerificationFailureList, VerificationSuccessNote, VerificationWarningList } from './VerificationResult'
import VerificationCertificate from './VerificationCertificate'
import ReceiptSummaryCard from './ReceiptSummaryCard'
import ReceiptDetailFields from './ReceiptDetailFields'
import VerificationFormatGuide from './VerificationFormatGuide'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, desc: 'Mobile wallet receipt with Invoice No.' },
  { id: 'cbe', label: 'Commercial Bank of Ethiopia (CBE)', icon: Building2, desc: 'CBE success screen or VAT/web receipt with FT reference & QR' },
  { id: 'boa', label: 'Bank of Abyssinia', icon: Building2, desc: 'BOA transfer receipt with FT reference' },
  { id: 'dashen', label: 'Dashen Bank', icon: Building2, desc: 'Dashen VAT receipt with IPSS reference' },
]

const REFERENCE_DETAIL_BY_METHOD = {
  telebirr: 'Invoice No. only',
  dashen: 'IPSS reference only (VAT receipts)',
  cbe: 'FT reference + last 8 digits of sender account',
  boa: 'FT reference + last 5 digits of sender account',
}

const REFERENCE_FIELDS = {
  telebirr: [
    { key: 'transactionCode', label: 'Invoice No.', placeholder: 'DG65L5I9M5', hint: '10-character invoice number' },
  ],
  dashen: [
    { key: 'transactionCode', label: 'IPSS Reference', placeholder: '110IPSS2616900WO', hint: 'VAT receipt reference only — not Super App QR' },
  ],
  cbe: [
    { key: 'transactionCode', label: 'FT Reference', placeholder: 'FT26169D8C5M', hint: 'Transaction reference starting with FT' },
    { key: 'accountSuffix', label: 'Last 8 digits of sender account', placeholder: '12345678', hint: 'Last 8 digits of the account that sent the money (your CBE account)' },
  ],
  boa: [
    { key: 'transactionCode', label: 'FT Reference', placeholder: 'FT26169X4SRS', hint: 'Transaction reference starting with FT' },
    { key: 'accountSuffix', label: 'Last 5 digits of sender account', placeholder: '12345', hint: 'Last 5 digits of the account that sent the money (your BOA account)' },
  ],
}

const TX_PLACEHOLDERS = {
  telebirr: 'e.g. DG65L5I9M5',
  cbe: 'e.g. FT26169D8C5M',
  boa: 'e.g. FT26169X4SRS',
  dashen: 'e.g. 110IPSS2616900WO',
}

const SMS_SUPPORTED = new Set(['telebirr', 'cbe'])

const SMS_PLACEHOLDERS = {
  telebirr: `Dear customer
You have transferred ETB 60.00 to Receiver Name (2519****4025) on 17/06/2026 18:14:15. Your transaction number is DFH51OFIED...
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
  cbe: `Dear Petiros Asmamaw Abebe You have received ETB 2,000.00 from account 1**0947 (Sender Name) to your account 1**7112. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
}

const UPLOAD_HINTS = {
  telebirr: 'Full Telebirr receipt with Invoice No. visible (QR optional — we verify by payment ID)',
  cbe: 'CBE mobile success screen or VAT/web receipt with QR code at the bottom',
  boa: 'Bank of Abyssinia receipt with "Scan the QR to Verify"',
  dashen: 'Dashen receipt or "Successfully paid!" screen with QR code',
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
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: 'Please upload your receipt screenshot.' }])
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

  const referenceFields = REFERENCE_FIELDS[method] || []
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
    ? '✓ SMS verified successfully'
    : verifyMode === 'reference'
      ? '✓ Payment ID verified successfully'
      : '✓ Receipt verified successfully'

  const successSubtext = verifyMode === 'sms'
    ? 'SMS details matched the official bank receipt'
    : verifyMode === 'reference'
      ? 'Verified from official bank record (no screenshot)'
      : withDetails
        ? 'Verified with your entered details'
        : method === 'telebirr'
          ? 'Verified from screenshot via official Telebirr record'
          : 'Verified from screenshot & QR code'

  const previousVerification = (successCheck || lastResult)?.previousVerification || null
  const previousVerificationLabel = previousVerification?.verifiedBy === 'self'
    ? 'Already verified by you'
    : previousVerification?.verifiedBy === 'other'
      ? 'Already verified by another user'
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
    ? 'Free re-verification within 24 hours.'
    : 'You can view the existing verification result.'

  const showFormatGuide = step === 3 && method && ['screenshot', 'reference', 'sms'].includes(verifyMode)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Verify Receipt"
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
                Try Again
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">
                Close
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
                  {previousVerificationMeta ? ` Verified on ${previousVerificationMeta}.` : ''}
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
              <p className="text-[var(--text-xs)] font-semibold text-[var(--color-info)] mb-1">Balance Update</p>
              <p className="text-[var(--text-sm)] text-[var(--color-text-primary)]">
                {(successCheck || lastResult)?.isRecheck
                  ? 'No charge — free re-verification within 24 hours'
                  : `${(successCheck || lastResult)?.balanceDeducted || getCheckCostByAmount(summaryDetails?.amount)} Birr deducted from your account`}
              </p>
            </div>
            <button onClick={handleClose} className="btn-primary w-full">Complete</button>
          </div>
        ) : (
          <div className="modal-body space-y-5">
            {error && !rejected && (
              <div className="alert alert-error">
                <p className="font-semibold text-sm">{typeof error === 'string' ? error : error.message || 'Verification failed'}</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Step 1: Select Payment Method</p>
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Choose the bank from your receipt</p>
                </div>
                <div className="space-y-2">
                  {METHODS.map((m) => (
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
                    ← Back to Method
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 2: Choose Verification Type</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    Screenshot reads Invoice No. and verifies officially. Payment ID or SMS also works without an image.
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
                      <p className="font-semibold text-[var(--text-sm)]">Screenshot</p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">Upload receipt — we read Invoice No. and verify officially</p>
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
                      <p className="font-semibold text-[var(--text-sm)]">Payment ID only</p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">No screenshot — official bank lookup by reference</p>
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
                        <p className="font-semibold text-[var(--text-sm)]">Bank SMS</p>
                        <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">Paste the transaction SMS — we fetch the official receipt and compare</p>
                      </div>
                      <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-info)' }} />
                    </div>
                  </button>
                )}

                <div className="rounded-lg p-4 border text-[var(--text-xs)] font-mono leading-relaxed" style={{ background: 'var(--color-bg-subtle)', borderColor: 'var(--color-border)' }}>
                  <p className="font-semibold text-[var(--text-sm)] font-sans mb-2">Payment ID guide</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">Telebirr</span> → Invoice No. only</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">Dashen</span> → IPSS reference only (VAT receipts)</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">CBE</span> → FT reference + last 8 digits of sender account</p>
                  <p className="text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-primary)]">BOA</span> → FT reference + last 5 digits of sender account</p>
                  {SMS_SUPPORTED.has(method) && (
                    <p className="text-[var(--color-text-secondary)] mt-2 font-sans"><span className="text-[var(--color-text-primary)]">SMS</span> → paste full Telebirr or CBE transaction SMS with receipt link</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && verifyMode === 'screenshot' && (
              <div className="modal-split modal-split-bleed">
                <form onSubmit={handleQuickVerify} className="modal-split-main modal-split-main-pad space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(2)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    ← Back to Type
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 3: Upload Receipt Screenshot</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {method === 'telebirr'
                      ? 'We read the Invoice No. from your screenshot and verify it on the official Telebirr site. QR code is optional if the invoice number is visible.'
                      : 'We check the official bank QR code (must not be fake). Full screenshot: text + QR are compared. Cropped screenshot: QR code only.'}
                  </p>
                </div>

                <div>
                  <label className="label mb-3">Receipt Screenshot</label>
                  <div className="drop-zone p-8 text-center cursor-pointer">
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" required />
                    {preview ? (
                      <p className="text-sm font-semibold">✓ Screenshot uploaded</p>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={24} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
                        <p className="text-sm font-semibold">Upload receipt screenshot</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{UPLOAD_HINTS[method]}</p>
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
                    With Detail
                  </button>
                  <button type="submit" disabled={loading || !screenshot} className="btn-primary flex-1">
                    {loading && !withDetails ? 'Verifying...' : 'Verify'}
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
                    ← Back to Type
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 3: Enter Payment ID</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    We verify directly against the official bank record. Each payment ID can only be verified once.
                  </p>
                </div>

                <div className="rounded-lg p-3 border text-[var(--text-xs)]" style={{ background: 'var(--color-accent-muted)', borderColor: 'var(--color-accent-border)' }}>
                  <p className="font-semibold text-[var(--text-sm)] mb-1">
                    {METHODS.find((m) => m.id === method)?.label}
                  </p>
                  <p className="text-[var(--color-text-secondary)]">
                    {REFERENCE_DETAIL_BY_METHOD[method]}
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
                  {loading ? 'Verifying...' : 'Verify Payment ID'}
                </button>
                <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] text-center">
                  Cost: 2–20 Birr based on verified amount
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
                    ← Back to Type
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 3: Paste Transaction SMS</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    We parse the SMS, fetch the official receipt from the link inside it, and verify amount, account, and payment ID match.
                  </p>
                </div>

                <div>
                  <label className="label">Transaction SMS</label>
                  <textarea
                    className="input w-full min-h-[180px] font-mono text-[var(--text-xs)]"
                    placeholder={SMS_PLACEHOLDERS[method]}
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    required
                  />
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-2">
                    {method === 'telebirr'
                      ? 'Include the full message with transaction number and ethiotelecom.et/receipt link.'
                      : 'Include the full message with amount and mbreciept.cbe.com.et or BranchReceipt link.'}
                  </p>
                </div>

                <button type="submit" disabled={loading || smsText.trim().length < 40} className="btn-primary w-full">
                  {loading ? 'Verifying...' : 'Verify SMS'}
                </button>
                <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] text-center">
                  Cost: 2–20 Birr based on verified amount
                </p>
              </form>
              <VerificationFormatGuide method={method} mode="sms" />
              </div>
            )}

            {step === 4 && verifyMode === 'screenshot' && (
              <form onSubmit={handleDetailVerify} className="space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(3)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    ← Back to Screenshot
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 4: Enter Transaction Details</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    We will match your details against screenshot + QR when visible, or QR only if the image is cropped.
                  </p>
                </div>

                <ReceiptDetailFields form={form} onChange={handleChange} txPlaceholder={TX_PLACEHOLDERS[method]} />

                {form.amount && (
                  <div className="bg-[var(--color-info-muted)] rounded-lg p-3 border border-[var(--color-info)]">
                    <p className="text-[var(--text-xs)] font-semibold text-[var(--color-info)] mb-1">Verification Cost</p>
                    <p className="text-[var(--text-sm)]">This verification will cost {getCheckCostByAmount(form.amount)} Birr</p>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Verifying...' : 'Verify with Details'}
                </button>
              </form>
            )}
          </div>
        )}
    </Modal>
  )
}
