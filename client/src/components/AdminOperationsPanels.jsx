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
    <div className="card overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
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

      <div className="md:hidden space-y-3">
        {checks.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">No verifications</p>
        )}
        {checks.map((c) => (
          <div key={c.id} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'rgba(14,36,32,0.1)' }}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-xs text-[var(--color-text-tertiary)]">#{c.id}</p>
              <p className="text-xs capitalize shrink-0">{(c.confidenceTier || 'verified').replace('_', ' ')}</p>
            </div>
            <p className="font-mono text-sm break-all">{c.transactionCode}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>{METHOD_LABELS[c.paymentMethod] || c.paymentMethod}</span>
              <span className="amount-mono">{c.amount} ETB</span>
              <span className="text-[var(--color-text-secondary)]">
                {c.isRecheck ? 'Free' : `−${c.balanceDeducted}`}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {format(new Date(c.createdAt), 'MMM d, yyyy')} · {c.userId?.slice(0, 8)}…
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminTopupsPanel({ topups = [] }) {
  return (
    <div className="card overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
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

      <div className="md:hidden space-y-3">
        {topups.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">No top-ups</p>
        )}
        {topups.map((t) => (
          <div key={t.id} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'rgba(14,36,32,0.1)' }}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-xs text-[var(--color-text-tertiary)]">#{t.id}</p>
              <span className="badge badge-success capitalize text-[10px]">{t.status}</span>
            </div>
            <p className="font-mono text-sm break-all">{t.transactionCode || '—'}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="amount-mono">{t.amount || '—'} ETB</span>
              <span>Units: {t.unitsAdded ?? '—'}</span>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {format(new Date(t.createdAt), 'MMM d, yyyy')} · {t.userId?.slice(0, 8)}…
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AdminBonusesPanel({ bonuses = [] }) {
  return (
    <div className="card overflow-hidden">
      <div className="hidden md:block overflow-x-auto">
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

      <div className="md:hidden space-y-3">
        {bonuses.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] text-center py-6">No bonuses</p>
        )}
        {bonuses.map((b) => (
          <div key={b.id} className="rounded-lg border p-3 space-y-1" style={{ borderColor: 'rgba(14,36,32,0.1)' }}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-xs text-[var(--color-text-tertiary)]">#{b.id}</p>
              <p className="font-semibold text-sm" style={{ color: 'var(--color-verified)' }}>+{b.amount} Birr</p>
            </div>
            <p className="text-sm break-words">{b.description}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">After: {b.balanceAfter} Birr</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {format(new Date(b.createdAt), 'MMM d, yyyy HH:mm')} · {b.userId?.slice(0, 8)}…
            </p>
          </div>
        ))}
      </div>
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
    <div className="card space-y-4 w-full max-w-lg">
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
      <button type="button" className="btn-primary w-full sm:w-auto" disabled={saving} onClick={handleSave}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  )
}
