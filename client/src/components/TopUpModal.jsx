import { useState } from 'react'
import { X, Smartphone, Building2 } from 'lucide-react'

const METHODS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone },
  { id: 'cbe', label: 'CBE Birr', icon: Building2 },
]

export default function TopUpModal({ isOpen, onClose, onSubmit, loading, error }) {
  const [method, setMethod] = useState('telebirr')
  const [screenshot, setScreenshot] = useState(null)
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
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body space-y-4">
          {error && <div className="alert alert-error">{typeof error === 'string' ? error : error.message}</div>}

          <div className="grid grid-cols-2 gap-3">
            {METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`card text-left ${method === m.id ? 'border-[var(--color-accent)]' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <m.icon size={18} style={{ color: 'var(--color-accent)' }} />
                  <span className="font-medium">{m.label}</span>
                </div>
              </button>
            ))}
          </div>

          <div>
            <label className="label">Payment Screenshot</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setScreenshot(e.target.files?.[0])}
              className="file-input"
              required
            />
            <p className="helper-text">Include the QR code at the bottom for Telebirr receipts</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Sender Name</label>
              <input
                type="text"
                value={form.senderName}
                onChange={(e) => handleChange('senderName', e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Sender Account</label>
              <input
                type="text"
                value={form.senderAccount}
                onChange={(e) => handleChange('senderAccount', e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Receiver Name</label>
              <input
                type="text"
                value={form.receiverName}
                onChange={(e) => handleChange('receiverName', e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Receiver Account</label>
              <input
                type="text"
                value={form.receiverAccount}
                onChange={(e) => handleChange('receiverAccount', e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Amount</label>
              <input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                className="input"
                required
              />
            </div>
            <div>
              <label className="label">Payment ID</label>
              <input
                type="text"
                value={form.transactionCode}
                onChange={(e) => handleChange('transactionCode', e.target.value)}
                className="input font-mono"
                placeholder="e.g. DFC7TG1O11"
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Processing…' : 'Submit Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
