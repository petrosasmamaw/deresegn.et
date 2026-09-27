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
    <main className="flex-1 landing-content-canvas min-h-screen relative overflow-x-hidden pt-8 sm:pt-14 pb-24 text-left">
      {/* Ambient background glows matching landing & verify pages */}
      <div className="absolute top-10 -left-20 w-96 h-96 bg-[#1B463A]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 -right-20 w-96 h-96 bg-[#C6A24E]/8 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 space-y-8 mt-2 sm:mt-4">
        {/* ── Page Header & Quick Navigation ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[rgba(27,70,58,0.12)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1B463A] hover:underline bg-white px-2.5 py-1 rounded-lg border border-[rgba(27,70,58,0.14)] shadow-2xs"
              >
                <ArrowLeft size={13} />
                <span>{t('nav.verify')}</span>
              </Link>
              <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#1B463A]/10 text-[#1B463A]">
                {t('ledger.eyebrow')}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#091A16] tracking-tight">
              {t('ledger.title')}
            </h1>
            <p className="text-xs sm:text-sm text-[#40564C] font-medium leading-relaxed max-w-2xl mt-1">
              {t('ledger.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={handleRefresh}
              className="px-3.5 py-2 rounded-xl border border-[rgba(27,70,58,0.18)] bg-white hover:bg-[#FAF8F5] text-[#1B463A] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
              title={t('common.refresh')}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              <span>{t('common.refresh')}</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredChecks.length === 0}
              className="px-4 py-2 rounded-xl border border-[rgba(27,70,58,0.18)] bg-white hover:bg-[#FAF8F5] text-[#091A16] text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all disabled:opacity-50"
            >
              <Download size={14} className="text-[#1B463A]" />
              <span>{t('common.exportCsv')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTopupOpen(true)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#C6A24E] to-[#B8933E] text-[#091A16] font-black text-xs flex items-center gap-1.5 shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <Wallet size={14} strokeWidth={2.5} />
              <span>{t('common.topUpBalance')}</span>
            </button>
          </div>
        </div>

        {/* ── Top Metrics Cards (4 Key Financial Indicators) ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Total Verified Volume */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[rgba(27,70,58,0.14)] p-3.5 sm:p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#40564C] truncate">
                {t('ledger.verifiedVolume')}
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={14} className="sm:hidden" strokeWidth={2.5} />
                <CheckCircle2 size={16} className="hidden sm:block" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono tabular-nums text-lg sm:text-3xl font-black text-[#091A16] tracking-tight">
                  {metrics.totalVerifiedVolume.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold text-[#1B463A] uppercase">ETB</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#40564C] font-semibold mt-1 line-clamp-1">
                {t('ledger.verifiedVolumeSub')}
              </p>
            </div>
          </div>

          {/* 2. Total Decreased Birr (Fees Paid) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[rgba(27,70,58,0.14)] p-3.5 sm:p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#40564C] truncate">
                {t('ledger.decreasedFees')}
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                <Coins size={14} className="sm:hidden" strokeWidth={2.5} />
                <Coins size={16} className="hidden sm:block" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono tabular-nums text-lg sm:text-3xl font-black text-[#B45309] tracking-tight">
                  −{metrics.totalFeesDeducted.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold text-[#B45309] uppercase">{t('common.birr')}</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#40564C] font-semibold mt-1 line-clamp-1">
                {t('ledger.decreasedFeesSub')}
              </p>
            </div>
          </div>

          {/* 3. Total Verifications Count */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[rgba(27,70,58,0.14)] p-3.5 sm:p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#40564C] truncate">
                {t('ledger.totalAudits')}
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-[#1B463A]/10 text-[#1B463A] flex items-center justify-center shrink-0">
                <FileSpreadsheet size={14} className="sm:hidden" strokeWidth={2.5} />
                <FileSpreadsheet size={16} className="hidden sm:block" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono tabular-nums text-lg sm:text-3xl font-black text-[#091A16] tracking-tight">
                  {metrics.totalCount}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold text-[#1B463A]">{t('ledger.checks')}</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#40564C] font-semibold mt-1 line-clamp-1">
                <span className="text-emerald-700 font-bold">{metrics.genuineCount} {t('ledger.genuineCount')}</span> ·{' '}
                <span className="text-red-700 font-bold">{metrics.tamperedCount} {t('ledger.flaggedCount')}</span>
              </p>
            </div>
          </div>

          {/* 4. Current Available Balance */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-[rgba(27,70,58,0.14)] p-3.5 sm:p-6 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#40564C] truncate">
                {t('ledger.balance')}
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 text-[#C6A24E] flex items-center justify-center shrink-0">
                <Wallet size={14} className="sm:hidden" strokeWidth={2.5} />
                <Wallet size={16} className="hidden sm:block" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono tabular-nums text-lg sm:text-3xl font-black text-[#091A16] tracking-tight">
                  {Number(balance || 0).toFixed(2)}
                </span>
                <span className="text-[10px] sm:text-xs font-extrabold text-[#1B463A] uppercase">ETB</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] sm:text-[11px] text-[#40564C] font-semibold">{t('ledger.active')}</p>
                <button
                  type="button"
                  onClick={() => setTopupOpen(true)}
                  className="text-[10px] sm:text-[11px] font-black text-[#1B463A] hover:underline cursor-pointer"
                >
                  {t('common.addTopUp')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bank Volume & Decreased Fee Distribution ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-[#091A16] uppercase tracking-wider">
              {t('ledger.bankDistribution')}
            </h2>
            <span className="text-[11px] font-bold text-[#40564C]">
              {t('ledger.bankDistributionSub')}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
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
                        {stat.count} {stat.count === 1 ? t('ledger.singleAudit') : t('ledger.auditsCount')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[rgba(27,70,58,0.06)] grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-[#40564C] font-semibold block">{t('ledger.volume')}</span>
                      <span className="font-mono tabular-nums font-bold text-[#091A16]">
                        {stat.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#40564C] font-semibold block">{t('ledger.decreased')}</span>
                      <span className="font-mono tabular-nums font-bold text-[#B45309]">
                        −{stat.fees.toFixed(1)} {t('common.birr')}
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
                  placeholder={t('ledger.searchPlaceholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Filter controls */}
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                {/* Bank Gateway Filter */}
                <select
                  className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
                  value={bankFilter}
                  onChange={(e) => setBankFilter(e.target.value)}
                >
                  <option value="all">{t('ledger.allBanks')}</option>
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
                  <option value="all">{t('ledger.allTime')}</option>
                  <option value="today">{t('ledger.today')}</option>
                  <option value="week">{t('ledger.thisWeek')}</option>
                  <option value="month">{t('ledger.thisMonth')}</option>
                </select>

                {/* Status Filter */}
                <select
                  className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">{t('ledger.allStatuses')}</option>
                  <option value="genuine">{t('ledger.genuine')}</option>
                  <option value="tampered">{t('ledger.tampered')}</option>
                </select>

                {/* Sort Filter */}
                <select
                  className="input py-2.5 px-3 rounded-xl bg-white border border-[rgba(27,70,58,0.15)] text-xs font-bold text-[#091A16] cursor-pointer"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">{t('ledger.newestFirst')}</option>
                  <option value="oldest">{t('ledger.oldestFirst')}</option>
                  <option value="highest_amount">{t('ledger.highestAmount')}</option>
                  <option value="highest_fee">{t('ledger.highestFee')}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#40564C] font-semibold pt-1">
              <span>{t('ledger.showingCount', { count: filteredChecks.length, total: checks.length })}</span>
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
                  className="text-xs font-bold text-[#1B463A] hover:underline cursor-pointer"
                >
                  {t('ledger.resetFilters')}
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
                title={t('ledger.noRecords')}
                description={t('ledger.noRecordsSub')}
              />
            </div>
          ) : filteredChecks.length === 0 ? (
            <div className="py-16 text-center text-xs font-semibold text-[#40564C]">
              {t('ledger.noMatch')}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#FAF8F5] border-b border-[rgba(27,70,58,0.1)] text-[11px] font-extrabold text-[#40564C] uppercase tracking-wider">
                      <th className="py-3.5 px-5">{t('ledger.colInvoice')}</th>
                      <th className="py-3.5 px-4">{t('ledger.colBank')}</th>
                      <th className="py-3.5 px-4">{t('ledger.colPayerTarget')}</th>
                      <th className="py-3.5 px-4 text-right">{t('ledger.colVerifiedAmount')}</th>
                      <th className="py-3.5 px-4 text-center">{t('ledger.colDecreasedBirr')}</th>
                      <th className="py-3.5 px-4">{t('ledger.colDateTime')}</th>
                      <th className="py-3.5 px-4">{t('ledger.colSecurityStatus')}</th>
                      <th className="py-3.5 px-5 text-right">{t('ledger.colAction')}</th>
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
                                {check.senderName || t('check.sender')}
                              </p>
                              <p className="text-[11px] text-[#40564C] truncate font-mono">
                                → {check.receiverName || check.receiverAccount || t('check.merchant')}
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
                                {t('check.freeRecheck')}
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-50 text-[#B45309] border border-amber-200">
                                −{check.balanceDeducted || 5} {t('common.birr')}
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
                                <span>{t('ledger.statusTampered')}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                                <ShieldCheck size={12} />
                                <span>{t('ledger.statusVerified')}</span>
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
                              <span>{t('common.inspect')}</span>
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
                            {t('ledger.statusTampered')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            {t('ledger.statusVerified')}
                          </span>
                        )}
                      </div>

                      <div className="text-xs">
                        <span className="text-[#40564C]">{t('check.party')} </span>
                        <span className="font-bold text-[#091A16]">{check.senderName || t('check.sender')}</span>
                        <span className="text-[#40564C] font-mono"> → {check.receiverName || check.receiverAccount || t('check.merchant')}</span>
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
                              {t('check.freeRecheck')}
                            </span>
                          ) : (
                            <span className="text-[11px] font-black text-[#B45309] bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              −{check.balanceDeducted || 5} {t('common.birr')}
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
