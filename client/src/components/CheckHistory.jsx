import { useMemo, useState } from 'react'
import { CheckCircle2, Clock, Search } from 'lucide-react'
import EmptyState from './EmptyState'
import CheckHistoryDetailModal from './CheckHistoryDetailModal'
import { useLocale } from '../i18n/LocaleContext'

const BANK_BADGE_CLASS = {
  telebirr: 'bank-badge-telebirr',
  cbe: 'bank-badge-cbe',
  boa: 'bank-badge-boa',
  dashen: 'bank-badge-dashen',
}

function BankBadge({ method, label }) {
  const badgeClass = BANK_BADGE_CLASS[method] || 'bank-badge-cbe'
  return <span className={`bank-badge ${badgeClass}`}>{label || method}</span>
}

export default function CheckHistory({ checks = [], loading = false }) {
  const { t } = useLocale()
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  const methodLabels = useMemo(() => ({
    telebirr: t('method.telebirr'),
    cbe: 'CBE',
    boa: t('method.boa'),
    dashen: t('method.dashen'),
  }), [t])

  const tierLabels = useMemo(() => ({
    verified: t('common.verified'),
    likely_valid: t('history.likelyValid'),
    suspicious: t('history.suspicious'),
  }), [t])

  const filtered = useMemo(() => {
    return checks.filter((check) => {
      const matchesMethod = methodFilter === 'all' || check.paymentMethod === methodFilter
      const q = search.trim().toLowerCase()
      const matchesSearch = !q
        || check.transactionCode?.toLowerCase().includes(q)
        || check.amount?.toString().includes(q)
      return matchesMethod && matchesSearch
    })
  }, [checks, search, methodFilter])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="skeleton skeleton-card" style={{ height: '60px' }} />)}
      </div>
    )
  }

  if (checks.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title={t('history.empty')}
        description={t('history.emptyHint')}
      />
    )
  }

  return (
    <>
      <div className="history-filters">
        <div className="relative flex-1 min-w-0 w-full sm:min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none" />
          <input
            type="search"
            className="input w-full pl-9"
            placeholder={t('history.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-full sm:w-auto sm:min-w-[9rem]" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="all">{t('history.allBanks')}</option>
          <option value="telebirr">Telebirr</option>
          <option value="cbe">CBE</option>
          <option value="boa">BOA</option>
          <option value="dashen">Dashen</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)] py-4 text-center">{t('history.noMatch')}</p>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border" style={{ borderColor: 'rgba(14, 36, 32, 0.12)' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('history.date')}</th>
                  <th>{t('history.method')}</th>
                  <th>{t('history.paymentId')}</th>
                  <th>{t('history.amount')}</th>
                  <th>{t('history.confidence')}</th>
                  <th>{t('history.cost')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((check) => (
                  <tr
                    key={check.id}
                    className="history-row-clickable"
                    onClick={() => setSelected(check)}
                  >
                    <td className="font-mono text-[var(--text-sm)]">
                      {new Date(check.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td>
                      <BankBadge method={check.paymentMethod} label={methodLabels[check.paymentMethod]} />
                    </td>
                    <td className="tx-mono">{check.transactionCode}</td>
                    <td className="amount-mono">{check.amount} ETB</td>
                    <td>
                      <span className={`confidence-badge confidence-badge--${check.confidenceTier || 'verified'}`}>
                        <CheckCircle2 size={11} />
                        {tierLabels[check.confidenceTier] || t('common.verified')}
                      </span>
                    </td>
                    <td className="font-mono font-medium text-[var(--color-text-secondary)]">
                      {check.isRecheck ? t('history.free') : `−${check.balanceDeducted}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden mobile-stack">
            {filtered.map((check) => (
              <button
                type="button"
                key={check.id}
                className="card history-mobile-card flex flex-col text-left w-full"
                onClick={() => setSelected(check)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="receipt-label mb-1">#{check.id} · {methodLabels[check.paymentMethod]}</p>
                    <p className="font-mono text-[13px] text-[var(--color-ink)] truncate">{check.transactionCode}</p>
                  </div>
                  <span className={`confidence-badge confidence-badge--${check.confidenceTier || 'verified'} flex-shrink-0`}>
                    {tierLabels[check.confidenceTier] || t('common.verified')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t" style={{ borderColor: 'rgba(14, 36, 32, 0.08)' }}>
                  <p className="amount-mono text-[14px]">{check.amount} ETB</p>
                  <p className="font-mono text-[13px] text-[var(--color-text-secondary)]">
                    {check.isRecheck ? t('history.freeRecheck') : `−${check.balanceDeducted} ${t('common.birr')}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <CheckHistoryDetailModal check={selected} onClose={() => setSelected(null)} />
    </>
  )
}
