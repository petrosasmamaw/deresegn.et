import { useState, useEffect } from 'react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { Smartphone, Building2, Save } from 'lucide-react'

const METHOD_META = {
  telebirr: { label: 'Telebirr', icon: Smartphone },
  cbe: { label: 'CBE', icon: Building2 },
}

export default function AdminAccountsPanel() {
  const [accounts, setAccounts] = useState([])
  const [forms, setForms] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const loadAccounts = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/admin/topup-accounts')
      const data = unwrap(res)
      const list = data.accounts || []
      setAccounts(list)
      const nextForms = {}
      list.forEach((account) => {
        nextForms[account.method] = {
          receiverName: account.receiverName || '',
          receiverAccount: account.receiverAccount || '',
        }
      })
      setForms(nextForms)
      setError(null)
    } catch (err) {
      setError('Failed to load top-up accounts')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const handleChange = (method, field, value) => {
    setForms((prev) => ({
      ...prev,
      [method]: { ...prev[method], [field]: value },
    }))
  }

  const handleSave = async (method) => {
    try {
      setSaving(method)
      setSuccess(null)
      setError(null)
      const payload = forms[method]
      const res = await axios.put(`/admin/topup-accounts/${method}`, payload)
      const data = unwrap(res)
      const updated = data.account
      setAccounts((prev) => prev.map((a) => (a.method === method ? updated : a)))
      setSuccess(`${METHOD_META[method]?.label || method} account updated`)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save account')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="card space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="skeleton h-32 rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="section-title">Top-Up Receiver Accounts</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-2">
          Clients top up using Telebirr or CBE only. Payments must be sent to these receiver names and accounts.
        </p>
      </div>

      {error && <div className="alert alert-error"><p>{error}</p></div>}
      {success && <div className="alert alert-success"><p>{success}</p></div>}

      <div className="grid md:grid-cols-2 gap-6">
        {accounts.map((account) => {
          const meta = METHOD_META[account.method] || { label: account.method, icon: Smartphone }
          const Icon = meta.icon
          const form = forms[account.method] || { receiverName: '', receiverAccount: '' }

          return (
            <div key={account.method} className="card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ background: 'var(--color-primary-muted)' }}>
                  <Icon size={20} style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <p className="font-semibold">{meta.label}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">Receiver account for top-up</p>
                </div>
              </div>

              <div>
                <label className="label">Receiver Name</label>
                <input
                  className="input"
                  value={form.receiverName}
                  onChange={(e) => handleChange(account.method, 'receiverName', e.target.value)}
                />
              </div>

              <div>
                <label className="label">Receiver Account</label>
                <input
                  className="input font-mono"
                  value={form.receiverAccount}
                  onChange={(e) => handleChange(account.method, 'receiverAccount', e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={() => handleSave(account.method)}
                disabled={saving === account.method}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Save size={16} />
                {saving === account.method ? 'Saving...' : 'Save Account'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
