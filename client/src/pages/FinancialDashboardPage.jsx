import { useState, useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Download,
  Calendar,
  Layers,
  ArrowRight,
  ArrowLeft,
  Eye,
  CheckCircle2,
  Clock,
  Coins,
  FileSpreadsheet,
} from 'lucide-react'
import { fetchBalance, submitTopUp, submitTopUpReference, submitTopUpSms } from '../features/balance/balanceSlice'
import { fetchCheckHistory } from '../features/checks/checksSlice'
import TopUpModal from '../components/TopUpModal'
import CheckHistoryDetailModal from '../components/CheckHistoryDetailModal'
import EmptyState from '../components/EmptyState'
import { useLocale } from '../i18n/LocaleContext'

const BANK_LOGOS = {
  telebirr: '/banks/telebirr.jpg',
  cbe: '/banks/cbe.png',
  boa: '/banks/boa.jpg',
  dashen: '/banks/dashen.png',
}

const BANK_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'Commercial Bank of Ethiopia',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
}

export default function FinancialDashboardPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { t } = useLocale()

  const { current: balance, submitting: topupLoading, error: balanceError } = useSelector((s) => s.balance)
  const { list: checks, loading: checksLoading, error: checksError } = useSelector((s) => s.checks)

  const [topupOpen, setTopupOpen] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filters state
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  useEffect(() => {
    dispatch(fetchBalance())
    dispatch(fetchCheckHistory(100))
  }, [dispatch])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([dispatch(fetchBalance()), dispatch(fetchCheckHistory(100))])
    } finally {
      setTimeout(() => setRefreshing(false), 600)
    }
  }

  const handleTopUpSubmit = async ({ screenshot, method }) => {
    const result = await dispatch(submitTopUp({ screenshot, method }))
    if (submitTopUp.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return { success: true, resolvedDetails: result.payload.resolvedDetails }
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length ? issues : [{ message: payload.message || 'Top-up could not be verified' }],
    }
  }

  const handleTopUpReferenceSubmit = async ({ method, transactionCode, accountSuffix }) => {
    const result = await dispatch(submitTopUpReference({ method, transactionCode, accountSuffix }))
    if (submitTopUpReference.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return { success: true, resolvedDetails: result.payload.resolvedDetails }
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length ? issues : [{ message: payload.message || 'Top-up could not be verified' }],
    }
  }

  const handleTopUpSmsSubmit = async ({ method, smsText }) => {
    const result = await dispatch(submitTopUpSms({ method, smsText }))
    if (submitTopUpSms.fulfilled.match(result)) {
      dispatch(fetchBalance())
      return { success: true, resolvedDetails: result.payload.resolvedDetails }
    }
    const payload = result.payload || {}
    const issues = payload.data?.issues || payload.issues || []
    return {
      failed: true,
      issues: issues.length ? issues : [{ message: payload.message || 'Top-up could not be verified' }],
    }
  }

  // Filtered & Sorted Checks
  const filteredChecks = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    return checks
      .filter((check) => {
        // Bank filter
        if (bankFilter !== 'all' && check.paymentMethod !== bankFilter) return false

        // Status filter
        const isTampered =
          check.confidenceTier === 'suspicious' ||
          check.status === 'failed' ||
          check.status === 'rejected' ||
          Boolean(check.isTampered)
        if (statusFilter === 'genuine' && isTampered) return false
        if (statusFilter === 'tampered' && !isTampered) return false

        // Time filter
        if (timeFilter !== 'all') {
          const checkTime = new Date(check.createdAt).getTime()
          if (timeFilter === 'today' && checkTime < todayStart) return false
          if (timeFilter === 'week' && checkTime < weekStart) return false
          if (timeFilter === 'month' && checkTime < monthStart) return false
        }

        // Search text
        const q = search.trim().toLowerCase()
        if (q) {
          const matchCode = check.transactionCode?.toLowerCase().includes(q)
          const matchSender = check.senderName?.toLowerCase().includes(q)
          const matchReceiver = check.receiverName?.toLowerCase().includes(q)
          const matchSenderAcc = check.senderAccount?.toLowerCase().includes(q)
          const matchReceiverAcc = check.receiverAccount?.toLowerCase().includes(q)
          const matchAmount = check.amount?.toString().includes(q)
          if (!matchCode && !matchSender && !matchReceiver && !matchSenderAcc && !matchReceiverAcc && !matchAmount) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
        if (sortBy === 'highest_amount') return (Number(b.amount) || 0) - (Number(a.amount) || 0)
        if (sortBy === 'highest_fee') return (Number(b.balanceDeducted) || 0) - (Number(a.balanceDeducted) || 0)
        return 0
      })
  }, [checks, search, bankFilter, timeFilter, statusFilter, sortBy])

  // Top Financial Metrics Computed
  const metrics = useMemo(() => {
    let totalVerifiedVolume = 0
    let totalFeesDeducted = 0
    let genuineCount = 0
    let tamperedCount = 0

    // Bank breakdowns
    const bankStats = {
      telebirr: { volume: 0, fees: 0, count: 0 },
      cbe: { volume: 0, fees: 0, count: 0 },
      boa: { volume: 0, fees: 0, count: 0 },
      dashen: { volume: 0, fees: 0, count: 0 },
    }

    checks.forEach((c) => {
      const amt = Number(c.amount) || 0
      const fee = Number(c.balanceDeducted) || 0
      const isTampered =
        c.confidenceTier === 'suspicious' ||
        c.status === 'failed' ||
        c.status === 'rejected' ||
        Boolean(c.isTampered)

      totalVerifiedVolume += amt
      totalFeesDeducted += fee

      if (isTampered) {
        tamperedCount++
      } else {
        genuineCount++
      }

      const method = c.paymentMethod
      if (bankStats[method]) {
        bankStats[method].volume += amt
        bankStats[method].fees += fee
        bankStats[method].count += 1
      }
    })

    return {
      totalVerifiedVolume,
      totalFeesDeducted,
      totalCount: checks.length,
      genuineCount,
      tamperedCount,
      bankStats,
    }
  }, [checks])

  // Export CSV Function
  const handleExportCsv = () => {
    if (filteredChecks.length === 0) return

    const headers = [
      'Invoice No',
      'Bank Gateway',
      'Payer Name',
      'Payer Account',
      'Recipient Name',
      'Recipient Account',
      'Verified Amount (ETB)',
      'Decreased Birr Fee',
      'Date & Time',
      'Status',
    ]

    const rows = filteredChecks.map((c) => {
      const isTampered =
        c.confidenceTier === 'suspicious' ||
        c.status === 'failed' ||
        c.status === 'rejected' ||
        Boolean(c.isTampered)
      return [
        `"${c.transactionCode || c.id}"`,
        `"${BANK_LABELS[c.paymentMethod] || c.paymentMethod}"`,
        `"${c.senderName || ''}"`,
        `"${c.senderAccount || ''}"`,
        `"${c.receiverName || ''}"`,
        `"${c.receiverAccount || ''}"`,
        c.amount || 0,
        c.isRecheck ? 0 : c.balanceDeducted || 0,
        `"${new Date(c.createdAt).toISOString()}"`,
        `"${isTampered ? 'TAMPERED' : 'VERIFIED GENUINE'}"`,
      ]
    })

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tamagn-financial-ledger-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="flex-1 landing-content-canvas min-h-screen relative overflow-x-hidden pt-6 sm:pt-9 pb-24 text-left">
      {/* Ambient background glows matching landing & verify pages */}
      <div className="absolute top-10 -left-20 w-96 h-96 bg-[#1B463A]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -right-20 w-96 h-96 bg-[#C6A24E]/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 space-y-8">
        {/* ── Page Header & Quick Navigation ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[rgba(27,70,58,0.12)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B463A] hover:underline bg-white px-2.5 py-1 rounded-lg border border-[rgba(27,70,58,0.14)] shadow-2xs"
              >
                <ArrowLeft size={13} />
                <span>Verify Desk</span>
              </Link>
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1B463A]/10 text-[#1B463A]">
                Financial Intelligence
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#091A16] tracking-tight">
              Financial Dashboard & Verification Ledger
            </h1>
            <p className="text-xs sm:text-sm text-[#40564C] font-medium leading-relaxed max-w-2xl mt-1">
              Real-time audit overview of total verified transaction volumes, decreased Birr service fees, and bank settlement records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleRefresh}
              className="px-3.5 py-2 rounded-xl border border-[rgba(27,70,58,0.18)] bg-white hover:bg-[#FAF8F5] text-[#1B463A] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
              title="Refresh ledger"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredChecks.length === 0}
              className="px-4 py-2 rounded-xl border border-[rgba(27,70,58,0.18)] bg-white hover:bg-[#FAF8F5] text-[#091A16] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
            >
              <Download size={14} className="text-[#1B463A]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={() => setTopupOpen(true)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#C6A24E] to-[#B8933E] text-[#091A16] font-black text-xs flex items-center gap-1.5 shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <Wallet size={14} strokeWidth={2.5} />
              <span>Top Up Balance</span>
            </button>
          </div>
        </div>

        {/* ── Top Metrics Cards (4 Key Financial Indicators) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Verified Volume */}
          <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#40564C]">
                Total Verified Volume
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={16} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-[#091A16] tracking-tight">
                {metrics.totalVerifiedVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-extrabold text-[#1B463A] uppercase">ETB</span>
            </div>
            <p className="text-[11px] text-[#40564C] font-semibold mt-1">
              Total transaction funds authenticated
            </p>
          </div>

          {/* 2. Total Decreased Birr (Fees Paid) */}
          <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#40564C]">
                Total Decreased Fees
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                <Coins size={16} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-[#B45309] tracking-tight">
                −{metrics.totalFeesDeducted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-xs font-extrabold text-[#B45309] uppercase">Birr</span>
            </div>
            <p className="text-[11px] text-[#40564C] font-semibold mt-1">
              Service charges decreased across all checks
            </p>
          </div>

          {/* 3. Total Verifications Count */}
          <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#40564C]">
                Verification Audits
              </span>
              <div className="w-8 h-8 rounded-xl bg-[#1B463A]/10 text-[#1B463A] flex items-center justify-center">
                <FileSpreadsheet size={16} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-[#091A16] tracking-tight">
                {metrics.totalCount}
              </span>
              <span className="text-xs font-extrabold text-[#1B463A]">Checks</span>
            </div>
            <p className="text-[11px] text-[#40564C] font-semibold mt-1">
              <span className="text-emerald-700 font-bold">{metrics.genuineCount} Genuine</span> ·{' '}
              <span className="text-red-700 font-bold">{metrics.tamperedCount} Tampered</span>
            </p>
          </div>

          {/* 4. Current Available Balance */}
          <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-5 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#40564C]">
                Available Balance
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#C6A24E] flex items-center justify-center">
                <Wallet size={16} strokeWidth={2.5} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono tabular-nums text-2xl sm:text-3xl font-black text-[#091A16] tracking-tight">
                {Number(balance || 0).toFixed(2)}
              </span>
              <span className="text-xs font-extrabold text-[#1B463A] uppercase">ETB</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[11px] text-[#40564C] font-semibold">Active live balance</p>
              <button
                type="button"
                onClick={() => setTopupOpen(true)}
                className="text-[11px] font-black text-[#1B463A] hover:underline"
              >
                + Top Up
              </button>
            </div>
          </div>
        </div>

        {/* ── Bank Volume & Decreased Fee Distribution ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#091A16] uppercase tracking-wider">
              Bank Gateway Distribution
            </h2>
            <span className="text-[11px] font-bold text-[#40564C]">
              Real-time settlement metrics
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {Object.keys(BANK_LABELS).map((bankKey) => {
              const stat = metrics.bankStats[bankKey] || { volume: 0, fees: 0, count: 0 }
              const logo = BANK_LOGOS[bankKey]
              const name = BANK_LABELS[bankKey]

              return (
                <div
                  key={bankKey}
                  className="bg-white rounded-2xl border border-[rgba(27,70,58,0.12)] p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white p-1 border border-[rgba(27,70,58,0.1)] flex items-center justify-center shrink-0">
                      <img src={logo} alt="" className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                      <span className="font-extrabold text-xs text-[#091A16] truncate block">
                        {name}
                      </span>
                      <span className="font-mono text-[10px] text-[#40564C]">
                        {stat.count} {stat.count === 1 ? 'audit' : 'audits'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[rgba(27,70,58,0.06)] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[#40564C] font-semibold block">Volume</span>
                      <span className="font-mono tabular-nums font-bold text-[#091A16]">
                        {stat.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#40564C] font-semibold block">Decreased</span>
                      <span className="font-mono tabular-nums font-bold text-[#B45309]">
                        −{stat.fees.toFixed(1)} Birr
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Verifications Audit Ledger & Interactive Filters ── */}
        <div className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] overflow-hidden shadow-sm">
          {/* Filters Bar */}
          <div className="p-4 sm:p-6 border-b border-[rgba(27,70,58,0.1)] bg-[#FAF8F5]/70 space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-[220px]">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#40564C] pointer-events-none"
                />
                <input
                  type="search"
                  className="input w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-medium placeholder:text-[#40564C]/60"
                  placeholder="Search invoice ID, payer, recipient, account, or amount..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Bank Gateway Filter */}
                <select
                  className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                >
                  <option value="all">All Banks</option>
                  <option value="telebirr">Telebirr</option>
                  <option value="cbe">CBE</option>
                  <option value="boa">Abyssinia</option>
                  <option value="dashen">Dashen</option>
                </select>

                {/* Time Range Filter */}
                <select
                  className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
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

                {/* Sort Filter */}
                <select
                  className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest_amount">Highest Amount</option>
                  <option value="highest_fee">Highest Fee</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#40564C] font-semibold pt-1">
              <span>Showing {filteredChecks.length} of {checks.length} verifications</span>
              {(search || bankFilter !== 'all' || timeFilter !== 'all' || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setBankFilter('all')
                    setTimeFilter('all')
                    setStatusFilter('all')
                    setSortBy('newest')
                  }}
                  className="text-xs font-bold text-[#1B463A] hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>
          </div>

          {/* Ledger Table */}
          {checksLoading && checks.length === 0 ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : checks.length === 0 ? (
            <div className="py-16">
              <EmptyState
                icon={Clock}
                title="No Verification Records"
                description="Your transaction receipts and decreased verification fees will appear here once you begin checking receipts."
              />
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="py-16 text-center text-xs font-semibold text-[#40564C]">
              No verification records match your active search and time filters.
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[rgba(27,70,58,0.1)] text-[11px] font-extrabold text-[#40564C] uppercase tracking-wider">
                      <th className="py-3.5 px-5">Invoice Reference</th>
                      <th className="py-3.5 px-4">Bank Gateway</th>
                      <th className="py-3.5 px-4">Payer & Target</th>
                      <th className="py-3.5 px-4 text-right">Verified Amount</th>
                      <th className="py-3.5 px-4 text-center">Decreased Birr</th>
                      <th className="py-3.5 px-4">Date & Time</th>
                      <th className="py-3.5 px-4">Security Status</th>
                      <th className="py-3.5 px-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(27,70,58,0.06)] text-xs">
                    {filteredChecks.map((check) => {
                      const isTampered =
                        check.confidenceTier === 'suspicious' ||
                        check.status === 'failed' ||
                        check.status === 'rejected' ||
                        Boolean(check.isTampered)
                      const logo = BANK_LOGOS[check.paymentMethod] || BANK_LOGOS.telebirr

                      return (
                        <tr
                          key={check.id}
                          onClick={() => setSelectedCheck(check)}
                          className="hover:bg-[#FAF8F5]/80 cursor-pointer transition-colors"
                        >
                          {/* Invoice */}
                          <td className="py-4 px-5 font-mono tabular-nums font-bold text-[#091A16]">
                            {check.transactionCode || `#${check.id}`}
                          </td>

                          {/* Bank */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-white p-1 border border-[rgba(27,70,58,0.1)] flex items-center justify-center shrink-0">
                                <img src={logo} alt="" className="w-full h-full object-contain" />
                              </div>
                              <span className="font-extrabold text-[#091A16]">
                                {BANK_LABELS[check.paymentMethod] || check.paymentMethod}
                              </span>
                            </div>
                          </td>

                          {/* Payer & Receiver */}
                          <td className="py-4 px-4">
                            <div className="min-w-0 max-w-[210px]">
                              <p className="font-bold text-[#091A16] truncate">
                                {check.senderName || 'Sender'}
                              </p>
                              <p className="text-[11px] text-[#40564C] truncate font-mono">
                                → {check.receiverName || check.receiverAccount || 'Merchant'}
                              </p>
                            </div>
                          </td>

                          {/* Verified Amount */}
                          <td className="py-4 px-4 text-right font-mono tabular-nums font-black text-sm text-[#091A16]">
                            {Number(check.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                          </td>

                          {/* Decreased Birr (Fee) */}
                          <td className="py-4 px-4 text-center">
                            {check.isRecheck ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                                Free Recheck
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-[#B45309] border border-amber-200">
                                −{check.balanceDeducted || 5} Birr
                              </span>
                            )}
                          </td>

                          {/* Date & Time */}
                          <td className="py-4 px-4 font-mono tabular-nums text-[11px] text-[#40564C]">
                            {new Date(check.createdAt).toLocaleString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>

                          {/* Status */}
                          <td className="py-4 px-4">
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
                          <td className="py-4 px-5 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedCheck(check)
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

              {/* Mobile / Tablet Cards View */}
              <div className="lg:hidden divide-y divide-[rgba(27,70,58,0.08)]">
                {filteredChecks.map((check) => {
                  const isTampered =
                    check.confidenceTier === 'suspicious' ||
                    check.status === 'failed' ||
                    check.status === 'rejected' ||
                    Boolean(check.isTampered)
                  const logo = BANK_LOGOS[check.paymentMethod] || BANK_LOGOS.telebirr

                  return (
                    <div
                      key={check.id}
                      onClick={() => setSelectedCheck(check)}
                      className="p-4 hover:bg-[#FAF8F5] cursor-pointer transition-colors space-y-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-white p-1 border border-[rgba(27,70,58,0.1)] flex items-center justify-center shrink-0">
                            <img src={logo} alt="" className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <span className="font-extrabold text-xs text-[#091A16] block">
                              {BANK_LABELS[check.paymentMethod] || check.paymentMethod}
                            </span>
                            <span className="font-mono tabular-nums text-[11px] text-[#40564C]">
                              {check.transactionCode || `#${check.id}`}
                            </span>
                          </div>
                        </div>

                        {isTampered ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-800">
                            TAMPERED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            VERIFIED
                          </span>
                        )}
                      </div>

                      <div className="text-xs">
                        <span className="text-[#40564C]">Party: </span>
                        <span className="font-bold text-[#091A16]">{check.senderName || 'Sender'}</span>
                        <span className="text-[#40564C] font-mono"> → {check.receiverName || check.receiverAccount || 'Merchant'}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-[rgba(27,70,58,0.06)]">
                        <div>
                          <span className="font-mono tabular-nums font-black text-sm text-[#091A16]">
                            {Number(check.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ETB
                          </span>
                          <span className="text-[10px] text-[#40564C] block font-mono">
                            {new Date(check.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        <div>
                          {check.isRecheck ? (
                            <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                              Free Recheck
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-[#B45309] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              −{check.balanceDeducted || 5} Birr
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Inspection Modal ── */}
      <CheckHistoryDetailModal check={selectedCheck} onClose={() => setSelectedCheck(null)} />

      {/* ── Top Up Modal ── */}
      <TopUpModal
        isOpen={topupOpen}
        onClose={() => setTopupOpen(false)}
        onSubmit={handleTopUpSubmit}
        onReferenceSubmit={handleTopUpReferenceSubmit}
        onSmsSubmit={handleTopUpSmsSubmit}
        loading={topupLoading}
        error={balanceError}
      />
    </main>
  )
}
