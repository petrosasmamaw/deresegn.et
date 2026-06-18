import { useState } from 'react'
import { X, Smartphone, Building2, CheckCircle2, RotateCcw, ArrowRight, Upload, ListChecks } from 'lucide-react'
import { VerificationFailureList, VerificationSuccessNote, VerificationWarningList } from './VerificationResult'
import ReceiptSummaryCard from './ReceiptSummaryCard'
import ReceiptDetailFields from './ReceiptDetailFields'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, desc: 'Mobile wallet receipt with Invoice No. & QR' },
  { id: 'cbe', label: 'Commercial Bank of Ethiopia (CBE)', icon: Building2, desc: 'CBE mobile success receipt with FT reference' },
  { id: 'boa', label: 'Bank of Abyssinia', icon: Building2, desc: 'BOA transfer receipt with FT reference' },
  { id: 'dashen', label: 'Dashen Bank', icon: Building2, desc: 'Dashen Super App receipt with IPSS reference' },
]

const TX_PLACEHOLDERS = {
  telebirr: 'e.g. DFC7TG1O11',
  cbe: 'e.g. FT26169D8C5M',
  boa: 'e.g. FT26169X4SRS',
  dashen: 'e.g. 110IPSS2616900WO',
}

const UPLOAD_HINTS = {
  telebirr: 'Full Telebirr receipt with QR code at the bottom',
  cbe: 'CBE success screen showing transaction ID and QR code',
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

export default function CheckerModal({ isOpen, onClose, onSubmit, loading, error, lastResult, lastResolvedDetails }) {
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [withDetails, setWithDetails] = useState(false)
  const [successDetails, setSuccessDetails] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }))
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
    setScreenshot(null)
    setPreview(null)
    setRejected(false)
    setFailureIssues([])
    setWithDetails(false)
    setSuccessDetails(null)
    setForm(EMPTY_FORM)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

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

  if (!isOpen) return null

  const summaryDetails = successDetails || lastResolvedDetails || (lastResult ? {
    senderName: lastResult.senderName,
    senderAccount: lastResult.senderAccount,
    receiverName: lastResult.receiverName,
    receiverAccount: lastResult.receiverAccount,
    amount: lastResult.amount,
    transactionCode: lastResult.transactionCode,
  } : null)

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg">
        <div className="modal-header">
          <h2 className="section-title">Verify Receipt</h2>
          <button onClick={handleClose} className="btn-icon">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {rejected ? (
          <div className="modal-body space-y-5">
            <VerificationFailureList issues={failureIssues} />
            <div className="modal-footer gap-3">
              <button type="button" onClick={() => { setRejected(false); setStep(withDetails ? 3 : 2) }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <RotateCcw size={16} strokeWidth={2} />
                Try Again
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">
                Close
              </button>
            </div>
          </div>
        ) : step === 4 ? (
          <div className="modal-body space-y-5">
            <VerificationSuccessNote message="✓ Receipt verified successfully" />
            <div className="card p-4" style={{ background: 'var(--color-success-muted)', borderColor: 'var(--color-success)', borderWidth: '2px' }}>
              <div className="flex items-center gap-4">
                <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} strokeWidth={2} />
                <div>
                  <p className="font-bold text-base" style={{ color: 'var(--color-success)' }}>Valid Receipt Confirmed</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {withDetails ? 'Verified with your entered details' : 'Verified from screenshot & QR code'}
                  </p>
                </div>
              </div>
            </div>
            {summaryDetails && <ReceiptSummaryCard details={summaryDetails} />}
            <VerificationWarningList issues={lastResult?.validationResult?.issues || []} />
            <div className="bg-[var(--color-info-muted)] rounded-lg p-3 border border-[var(--color-info)]">
              <p className="text-[var(--text-xs)] font-semibold text-[var(--color-info)] mb-1">Balance Update</p>
              <p className="text-[var(--text-sm)] text-[var(--color-text-primary)]">
                {lastResult?.balanceDeducted || getCheckCostByAmount(summaryDetails?.amount)} Birr deducted from your account
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
                        <div>
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
              <form onSubmit={handleQuickVerify} className="space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(1)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    ← Back to Method
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 2: Upload Receipt Screenshot</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    We will check the screenshot and official bank QR code.
                  </p>
                </div>

                <div>
                  <label className="label mb-3">Receipt Screenshot</label>
                  <div className="relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer" style={{ borderColor: 'var(--color-primary-border)', background: 'var(--color-primary-muted)' }}>
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
                    onClick={() => { setWithDetails(true); setStep(3) }}
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
            )}

            {step === 3 && (
              <form onSubmit={handleDetailVerify} className="space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(2)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    ← Back to Screenshot
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 3: Enter Transaction Details</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    We will match your details against the screenshot text and QR code.
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
      </div>
    </div>
  )
}
