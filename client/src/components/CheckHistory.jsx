import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Eye,
  Filter,
} from 'lucide-react'
import EmptyState from './EmptyState'
import CheckHistoryDetailModal from './CheckHistoryDetailModal'
import { useLocale } from '../i18n/LocaleContext'

const BANK_LOGOS = {
  telebirr: '/banks/telebirr.jpg',
  cbe: '/banks/cbe.png',
  boa: '/banks/boa.jpg',
  dashen: '/banks/dashen.png',
}

export default function CheckHistory({
  checks = [],
  loading = false,
  error = null,
  onRetry,
}) {
  const { t } = useLocale()
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (!onRetry) return
    setRefreshing(true)
    try {
      await onRetry()
    } finally {
      setTimeout(() => setRefreshing(false), 600)
    }
  }

  const methodLabels = useMemo(() => ({
    telebirr: 'Telebirr',
    cbe: 'CBE',
    boa: 'Abyssinia',
    dashen: 'Dashen',
  }), [])

  const filtered = useMemo(() => {
    return checks.filter((check) => {
      // Bank filter
      const matchesMethod = methodFilter === 'all' || check.paymentMethod === methodFilter

      // Status filter
      const isTampered =
        check.confidenceTier === 'suspicious' ||
        check.status === 'failed' ||
        check.status === 'rejected' ||
        Boolean(check.isTampered)
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'genuine' && !isTampered) ||
        (statusFilter === 'tampered' && isTampered)

      // Search filter
      const q = search.trim().toLowerCase()
      const matchesSearch =
        !q ||
        check.transactionCode?.toLowerCase().includes(q) ||
        check.amount?.toString().includes(q) ||
        check.senderName?.toLowerCase().includes(q) ||
        check.receiverName?.toLowerCase().includes(q) ||
        check.senderAccount?.toLowerCase().includes(q) ||
        check.receiverAccount?.toLowerCase().includes(q)

      return matchesMethod && matchesStatus && matchesSearch
    })
  }, [checks, search, methodFilter, statusFilter])

  if (loading && checks.length === 0) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (error && checks.length === 0) {
    return (
      <div className="py-12 text-center p-6" role="alert">
        <p className="text-sm font-semibold text-red-600 mb-3">
          Failed to load verification history
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl bg-[#1B463A] text-white text-xs font-bold cursor-pointer"
          >
            Try Again
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="w-full text-left">
      {/* ── Filters & Controls Bar ── */}
      <div className="p-4 sm:p-5 border-b border-[rgba(27,70,58,0.1)] bg-[#FAF8F5]/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#40564C] pointer-events-none"
          />
          <input
            type="search"
            className="input w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-medium placeholder:text-[#40564C]/60"
            placeholder="Search by invoice ID, payer name, or account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Bank Gateway Filter */}
          <select
            className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
          >
            <option value="all">All Gateways</option>
            <option value="telebirr">Telebirr</option>
            <option value="cbe">CBE</option>
            <option value="boa">Abyssinia</option>
            <option value="dashen">Dashen</option>
          </select>

          {/* Status Filter */}
          <select
            className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="genuine">Verified Genuine</option>
            <option value="tampered">Tampered / Flagged</option>
          </select>

          {/* Refresh Button */}
          {onRetry && (
            <button
              type="button"
              onClick={handleRefresh}
              className="p-2.5 rounded-xl border border-[rgba(27,70,58,0.15)] bg-white hover:bg-[#FAF8F5] text-[#1B463A] cursor-pointer shadow-xs transition-transform active:scale-95"
              title="Refresh ledger"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* ── Table Content ── */}
      {checks.length === 0 ? (
        <div className="py-12">
          <EmptyState
            icon={Clock}
            title="No Verifications Yet"
            description="Your authenticated bank transactions and receipt audits will be stored securely here."
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs font-semibold text-[#40564C]">
          No verification records match your active search filters.
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[rgba(27,70,58,0.1)] text-[11px] font-extrabold text-[#40564C] uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Bank Gateway</th>
                  <th className="py-3 px-4">Payer & Target</th>
                  <th className="py-3 px-4 text-right">Amount (ETB)</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Integrity Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(27,70,58,0.06)] text-xs">
                {filtered.map((check) => {
                  const isTampered =
                    check.confidenceTier === 'suspicious' ||
                    check.status === 'failed' ||
                    check.status === 'rejected' ||
                    Boolean(check.isTampered)
                  const logo = BANK_LOGOS[check.paymentMethod] || BANK_LOGOS.telebirr

                  return (
                    <tr
                      key={check.id}
                      onClick={() => setSelected(check)}
                      className="hover:bg-[#FAF8F5]/80 cursor-pointer transition-colors"
                    >
                      {/* Invoice No */}
                      <td className="py-3.5 px-4 font-mono tabular-nums font-bold text-[#091A16]">
                        {check.transactionCode || `#${check.id}`}
                      </td>

                      {/* Bank Gateway */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-white p-0.5 border border-[rgba(27,70,58,0.1)] flex items-center justify-center shrink-0">
                            <img
                              src={logo}
                              alt=""
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <span className="font-extrabold text-[#091A16]">
                            {methodLabels[check.paymentMethod] || check.paymentMethod}
                          </span>
                        </div>
                      </td>

                      {/* Payer & Target */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-0 max-w-[200px]">
                          <p className="font-bold text-[#091A16] truncate">
                            {check.senderName || 'Sender'}
                          </p>
                          <p className="text-[11px] text-[#40564C] truncate font-mono">
                            → {check.receiverName || check.receiverAccount || 'Merchant'}
                          </p>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-black text-sm text-[#091A16]">
                        {check.amount} ETB
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-mono tabular-nums text-[11px] text-[#40564C]">
                        {new Date(check.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {isTampered ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-800 border border-red-200 uppercase tracking-wider">
                            <ShieldAlert size={12} />
                            <span>TAMPERED</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                            <ShieldCheck size={12} />
                            <span>VERIFIED</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelected(check)
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[rgba(27,70,58,0.2)] bg-white hover:bg-[#1B463A] hover:text-white text-[#1B463A] text-xs font-bold inline-flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile & Tablet Card Ledger */}
          <div className="lg:hidden divide-y divide-[rgba(27,70,58,0.08)]">
            {filtered.map((check) => {
              const isTampered =
                check.confidenceTier === 'suspicious' ||
                check.status === 'failed' ||
                check.status === 'rejected' ||
                Boolean(check.isTampered)
              const logo = BANK_LOGOS[check.paymentMethod] || BANK_LOGOS.telebirr

              return (
                <div
                  key={check.id}
                  onClick={() => setSelected(check)}
                  className="p-4 hover:bg-[#FAF8F5] cursor-pointer transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white p-1 border border-[rgba(27,70,58,0.1)] flex items-center justify-center shrink-0">
                        <img
                          src={logo}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div>
                        <span className="font-extrabold text-xs text-[#091A16] block">
                          {methodLabels[check.paymentMethod] || check.paymentMethod}
                        </span>
                        <span className="font-mono tabular-nums text-[11px] text-[#40564C]">
                          {check.transactionCode || `#${check.id}`}
                        </span>
                      </div>
                    </div>

                    {isTampered ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800">
                        TAMPERED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                        VERIFIED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[rgba(27,70,58,0.05)]">
                    <span className="font-mono tabular-nums font-black text-sm text-[#091A16]">
                      {check.amount} ETB
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-[#40564C]">
                      {new Date(check.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Forensic Inspection Modal */}
      <CheckHistoryDetailModal check={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
