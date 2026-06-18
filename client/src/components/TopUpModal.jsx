import { useState } from 'react'
import { X, Smartphone, Building2, Upload } from 'lucide-react'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, desc: 'Mobile wallet receipt' },
  { id: 'cbe', label: 'Commercial Bank of Ethiopia (CBE)', icon: Building2, desc: 'CBE mobile receipt' },
  { id: 'boa', label: 'Bank of Abyssinia', icon: Building2, desc: 'BOA transfer receipt' },
  { id: 'dashen', label: 'Dashen Bank', icon: Building2, desc: 'Dashen Super App receipt' },
]

export default function TopUpModal({ isOpen, onClose, onSubmit, loading, error }) {
  const [method, setMethod] = useState('telebirr')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState({
    senderName: '',
    senderAccount: '',
    receiverName: '',
    receiverAccount: '',
    amount: '',
    transactionCode: '',
  })

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!screenshot) {
      alert('Please select a screenshot')
      return
    }
    onSubmit({ screenshot, form, method })
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="section-title">Top Up Balance</h2>
          <button onClick={onClose} className="btn-icon">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body space-y-6">
          {error && (
            <div className="alert alert-error">
              <p className="font-semibold">{typeof error === 'string' ? error : error.message}</p>
            </div>
          )}

          {/* Payment Method Selection */}
          <div className="space-y-3">
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`card p-4 text-left cursor-pointer transition-all ${
                    method === m.id 
                      ? 'border-2' 
                      : 'border border-[var(--color-border)]'
                  }`}
                  style={{
                    borderColor: method === m.id ? 'var(--color-primary)' : undefined,
                    background: method === m.id ? 'var(--color-primary-muted)' : 'var(--color-bg-elevated)'
                  }}
                >
                  <div className="flex items-center gap-3">
                    <m.icon 
                      size={20} 
                      style={{ color: method === m.id ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} 
                      strokeWidth={2}
                    />
                    <div>
                      <p className="font-semibold text-sm">{m.label}</p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">{m.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Screenshot Upload */}
          <div className="space-y-3">
            <label className="label">Payment Screenshot</label>
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
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Screenshot ready</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Click to change</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload size={24} className="mx-auto" style={{ color: 'var(--color-primary)' }} strokeWidth={2} />
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Upload receipt screenshot</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Include QR code at bottom</p>
                </div>
              )}
            </div>
            {preview && <img src={preview} alt="Preview" className="rounded-lg max-h-40 mx-auto border border-[var(--color-border)]" />}
            <p className="helper-text">JPG, PNG, or WebP • Must include QR code</p>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Sender Name</label>
                <input type="text" value={form.senderName} onChange={(e) => handleChange('senderName', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Sender Account</label>
                <input type="text" value={form.senderAccount} onChange={(e) => handleChange('senderAccount', e.target.value)} className="input font-mono" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Receiver Name</label>
                <input type="text" value={form.receiverName} onChange={(e) => handleChange('receiverName', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Receiver Account</label>
                <input type="text" value={form.receiverAccount} onChange={(e) => handleChange('receiverAccount', e.target.value)} className="input font-mono" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Amount (ETB)</label>
                <input type="number" step="0.01" value={form.amount} onChange={(e) => handleChange('amount', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Payment ID</label>
                <input type="text" value={form.transactionCode} onChange={(e) => handleChange('transactionCode', e.target.value)} className="input font-mono" placeholder="e.g. DFC7TG1O11" required />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Processing...' : 'Add Balance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
