import { useState, useEffect } from 'react'
import { X, Smartphone, Building2, Upload, CheckCircle2, RotateCcw } from 'lucide-react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { VerificationFailureList } from './VerificationResult'
import ReceiptSummaryCard from './ReceiptSummaryCard'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, desc: 'Mobile wallet receipt' },
  { id: 'cbe', label: 'Commercial Bank of Ethiopia (CBE)', icon: Building2, desc: 'CBE mobile receipt' },
]

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE',
}

export default function TopUpModal({ isOpen, onClose, onSubmit, loading, error }) {
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('telebirr')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [successDetails, setSuccessDetails] = useState(null)
  const [receiverAccounts, setReceiverAccounts] = useState([])

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

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
  }

  const reset = () => {
    setStep(1)
    setMethod('telebirr')
    setScreenshot(null)
    setPreview(null)
    setRejected(false)
    setFailureIssues([])
    setSuccessDetails(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const runTopUp = async () => {
    if (!screenshot) {
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: 'Please upload your payment screenshot.' }])
      setRejected(true)
      return
    }

    setRejected(false)
    setFailureIssues([])

    const result = await onSubmit({ screenshot, method })

    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setSuccessDetails(result.resolvedDetails)
      setStep(3)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-lg">
        <div className="modal-header">
          <h2 className="section-title">Top Up Balance</h2>
          <button onClick={handleClose} className="btn-icon">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {rejected ? (
          <div className="modal-body space-y-5">
            <VerificationFailureList issues={failureIssues} />
            <div className="modal-footer gap-3">
              <button type="button" onClick={() => { setRejected(false); setStep(2) }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                <RotateCcw size={16} />
                Try Again
              </button>
              <button type="button" onClick={handleClose} className="btn-primary flex-1">Close</button>
            </div>
          </div>
        ) : step === 3 ? (
          <div className="modal-body space-y-5">
            <div className="card p-4 flex items-center gap-3" style={{ background: 'var(--color-success-muted)', borderColor: 'var(--color-success)', borderWidth: '2px' }}>
              <CheckCircle2 size={28} style={{ color: 'var(--color-success)' }} />
              <div>
                <p className="font-bold" style={{ color: 'var(--color-success)' }}>Top-up verified</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Payment confirmed from screenshot & QR code</p>
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
                        <div>
                          <p className="font-semibold text-sm">{m.label}</p>
                          <p className="text-xs text-[var(--color-text-secondary)]">{m.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={(e) => { e.preventDefault(); runTopUp() }} className="space-y-5">
                <button type="button" onClick={() => setStep(1)} className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>← Back</button>
                <p className="text-sm font-semibold">Step 2: Upload Payment Screenshot</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Send payment via {METHOD_LABELS[method]}, then upload the receipt. We verify the screenshot, QR code, and that payment was sent to your account below.
                </p>

                {selectedAccount && (
                  <div className="card p-4 space-y-2" style={{ background: 'var(--color-info-muted)', borderColor: 'var(--color-info)' }}>
                    <p className="text-xs font-semibold uppercase text-[var(--color-info)]">Send payment to</p>
                    <p className="text-sm font-semibold">{selectedAccount.receiverName}</p>
                    <p className="text-sm font-mono">{selectedAccount.receiverAccount}</p>
                  </div>
                )}

                <div className="relative border-2 border-dashed rounded-lg p-8 text-center" style={{ borderColor: 'var(--color-primary-border)', background: 'var(--color-primary-muted)' }}>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {preview ? <p className="text-sm font-semibold">✓ Screenshot ready</p> : (
                    <div className="space-y-2">
                      <Upload size={24} className="mx-auto" style={{ color: 'var(--color-primary)' }} />
                      <p className="text-sm font-semibold">Upload receipt screenshot</p>
                    </div>
                  )}
                </div>
                {preview && <img src={preview} alt="Preview" className="rounded-lg max-h-40 mx-auto border" />}

                <button type="submit" disabled={loading || !screenshot} className="btn-primary w-full">
                  {loading ? 'Processing...' : 'Verify & Top Up'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
