import { useEffect, useState } from 'react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { Smartphone, Building2 } from 'lucide-react'

const BANKS = [
  { id: 'telebirr', label: 'Telebirr', icon: Smartphone, smsAvailable: true },
  { id: 'cbe', label: 'CBE', icon: Building2, smsAvailable: true },
  { id: 'boa', label: 'Bank of Abyssinia', icon: Building2, smsAvailable: true },
  { id: 'dashen', label: 'Dashen', icon: Building2, smsAvailable: false },
]

const MODES = [
  { key: 'screenshot', label: 'Screenshot', hint: 'Receipt photo check' },
  { key: 'reference', label: 'Payment ID', hint: 'FT, invoice, or slip ID' },
  { key: 'sms', label: 'SMS', hint: 'Paste bank SMS' },
]

function SwitchRow({ label, hint, on, disabled, onChange }) {
  return (
    <label className={`admin-channel-row ${on ? 'is-on' : ''} ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={on}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="admin-channel-switch" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? (
          <span className="block text-xs text-[var(--color-text-secondary)]">{hint}</span>
        ) : null}
      </span>
      <span className="admin-channel-state">{disabled ? 'N/A' : on ? 'On' : 'Off'}</span>
    </label>
  )
}

export default function AdminVerifyChannelsPanel() {
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      const res = await axios.get('/admin/settings/verify-channels')
      setCatalog(unwrap(res).catalog || {})
      setError(null)
    } catch (err) {
      setError('Failed to load bank verify controls')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const patchBank = async (method, patch) => {
    const previous = catalog
    setCatalog((cur) => ({
      ...cur,
      [method]: { ...cur[method], ...patch },
    }))
    try {
      setSaving(method)
      setSuccess(null)
      setError(null)
      const res = await axios.put(`/admin/settings/verify-channels/${method}`, patch)
      setCatalog(unwrap(res).catalog)
      const bank = BANKS.find((b) => b.id === method)
      setSuccess(`${bank?.label || method} updated`)
    } catch (err) {
      setCatalog(previous)
      setError(err.response?.data?.message || 'Failed to save')
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-48 rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="section-title text-base">Bank verify controls</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Turn a bank or a verify method off to hide it in the client checker (web and app). Off options are also blocked on the API.
        </p>
      </div>

      {error && <div className="alert alert-error"><p>{error}</p></div>}
      {success && (
        <p className="text-sm" style={{ color: 'var(--color-verified)' }}>{success}</p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {BANKS.map((bank) => {
          const row = catalog?.[bank.id] || { enabled: true, screenshot: true, reference: true, sms: bank.smsAvailable }
          const Icon = bank.icon
          return (
            <div key={bank.id} className="card space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={18} style={{ color: 'var(--color-primary)' }} />
                  <div>
                    <p className="font-semibold">{bank.label}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {saving === bank.id ? 'Saving…' : row.enabled ? 'Visible to clients' : 'Hidden from clients'}
                    </p>
                  </div>
                </div>
              </div>

              <SwitchRow
                label="Bank"
                hint="Hide this bank completely when off"
                on={Boolean(row.enabled)}
                onChange={(on) => patchBank(bank.id, { enabled: on })}
              />

              {MODES.map((mode) => (
                <SwitchRow
                  key={mode.key}
                  label={mode.label}
                  hint={mode.key === 'sms' && !bank.smsAvailable ? 'SMS is not supported for this bank' : mode.hint}
                  on={Boolean(row[mode.key])}
                  disabled={mode.key === 'sms' && !bank.smsAvailable}
                  onChange={(on) => patchBank(bank.id, { [mode.key]: on })}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
