import { useState } from 'react'
import { X, Smartphone, Building2, CheckCircle2, RotateCcw, ArrowRight, Upload } from 'lucide-react'
import { VerificationFailureList, VerificationSuccessNote, VerificationWarningList } from './VerificationResult'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, desc: 'Mobile wallet transfer' },
  { id: 'cbe', label: 'CBE Birr', icon: Building2, desc: 'Bank account transfer' },
]

export default function CheckerModal({ isOpen, onClose, onSubmit, loading, error, lastResult }) {
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [form, setForm] = useState({
    senderName: '',
    senderAccount: '',
    receiverName: '',
    receiverAccount: '',
    amount: '',
    transactionCode: '',
  })

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
    setForm({
      senderName: '',
      senderAccount: '',
      receiverName: '',
      receiverAccount: '',
      amount: '',
      transactionCode: '',
    })
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!screenshot) {
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: 'Please upload your receipt screenshot.' }])
      setRejected(true)
      return
    }

    setRejected(false)
    setFailureIssues([])

    const result = await onSubmit({ screenshot, method, form })
    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setStep(4)
    }
  }

  if (!isOpen) return null

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
              <button type="button" onClick={() => { setRejected(false); setStep(3) }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <RotateCcw size={16} strokeWidth={2} />
                Try Again
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">
                Close
              </button>
            </div>
          </div>
        ) : step === 4 && lastResult ? (
          <div className="modal-body space-y-5">
            <VerificationSuccessNote message="✓ Receipt verified successfully" />
            <div className="card p-4" style={{ background: 'var(--color-success-muted)', borderColor: 'var(--color-success)', borderWidth: '2px' }}>
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  <CheckCircle2 size={32} style={{ color: 'var(--color-success)' }} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base" style={{ color: 'var(--color-success)' }}>Valid Receipt Confirmed</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] font-mono mt-1">{lastResult.transactionCode}</p>
                </div>
              </div>
            </div>
            <VerificationWarningList issues={lastResult.validationResult?.issues || []} />
            <div className="bg-[var(--color-info-muted)] rounded-lg p-3 border border-[var(--color-info)]">
              <p className="text-[var(--text-xs)] font-semibold text-[var(--color-info)] mb-1">Balance Update</p>
              <p className="text-[var(--text-sm)] text-[var(--color-text-primary)]">5 Birr deducted from your account</p>
            </div>
            <button onClick={handleClose} className="btn-primary w-full">
              Complete
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body space-y-5">
            {error && !rejected && (
              <div className="alert alert-error">
                <p className="font-semibold text-sm">{typeof error === 'string' ? error : error.message || 'Verification failed'}</p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Step 1: Select Payment Method</p>
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">Choose the payment method from your receipt</p>
                </div>
                <div className="space-y-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMethod(m.id); setStep(2) }}
                      className="w-full card p-4 text-left cursor-pointer transition-all border-2"
                      style={{ borderColor: 'var(--color-border)' }}
                      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-border)'}
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
              <div className="space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(1)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    ← Back to Method
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 2: Transaction Details</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="label">Sender Name</label>
                    <input className="input" value={form.senderName} onChange={(e) => handleChange('senderName', e.target.value)} placeholder="Person sending money" required />
                  </div>
                  <div>
                    <label className="label">Sender Account</label>
                    <input className="input font-mono" value={form.senderAccount} onChange={(e) => handleChange('senderAccount', e.target.value)} placeholder="Phone or account number" required />
                  </div>
                  <div>
                    <label className="label">Receiver Name</label>
                    <input className="input" value={form.receiverName} onChange={(e) => handleChange('receiverName', e.target.value)} placeholder="Person receiving money" required />
                  </div>
                  <div>
                    <label className="label">Receiver Account</label>
                    <input className="input font-mono" value={form.receiverAccount} onChange={(e) => handleChange('receiverAccount', e.target.value)} placeholder="Phone or account number" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Amount (ETB)</label>
                      <input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => handleChange('amount', e.target.value)} placeholder="0.00" required />
                    </div>
                    <div>
                      <label className="label">Payment ID</label>
                      <input className="input font-mono" value={form.transactionCode} onChange={(e) => handleChange('transactionCode', e.target.value)} placeholder="e.g. DFC7TG1O11" required />
                    </div>
                  </div>
                </div>

                <button type="button" onClick={() => setStep(3)} className="btn-primary w-full flex items-center justify-center gap-2">
                  Next: Upload Receipt
                  <ArrowRight size={16} />
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <button type="button" onClick={() => setStep(2)} className="text-[var(--text-sm)] font-semibold mb-3" style={{ color: 'var(--color-primary)' }}>
                    ← Back to Details
                  </button>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Step 3: Upload Receipt Screenshot</p>
                </div>

                <div>
                  <label className="label mb-3">Receipt Screenshot</label>
                  <div className="relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors" style={{ borderColor: 'var(--color-primary-border)', background: 'var(--color-primary-muted)' }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFile}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      required
                    />
                    {preview ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">✓ Screenshot uploaded</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload size={24} className="mx-auto" style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Upload receipt screenshot</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">Must show QR code at bottom</p>
                      </div>
                    )}
                  </div>
                  {preview && (
                    <div className="mt-3">
                      <img src={preview} alt="Receipt preview" className="rounded-lg border border-[var(--color-border)] max-h-40 mx-auto object-contain w-full" />
                    </div>
                  )}
                  <p className="helper-text">JPG, PNG, or WebP • QR code required for verification</p>
                </div>

                <div className="modal-footer gap-3">
                  <button type="button" onClick={handleClose} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading || !screenshot} className="btn-primary flex-1">
                    {loading ? 'Verifying...' : 'Verify Receipt'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
