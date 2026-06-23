import { useState } from 'react'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { format } from 'date-fns'

const METHOD_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE',
  boa: 'BOA',
  dashen: 'Dashen',
}

export function AdminVerificationsPanel({ checks = [] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Method</th>
            <th>Payment ID</th>
            <th>Amount</th>
            <th>Tier</th>
            <th>Cost</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={c.id}>
              <td className="font-mono">#{c.id}</td>
              <td className="font-mono text-xs">{c.userId?.slice(0, 8)}…</td>
              <td>{METHOD_LABELS[c.paymentMethod] || c.paymentMethod}</td>
              <td className="tx-mono">{c.transactionCode}</td>
              <td>{c.amount} ETB</td>
              <td className="capitalize">{(c.confidenceTier || 'verified').replace('_', ' ')}</td>
              <td>{c.isRecheck ? 'Free' : `−${c.balanceDeducted}`}</td>
              <td>{format(new Date(c.createdAt), 'MMM d, yyyy')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminTopupsPanel({ topups = [] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Payment ID</th>
            <th>Units</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {topups.map((t) => (
            <tr key={t.id}>
              <td className="font-mono">#{t.id}</td>
              <td className="font-mono text-xs">{t.userId?.slice(0, 8)}…</td>
              <td className="capitalize">{t.status}</td>
              <td>{t.amount || '—'} ETB</td>
              <td className="tx-mono">{t.transactionCode || '—'}</td>
              <td>{t.unitsAdded ?? '—'}</td>
              <td>{format(new Date(t.createdAt), 'MMM d, yyyy')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminBonusesPanel({ bonuses = [] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Amount</th>
            <th>Balance After</th>
            <th>Description</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {bonuses.map((b) => (
            <tr key={b.id}>
              <td className="font-mono">#{b.id}</td>
              <td className="font-mono text-xs">{b.userId?.slice(0, 8)}…</td>
              <td className="font-semibold" style={{ color: 'var(--color-verified)' }}>+{b.amount} Birr</td>
              <td>{b.balanceAfter} Birr</td>
              <td>{b.description}</td>
              <td>{format(new Date(b.createdAt), 'MMM d, yyyy HH:mm')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminBonusSettingsPanel({ settings, onUpdated }) {
  const [amount, setAmount] = useState(settings?.amount ?? 20)
  const [enabled, setEnabled] = useState(settings?.enabled ?? true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await axios.put('/admin/settings/registration-bonus', { amount, enabled })
      unwrap(res)
      setMessage('Settings saved')
      onUpdated?.()
    } catch {
      setMessage('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-4 max-w-lg">
      <div>
        <h3 className="section-title text-base">Registration Bonus</h3>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Granted once per new user. Tracked as registration bonus in the ledger (not counted as top-up revenue).
        </p>
      </div>
      <div>
        <label className="label">Bonus amount (Birr)</label>
        <input type="number" min="0" step="1" className="input w-full" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Enable registration bonus for new users
      </label>
      {message && <p className="text-sm">{message}</p>}
      <button type="button" className="btn-primary" disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  )
}
