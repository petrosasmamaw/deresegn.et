import { useState, useEffect } from 'react'
import { Smartphone, Building2, Upload, CheckCircle2, RotateCcw, ArrowRight, Camera, Hash, MessageSquare } from 'lucide-react'
import Modal from './Modal'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { VerificationFailureList } from './VerificationResult'
import ReceiptSummaryCard from './ReceiptSummaryCard'
import VerificationFormatGuide from './VerificationFormatGuide'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, desc: 'Mobile wallet payment' },
  { id: 'cbe', label: 'Commercial Bank of Ethiopia (CBE)', icon: Building2, desc: 'CBE bank transfer' },
]

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE',
}

const REFERENCE_DETAIL_BY_METHOD = {
  telebirr: 'Invoice No. only',
  cbe: 'FT reference + last 8 digits of sender account',
}

const REFERENCE_FIELDS = {
  telebirr: [
    { key: 'transactionCode', label: 'Invoice No.', placeholder: 'DG65L5I9M5', hint: '10-character invoice number' },
  ],
  cbe: [
    { key: 'transactionCode', label: 'FT Reference', placeholder: 'FT26169D8C5M', hint: 'Transaction reference starting with FT' },
    { key: 'accountSuffix', label: 'Last 8 digits of sender account', placeholder: '12345678', hint: 'Last 8 digits of the account that sent the money' },
  ],
}

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
  const referenceFields = REFERENCE_FIELDS[method] || []
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
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: 'Please upload your payment screenshot.' }])
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
    ? 'SMS matched official receipt and was sent to your account'
    : verifyMode === 'reference'
      ? 'Payment ID matched official record and was sent to your account'
      : method === 'telebirr'
        ? 'Payment confirmed from screenshot via official Telebirr record'
        : 'Payment confirmed from screenshot & QR code'

  if (!isOpen) return null

  const showFormatGuide = step === 3 && method && ['screenshot', 'reference', 'sms'].includes(verifyMode)

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Top Up Balance"
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
                Try Again
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">Close</button>
            </div>
          </div>
        ) : step === successStep ? (
          <div className="modal-body space-y-5">
            <div className="card p-4 flex items-center gap-3" style={{ background: 'var(--color-success-muted)', borderColor: 'var(--color-success)', borderWidth: '2px' }}>
              <CheckCircle2 size={28} style={{ color: 'var(--color-success)' }} />
              <div>
                <p className="font-bold" style={{ color: 'var(--color-success)' }}>Top-up verified</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{successSubtext}</p>
              </div>
            </div>
            {successDetails && <ReceiptSummaryCard details={successDetails} title="Payment Summary" />}
            <button onClick={handleClose} className="btn-primary w-full">Done</button>
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
                <p className="text-sm font-semibold">Step 1: Select Payment Method</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Top-up accepts Telebirr and CBE only</p>
                <div className="grid grid-cols-1 gap-3">
                  {METHODS.map((m) => (
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
                <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← Back</button>
                <p className="text-sm font-semibold">Step 2: Choose Verification Type</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Payment must be sent to your registered account below. We verify amount, payment ID, and receiver details.
                </p>

                {selectedAccount && (
                  <div className="card p-4 space-y-2" style={{ background: 'var(--color-info-muted)', borderColor: 'var(--color-info)' }}>
                    <p className="text-xs font-semibold uppercase text-[var(--color-info)]">Send payment to</p>
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
                      <p className="font-semibold text-sm">Screenshot</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">
                        {method === 'telebirr'
                          ? 'Upload receipt — Invoice No. verified officially'
                          : 'Upload receipt image'}
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
                      <p className="font-semibold text-sm">Payment ID only</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">Invoice / FT reference lookup</p>
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
                      <p className="font-semibold text-sm">Bank SMS</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">Paste transaction SMS with receipt link</p>
                    </div>
                    <ArrowRight size={16} className="ml-auto" style={{ color: 'var(--color-info)' }} />
                  </div>
                </button>
              </div>
            )}

            {step === 3 && verifyMode === 'screenshot' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={(e) => { e.preventDefault(); runTopUpScreenshot() }} className="modal-split-main modal-split-main-pad space-y-5">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← Back</button>
                <p className="text-sm font-semibold">Step 3: Upload Payment Screenshot</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Send payment via {METHOD_LABELS[method]} to the account above, then upload the receipt. Receiver name and account must match.
                  {method === 'telebirr' && ' We read the Invoice No. from your screenshot and verify it officially — QR code is optional.'}
                </p>

                <div className="drop-zone p-8 text-center cursor-pointer">
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {preview ? <p className="text-sm font-semibold">✓ Screenshot ready</p> : (
                    <div className="space-y-2">
                      <Upload size={24} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
                      <p className="text-sm font-semibold">Upload receipt screenshot</p>
                    </div>
                  )}
                </div>
                {preview && <img src={preview} alt="Preview" className="mt-3 rounded-lg border max-h-40 mx-auto object-contain w-full" />}

                <button type="submit" disabled={loading || !screenshot} className="btn-primary w-full">
                  {loading ? 'Processing...' : 'Verify & Top Up'}
                </button>
              </form>
              <VerificationFormatGuide method={method} mode="screenshot" />
              </div>
            )}

            {step === 3 && verifyMode === 'reference' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={runTopUpReference} className="modal-split-main modal-split-main-pad space-y-5">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← Back</button>
                <p className="text-sm font-semibold">Step 3: Enter Payment ID</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {REFERENCE_DETAIL_BY_METHOD[method]} — official record receiver must be your account above.
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
                  {loading ? 'Processing...' : 'Verify & Top Up'}
                </button>
              </form>
              <VerificationFormatGuide method={method} mode="reference" />
              </div>
            )}

            {step === 3 && verifyMode === 'sms' && (
              <div className="modal-split modal-split-bleed">
              <form onSubmit={runTopUpSms} className="modal-split-main modal-split-main-pad space-y-5">
                <button type="button" onClick={() => setStep(2)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← Back</button>
                <p className="text-sm font-semibold">Step 3: Paste Transaction SMS</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Paste the full SMS. We fetch the official receipt and confirm payment was sent to your account above.
                </p>

                <textarea
                  className="input w-full min-h-[180px] font-mono text-xs"
                  placeholder={SMS_PLACEHOLDERS[method]}
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                  required
                />

                <button type="submit" disabled={loading || smsText.trim().length < 40} className="btn-primary w-full">
                  {loading ? 'Processing...' : 'Verify & Top Up'}
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
