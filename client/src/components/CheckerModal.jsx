import { useState } from 'react'
import { X, Smartphone, Building2, CheckCircle2, RotateCcw } from 'lucide-react'
import { VerificationFailureList, VerificationSuccessNote, VerificationWarningList } from './VerificationResult'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, desc: 'Telebirr mobile money receipt' },
  { id: 'cbe', label: 'CBE Birr', icon: Building2, desc: 'Commercial Bank of Ethiopia receipt' },
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
            <X size={20} />
          </button>
        </div>

        {rejected ? (
          <div className="modal-body space-y-4">
            <VerificationFailureList issues={failureIssues} />
            <div className="modal-footer">
              <button type="button" onClick={() => { setRejected(false); setStep(3) }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <RotateCcw size={16} />
                Try again
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">
                Close
              </button>
            </div>
          </div>
        ) : step === 4 && lastResult ? (
          <div className="modal-body space-y-4">
            <VerificationSuccessNote message="Receipt verified. Form, screenshot, and QR code all match." />
            <div className="card-header" style={{ background: 'var(--color-success-muted)', borderColor: 'var(--color-success)', borderLeftWidth: '4px' }}>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} style={{ color: 'var(--color-success)' }} />
                <div>
                  <p className="font-semibold" style={{ color: 'var(--color-success)' }}>Valid Receipt</p>
                  <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)] font-mono">{lastResult.transactionCode}</p>
                </div>
              </div>
            </div>
            <VerificationWarningList issues={lastResult.validationResult?.issues || []} />
            <p className="text-[var(--text-xs)] text-[var(--color-text-tertiary)]">
              5 units were deducted for this verification.
            </p>
            <button onClick={handleClose} className="btn-primary w-full">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-body space-y-4">
            {error && !rejected && (
              <div className="alert alert-error">
                {typeof error === 'string' ? error : error.message || 'Verification failed'}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-3">
                <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">
                  Choose the payment method shown on your receipt.
                </p>
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setMethod(m.id); setStep(2) }}
                    className="card w-full text-left hover:border-[var(--color-accent)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <m.icon size={22} style={{ color: 'var(--color-accent)' }} />
                      <div>
                        <p className="font-medium">{m.label}</p>
                        <p className="text-[var(--text-sm)] text-[var(--color-text-secondary)]">{m.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <button type="button" onClick={() => setStep(1)} className="text-[var(--text-sm)]" style={{ color: 'var(--color-accent)' }}>
                  ← Change method
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Sender name</label>
                    <input className="input" value={form.senderName} onChange={(e) => handleChange('senderName', e.target.value)} required />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Sender account</label>
                    <input className="input font-mono" value={form.senderAccount} onChange={(e) => handleChange('senderAccount', e.target.value)} required />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Receiver name</label>
                    <input className="input" value={form.receiverName} onChange={(e) => handleChange('receiverName', e.target.value)} required />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Receiver account</label>
                    <input className="input font-mono" value={form.receiverAccount} onChange={(e) => handleChange('receiverAccount', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Amount (ETB)</label>
                    <input type="number" step="0.01" className="input" value={form.amount} onChange={(e) => handleChange('amount', e.target.value)} required />
                  </div>
                  <div>
                    <label className="label">Payment ID</label>
                    <input className="input font-mono" value={form.transactionCode} onChange={(e) => handleChange('transactionCode', e.target.value)} placeholder="e.g. DFC7TG1O11" required />
                  </div>
                </div>
                <button type="button" onClick={() => setStep(3)} className="btn-primary w-full">
                  Continue to screenshot
                </button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <button type="button" onClick={() => setStep(2)} className="text-[var(--text-sm)]" style={{ color: 'var(--color-accent)' }}>
                  ← Edit details
                </button>
                <div>
                  <label className="label">Receipt screenshot</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFile}
                    className="file-input"
                    required
                  />
                  <p className="helper-text">
                    Upload a clear screenshot with the <strong>QR code visible at the bottom</strong>. We scan the QR, read the receipt with AI, and compare with your entered details.
                  </p>
                </div>
                {preview && (
                  <img src={preview} alt="Receipt preview" className="rounded-lg border border-[var(--color-border)] max-h-48 object-contain w-full" />
                )}
                <div className="modal-footer">
                  <button type="button" onClick={handleClose} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={loading || !screenshot} className="btn-primary flex-1">
                    {loading ? 'Verifying…' : 'Verify Receipt'}
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
