import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  RotateCcw,
  Upload,
  Hash,
  Camera,
  MessageSquare,
  Check,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  FileUp,
  Lock,
} from 'lucide-react'
import Modal from './Modal'
import { VerificationFailureList, VerificationWarningList } from './VerificationResult'
import VerificationCertificate from './VerificationCertificate'
import { useLocale } from '../i18n/LocaleContext'
import axios from '../api/axiosInstance'
import { unwrap } from '../api/unwrap'
import { clearError } from '../features/checks/checksSlice'

function isCbeTokenLike(value) {
  const v = String(value || '').trim()
  return /mbreciept\.cbe\.com\.et/i.test(v) || /^v2-[A-Za-z0-9_-]{8,}/i.test(v)
}

function isCbeFtLike(value) {
  return /^FT[A-Z0-9]{8,}/i.test(String(value || '').trim().replace(/\s+/g, ''))
}

// Actual images present in public/banks
const BANK_LOGOS = {
  telebirr: '/banks/telebirr.jpg',
  cbe: '/banks/cbe.png',
  boa: '/banks/boa.jpg',
  dashen: '/banks/dashen.png',
}

const BANK_METADATA = {
  telebirr: { name: 'Telebirr', type: 'Mobile Wallet' },
  cbe: { name: 'Commercial Bank of Ethiopia', type: 'State Bank' },
  boa: { name: 'Bank of Abyssinia', type: 'Private Bank' },
  dashen: { name: 'Dashen Bank', type: 'Private Bank' },
}

const SMS_SUPPORTED = new Set(['telebirr', 'cbe', 'boa', 'dashen'])

const SMS_PLACEHOLDERS = {
  telebirr: `Dear customer
You have transferred ETB 60.00 to Receiver Name (2519****4025) on 17/06/2026 18:14:15. Your transaction number is DFH51OFIED...
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
  cbe: `Dear Petiros Asmamaw Abebe You have received ETB 2,000.00 from account 1**0947 (Sender Name) to your account 1**7112. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
  boa: `Dear Petros, your account 2*23 was debited with ETB 200.00. Available Balance: ETB 102.63.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=TT26171RW0YG02723
For help, call 8397. Bank of Abyssinia.`,
  dashen: `Dear Customer, your account 5110****011 has been debited with ETB 100.48 on 2026-06-18 at 10:23:00. A service fee of ETB 0.4, VAT of ETB 0.06 and DRRF fee of ETB 0.02 have been applied. Thank you for using Dashen Super App!
For receipt https://receipt.dashensuperapp.com/receipt/110IPSS2616900WO`,
}

function getCheckCostByAmount(amount) {
  const numAmount = parseFloat(amount) || 0
  if (numAmount < 100) return 2
  if (numAmount < 1000) return 5
  if (numAmount < 5000) return 10
  if (numAmount < 10000) return 15
  return 20
}

const EMPTY_FORM = {
  senderName: '',
  senderAccount: '',
  receiverName: '',
  receiverAccount: '',
  amount: '',
  transactionCode: '',
}

const EMPTY_REFERENCE = {
  transactionCode: '',
  accountSuffix: '',
}

const VERIFY_STAGES = [
  'Optical OCR & Text Extraction...',
  'Analyzing Font Metrics & Pixel Geometry...',
  'Cross-referencing Official Bank Gateway...',
  'Validating Merchant Recipient Account...',
]

export default function CheckerModal({
  isOpen,
  onClose,
  onSubmit,
  onReferenceSubmit,
  onSmsSubmit,
  loading,
  error,
  lastResult,
  lastResolvedDetails,
  embedded = false,
}) {
  const { t } = useLocale()
  const dispatch = useDispatch()
  const [step, setStep] = useState(3)
  const [method, setMethod] = useState('telebirr')
  const [verifyMode, setVerifyMode] = useState('screenshot')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fileDetails, setFileDetails] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [matchMyAccount, setMatchMyAccount] = useState(true)
  const [savedAccounts, setSavedAccounts] = useState([])
  const [successDetails, setSuccessDetails] = useState(null)
  const [successCheck, setSuccessCheck] = useState(null)
  const [referenceForm, setReferenceForm] = useState(EMPTY_REFERENCE)
  const [smsText, setSmsText] = useState('')
  const [channelMap, setChannelMap] = useState({})
  const [pickedBank, setPickedBank] = useState(true)
  const [activeStageIndex, setActiveStageIndex] = useState(0)

  const active = embedded || isOpen

  // Multi-stage loading progress animation
  useEffect(() => {
    if (!loading) {
      setActiveStageIndex(0)
      return
    }
    const interval = setInterval(() => {
      setActiveStageIndex((prev) => (prev < VERIFY_STAGES.length - 1 ? prev + 1 : prev))
    }, 900)
    return () => clearInterval(interval)
  }, [loading])

  const methods = useMemo(() => [
    { id: 'telebirr', label: 'Telebirr', desc: t('method.telebirrCheckDesc') },
    { id: 'cbe', label: 'Commercial Bank of Ethiopia', desc: t('method.cbeCheckDesc') },
    { id: 'boa', label: 'Bank of Abyssinia', desc: t('method.boaCheckDesc') },
    { id: 'dashen', label: 'Dashen Bank', desc: t('method.dashenCheckDesc') },
  ], [t])

  const visibleMethods = useMemo(() => (
    methods.filter((m) => {
      const bank = channelMap[m.id]
      return !bank || bank.enabled !== false
    })
  ), [methods, channelMap])

  const selectBank = (id) => {
    setMethod(id)
    setPickedBank(true)
    setRejected(false)
    setFailureIssues([])
    dispatch(clearError())
    const bank = channelMap[id]
    const modes = ['screenshot', 'sms', 'reference'].filter((mode) => {
      if (mode === 'sms' && !SMS_SUPPORTED.has(id)) return false
      if (!bank) return true
      return Boolean(bank.modes?.[mode])
    })
    const nextMode = modes.includes(verifyMode) ? verifyMode : (modes[0] || 'screenshot')
    setVerifyMode(nextMode)
    setStep(3)
  }

  const referenceFieldsByMethod = useMemo(() => ({
    telebirr: [
      { key: 'transactionCode', label: 'Telebirr Invoice No.', placeholder: 'DG65L5I9M5', hint: 'Format starts with TBL... or alphanumeric code' },
    ],
    dashen: [
      { key: 'transactionCode', label: 'Dashen IPSS Reference', placeholder: '110IPSS2616900WO', hint: 'Format starts with IPSS or 110IPSS...' },
    ],
    cbe: [
      { key: 'transactionCode', label: 'CBE Token or Reference', placeholder: 'FT26226GC3H3 or v2-...', hint: 'Format starts with FT... or receipt token URL' },
      { key: 'accountSuffix', label: 'Recipient Account Number', placeholder: '1000...', hint: 'Target account for validation', legacyOnly: true },
    ],
    boa: [
      { key: 'transactionCode', label: 'BOA Transaction Reference', placeholder: 'TT26171RW0YG', hint: 'Format starts with TT...' },
      { key: 'accountSuffix', label: 'Account Number Suffix', placeholder: '246302723', hint: 'Last digits of receiver account' },
    ],
  }), [])

  const referenceFields = useMemo(() => {
    const fields = referenceFieldsByMethod[method] || referenceFieldsByMethod.telebirr
    if (method !== 'cbe') return fields
    if (isCbeFtLike(referenceForm.transactionCode) && !isCbeTokenLike(referenceForm.transactionCode)) {
      return fields
    }
    return fields.filter((f) => !f.legacyOnly)
  }, [method, referenceFieldsByMethod, referenceForm.transactionCode])

  const referenceReady = referenceFields.every((f) => String(referenceForm[f.key] || '').trim())

  const savedForMethod = savedAccounts.find((a) => a.method === method && a.accountNumber)

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    axios.get('/me/accounts')
      .then((res) => {
        if (!cancelled) setSavedAccounts(unwrap(res).accounts || [])
      })
      .catch(() => {
        if (!cancelled) setSavedAccounts([])
      })
    axios.get('/check/channels')
      .then((res) => {
        if (cancelled) return
        const banks = unwrap(res).banks || []
        const next = {}
        banks.forEach((bank) => { next[bank.id] = bank })
        setChannelMap(next)
      })
      .catch(() => {
        if (!cancelled) setChannelMap({})
      })
    return () => { cancelled = true }
  }, [active])

  useEffect(() => {
    if (!active) return
    dispatch(clearError())
    setRejected(false)
    setFailureIssues([])
  }, [active, dispatch])

  const handleReferenceChange = (field, value) => {
    setReferenceForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
    setFileDetails({
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type || 'image/jpeg',
    })
  }

  const dismissLastAttempt = () => {
    setRejected(false)
    setFailureIssues([])
    dispatch(clearError())
  }

  const resetForm = () => {
    setStep(3)
    setMethod('telebirr')
    setVerifyMode('screenshot')
    setScreenshot(null)
    setPreview(null)
    setFileDetails(null)
    setRejected(false)
    setFailureIssues([])
    setMatchMyAccount(true)
    setSuccessDetails(null)
    setSuccessCheck(null)
    setReferenceForm(EMPTY_REFERENCE)
    setSmsText('')
    dispatch(clearError())
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const successStep = 4

  const runVerify = async () => {
    if (!screenshot) {
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: 'Please upload or choose a receipt screenshot to verify.' }])
      setRejected(true)
      return
    }

    setRejected(false)
    setFailureIssues([])

    const result = await onSubmit({
      screenshot,
      method,
      form: EMPTY_FORM,
      withDetails: false,
      matchMyAccount,
    })

    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setSuccessDetails(result.resolvedDetails || lastResolvedDetails || null)
      setSuccessCheck(result.check || lastResult || null)
      setStep(successStep)
    }
  }

  const runReferenceVerify = async (e) => {
    e.preventDefault()
    setRejected(false)
    setFailureIssues([])

    const result = await onReferenceSubmit({
      method,
      transactionCode: referenceForm.transactionCode,
      accountSuffix: referenceForm.accountSuffix,
      matchMyAccount,
    })

    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setSuccessDetails(result.resolvedDetails || lastResolvedDetails || null)
      setSuccessCheck(result.check || lastResult || null)
      setStep(4)
    }
  }

  const runSmsVerify = async (e) => {
    e.preventDefault()
    setRejected(false)
    setFailureIssues([])

    const result = await onSmsSubmit({ method, smsText, matchMyAccount })

    if (result?.failed) {
      setFailureIssues(result.issues || [])
      setRejected(true)
      return
    }

    if (result?.success) {
      setSuccessDetails(result.resolvedDetails || lastResolvedDetails || null)
      setSuccessCheck(result.check || lastResult || null)
      setStep(4)
    }
  }

  const handleQuickVerify = async (e) => {
    e.preventDefault()
    await runVerify()
  }

  const defaultAccountLine = 'seifeslasie asmamaw abebe · 0989886956'
  const displayAccount = savedForMethod
    ? `${savedForMethod.accountName} · ${savedForMethod.accountNumber}`
    : defaultAccountLine

  const payToMyAccountBlock = (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
        matchMyAccount
          ? 'bg-[#EBF5EE] border-[#1B463A]/40 shadow-xs ring-1 ring-[#1B463A]/10'
          : 'bg-[#FAF8F5] border-[rgba(27,70,58,0.14)]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer select-none">
          <div className="relative inline-flex items-center shrink-0">
            <input
              type="checkbox"
              checked={matchMyAccount}
              onChange={(e) => setMatchMyAccount(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out p-0.5 ${
                matchMyAccount ? 'bg-[#1B463A]' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                  matchMyAccount ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Lock size={12} className={matchMyAccount ? 'text-[#1B463A]' : 'text-gray-400'} />
              <span className="text-xs font-bold text-[#091A16] block">
                Payment to my account
              </span>
            </div>
            <span className="text-[11px] text-[#40564C] font-semibold block truncate mt-0.5">
              {displayAccount}
            </span>
          </div>
        </label>
        <Link
          to="/accounts"
          onClick={embedded ? undefined : handleClose}
          className="text-xs font-bold text-[#1B463A] hover:underline shrink-0"
        >
          Manage
        </Link>
      </div>
    </div>
  )

  if (!active) return null

  const summaryDetails = successDetails || lastResolvedDetails || (lastResult ? {
    senderName: lastResult.senderName,
    senderAccount: lastResult.senderAccount,
    receiverName: lastResult.receiverName,
    receiverAccount: lastResult.receiverAccount,
    amount: lastResult.amount,
    transactionCode: lastResult.transactionCode,
  } : null)

  const startAnother = () => {
    setRejected(false)
    setFailureIssues([])
    setSuccessDetails(null)
    setSuccessCheck(null)
    setScreenshot(null)
    setPreview(null)
    setFileDetails(null)
    setReferenceForm(EMPTY_REFERENCE)
    setSmsText('')
    setStep(3)
    dispatch(clearError())
  }

  const pickMode = (mode) => {
    dismissLastAttempt()
    setVerifyMode(mode)
    setStep(3)
  }

  const flow = rejected ? (
    <div className="verify-outcome verify-outcome--fail space-y-4">
      {/* ── Tampered / Rejected Banner ── */}
      <div className="rounded-2xl bg-gradient-to-r from-[#7F1D1D] to-[#991B1B] text-white p-5 shadow-sm text-left">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-900/70 border border-red-400 text-red-200 flex items-center justify-center shrink-0">
            <ShieldAlert size={22} strokeWidth={2.2} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-red-800 text-red-200 px-2 py-0.5 rounded-full inline-block mb-1">
              SECURITY ALERT
            </span>
            <h2 className="text-base sm:text-lg font-black text-white leading-snug">
              TAMPERED / MANIPULATION DETECTED
            </h2>
            <p className="text-xs text-red-200 mt-1 leading-relaxed">
              This receipt failed cryptographic verification against official bank settlement ledgers or font metric baselines.
            </p>
          </div>
        </div>
      </div>

      <VerificationFailureList issues={failureIssues} nested />

      <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            dismissLastAttempt()
            setStep(3)
          }}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1B463A] text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:bg-[#15382E]"
        >
          <RotateCcw size={15} strokeWidth={2} />
          <span>{t('common.tryAgain')}</span>
        </button>
        <button
          type="button"
          onClick={startAnother}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[rgba(27,70,58,0.2)] bg-white text-[#091A16] text-xs font-bold cursor-pointer hover:bg-[#FAF8F5]"
        >
          Check Another Receipt
        </button>
      </div>
    </div>
  ) : step === successStep ? (
    <div className="space-y-4">
      <VerificationCertificate
        check={successCheck || lastResult}
        details={summaryDetails}
      />
      <VerificationWarningList issues={lastResult?.validationResult?.issues || successCheck?.validationResult?.issues || []} />
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <p className="text-xs font-semibold text-[#40564C]">
          {(successCheck || lastResult)?.isRecheck
            ? 'Free instant re-check record'
            : `Deducted ${(successCheck || lastResult)?.balanceDeducted || getCheckCostByAmount(summaryDetails?.amount)} Birr from balance`}
        </p>
        <button
          type="button"
          onClick={startAnother}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#1B463A] hover:bg-[#15382E] text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <span>Verify Another Receipt</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  ) : (
    <div className="space-y-4 text-left">
      {error && !rejected && (
        <div className="alert alert-error my-1.5">
          <p className="font-semibold text-xs sm:text-sm">
            {typeof error === 'string' ? error : error.message || t('result.failed')}
          </p>
        </div>
      )}

      {/* ── Step 1: Bank Selection (Spacious Heightened Cards) ── */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <span className="text-xs font-bold text-[#091A16] uppercase tracking-wider">
            Choose Bank / Mobile Wallet
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {visibleMethods.map((m) => {
            const isSelected = method === m.id
            const meta = BANK_METADATA[m.id] || { name: m.label, type: 'Bank' }
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectBank(m.id)}
                className={`relative flex flex-col items-center justify-center p-3 sm:p-3.5 min-h-[90px] sm:min-h-[98px] rounded-2xl border transition-all duration-200 cursor-pointer text-center ${
                  isSelected
                    ? 'bg-[#EBF5EE] border-2 border-[#1B463A] shadow-md ring-2 ring-[#1B463A]/20 scale-[1.01]'
                    : 'bg-white hover:bg-[#FAF8F5] border-[rgba(27,70,58,0.14)] hover:border-[#1B463A]/40 shadow-xs'
                }`}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#1B463A] text-white flex items-center justify-center shadow-xs">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white p-1 flex items-center justify-center shrink-0 shadow-xs border border-[rgba(27,70,58,0.08)] mb-1.5">
                  <img
                    src={BANK_LOGOS[m.id]}
                    alt={m.label}
                    className="w-full h-full object-contain rounded"
                  />
                </div>
                <span className="text-xs font-black text-[#091A16] block leading-tight truncate w-full">
                  {m.label}
                </span>
                <span className="text-[10px] font-medium text-[#40564C] block mt-0.5 truncate w-full">
                  {meta.type}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Step 2: Verification Method Selector ── */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
            2
          </span>
          <span className="text-xs font-bold text-[#091A16] uppercase tracking-wider">
            Verification Method
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            role="tab"
            aria-selected={verifyMode === 'screenshot'}
            onClick={() => pickMode('screenshot')}
            className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 rounded-2xl border transition-all duration-200 cursor-pointer min-h-[46px] sm:min-h-[50px] ${
              verifyMode === 'screenshot'
                ? 'bg-[#1B463A] text-white border-2 border-[#1B463A] shadow-md ring-2 ring-[#1B463A]/20 scale-[1.01]'
                : 'bg-white text-[#091A16] hover:bg-[#FAF8F5] border-2 border-[rgba(27,70,58,0.16)] hover:border-[#1B463A]/50 shadow-xs hover:shadow-sm active:scale-[0.98]'
            }`}
          >
            <Camera size={16} strokeWidth={2.2} className={verifyMode === 'screenshot' ? 'text-[#E4C977]' : 'text-[#1B463A]'} />
            <span className="text-xs sm:text-sm font-extrabold">Screenshot</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={verifyMode === 'sms'}
            onClick={() => pickMode('sms')}
            className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 rounded-2xl border transition-all duration-200 cursor-pointer min-h-[46px] sm:min-h-[50px] ${
              verifyMode === 'sms'
                ? 'bg-[#1B463A] text-white border-2 border-[#1B463A] shadow-md ring-2 ring-[#1B463A]/20 scale-[1.01]'
                : 'bg-white text-[#091A16] hover:bg-[#FAF8F5] border-2 border-[rgba(27,70,58,0.16)] hover:border-[#1B463A]/50 shadow-xs hover:shadow-sm active:scale-[0.98]'
            }`}
          >
            <MessageSquare size={16} strokeWidth={2.2} className={verifyMode === 'sms' ? 'text-[#E4C977]' : 'text-[#1B463A]'} />
            <span className="text-xs sm:text-sm font-extrabold">SMS</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={verifyMode === 'reference'}
            onClick={() => pickMode('reference')}
            className={`flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 rounded-2xl border transition-all duration-200 cursor-pointer min-h-[46px] sm:min-h-[50px] ${
              verifyMode === 'reference'
                ? 'bg-[#1B463A] text-white border-2 border-[#1B463A] shadow-md ring-2 ring-[#1B463A]/20 scale-[1.01]'
                : 'bg-white text-[#091A16] hover:bg-[#FAF8F5] border-2 border-[rgba(27,70,58,0.16)] hover:border-[#1B463A]/50 shadow-xs hover:shadow-sm active:scale-[0.98]'
            }`}
          >
            <Hash size={16} strokeWidth={2.2} className={verifyMode === 'reference' ? 'text-[#E4C977]' : 'text-[#1B463A]'} />
            <span className="text-xs sm:text-sm font-extrabold">Payment ID</span>
          </button>
        </div>
      </div>

      {/* ── Step 3: Input & Bottom Verify Receipt Action ── */}
      {verifyMode === 'screenshot' && (
        <form onSubmit={handleQuickVerify} className="space-y-3.5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <p className="text-xs font-bold text-[#091A16] uppercase tracking-wider">
                Upload Receipt Screenshot
              </p>
            </div>

            {/* Heightened Spacious Dropzone & Upload Button */}
            <label
              className={`relative block rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden ${
                preview
                  ? 'border-[#1B463A] bg-[#F2F8F4] px-5 py-4'
                  : 'border-[rgba(27,70,58,0.22)] hover:border-[#1B463A] bg-[#FAF8F5]/80 hover:bg-[#F6FAF7] px-5 py-6 sm:py-7'
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFile}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                required={!screenshot}
              />

              {preview ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="relative group w-14 h-14 overflow-hidden rounded-xl border border-[rgba(27,70,58,0.2)] shadow-xs bg-white p-1 shrink-0">
                      <div className="laser-scan-line" />
                      <img
                        src={preview}
                        alt="Receipt preview"
                        className="w-full h-full object-contain rounded"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1B463A] text-white shadow-xs">
                        <CheckCircle2 size={12} />
                        <span>Receipt Ready</span>
                      </span>
                      {fileDetails && (
                        <p className="text-xs text-[#40564C] font-mono mt-1 truncate max-w-[280px]">
                          {fileDetails.name} · {fileDetails.size}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[#1B463A] hover:underline shrink-0">
                    Change Screenshot
                  </span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#1B463A]/10 text-[#1B463A] flex items-center justify-center shrink-0 shadow-xs">
                      <Upload size={24} strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[#091A16]">
                        Drag & Drop Receipt Screenshot Here
                      </p>
                      <p className="text-xs text-[#40564C] font-medium mt-0.5">
                        Supports PNG, JPG, or WEBP from Telebirr, CBE, Abyssinia, or Dashen.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B463A] text-white text-xs font-extrabold shadow-sm pointer-events-none shrink-0 min-h-[42px]">
                    <FileUp size={16} />
                    <span>Browse File</span>
                  </span>
                </div>
              )}
            </label>
          </div>

          {/* Recipient Account Fraud Shield */}
          {payToMyAccountBlock}

          {/* Multi-Stage Loading Progress Banner */}
          {loading && (
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#1B463A]/30 space-y-1.5 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-[#091A16]">
                <span className="flex items-center gap-2 text-[#1B463A]">
                  <Sparkles size={14} className="animate-spin text-[#C6A24E]" />
                  {VERIFY_STAGES[activeStageIndex]}
                </span>
                <span className="font-mono text-[10px] text-[#40564C]">
                  Step {activeStageIndex + 1} of 4
                </span>
              </div>
              <div className="w-full bg-[rgba(27,70,58,0.12)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#1B463A] h-full transition-all duration-500 ease-out"
                  style={{ width: `${((activeStageIndex + 1) / VERIFY_STAGES.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Bottom Action: Verify Receipt */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading || !screenshot}
              className="landing-start-verify-btn w-full py-3.5 sm:py-4 text-sm sm:text-base font-extrabold flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.99] shadow-md"
            >
              <ShieldCheck size={20} className="text-[#E4C977]" />
              <span>{loading ? 'Verifying Receipt Authenticity...' : 'Verify Receipt'}</span>
              {!loading && <ArrowRight size={17} className="opacity-90" />}
            </button>
            <p className="text-[11px] text-[#40564C] text-center font-medium mt-1.5">
              Takes &lt; 2s · Cryptographic seal · Anti-tamper inspection
            </p>
          </div>
        </form>
      )}

      {verifyMode === 'reference' && (
        <form onSubmit={runReferenceVerify} className="space-y-3.5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <p className="text-xs font-bold text-[#091A16] uppercase tracking-wider">
                Direct Payment ID Query
              </p>
            </div>
            <p className="text-[11px] text-[#40564C] mb-2">
              Enter the bank transaction reference number to query the official ledger directly.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {referenceFields.map((field) => (
              <div key={field.key}>
                <label className="label text-xs font-bold text-[#091A16] mb-1 block">
                  {field.label}
                </label>
                <input
                  type="text"
                  className="input w-full rounded-xl py-2 px-3 text-xs sm:text-sm font-mono font-semibold"
                  placeholder={field.placeholder}
                  value={referenceForm[field.key]}
                  onChange={(e) => handleReferenceChange(field.key, e.target.value)}
                  required
                />
                {field.hint && (
                  <p className="text-[10px] text-[#40564C] mt-0.5 font-medium">{field.hint}</p>
                )}
              </div>
            ))}
          </div>

          {payToMyAccountBlock}

          {loading && (
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#1B463A]/30 space-y-1.5 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-[#091A16]">
                <span className="flex items-center gap-2 text-[#1B463A]">
                  <Sparkles size={14} className="animate-spin text-[#C6A24E]" />
                  {VERIFY_STAGES[activeStageIndex]}
                </span>
                <span className="font-mono text-[10px] text-[#40564C]">
                  Step {activeStageIndex + 1} of 4
                </span>
              </div>
              <div className="w-full bg-[rgba(27,70,58,0.12)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#1B463A] h-full transition-all duration-500 ease-out"
                  style={{ width: `${((activeStageIndex + 1) / VERIFY_STAGES.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading || !referenceReady}
              className="landing-start-verify-btn w-full py-3.5 sm:py-4 text-sm sm:text-base font-extrabold flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.99] shadow-md"
            >
              <ShieldCheck size={20} className="text-[#E4C977]" />
              <span>{loading ? 'Querying Official Bank Ledger...' : 'Verify Receipt'}</span>
              {!loading && <ArrowRight size={17} className="opacity-90" />}
            </button>
            <p className="text-[11px] text-[#40564C] text-center font-medium mt-1.5">
              Takes &lt; 2s · Cryptographic seal · Anti-tamper inspection
            </p>
          </div>
        </form>
      )}

      {verifyMode === 'sms' && (
        <form onSubmit={runSmsVerify} className="space-y-3.5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                3
              </span>
              <p className="text-xs font-bold text-[#091A16] uppercase tracking-wider">
                Bank SMS Text Parser
              </p>
            </div>
            <p className="text-[11px] text-[#40564C] mb-2">
              Paste the complete SMS received from 127, CBE, or bank shortcodes.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="sms-textarea" className="label text-xs font-bold text-[#091A16] block">
                SMS Message Content
              </label>
              <button
                type="button"
                onClick={() => {
                  const sample = SMS_PLACEHOLDERS[method] || SMS_PLACEHOLDERS.telebirr
                  setSmsText(sample)
                }}
                className="text-[10px] font-bold text-[#1B463A] hover:underline cursor-pointer"
              >
                Paste sample
              </button>
            </div>
            <textarea
              id="sms-textarea"
              rows={3}
              className="textarea w-full rounded-xl py-2 px-3 text-xs font-mono font-medium leading-relaxed resize-none"
              placeholder={SMS_PLACEHOLDERS[method] || 'Paste complete official bank transaction SMS here...'}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              required
            />
          </div>

          {payToMyAccountBlock}

          {loading && (
            <div className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#1B463A]/30 space-y-1.5 animate-pulse">
              <div className="flex items-center justify-between text-xs font-bold text-[#091A16]">
                <span className="flex items-center gap-2 text-[#1B463A]">
                  <Sparkles size={14} className="animate-spin text-[#C6A24E]" />
                  {VERIFY_STAGES[activeStageIndex]}
                </span>
                <span className="font-mono text-[10px] text-[#40564C]">
                  Step {activeStageIndex + 1} of 4
                </span>
              </div>
              <div className="w-full bg-[rgba(27,70,58,0.12)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#1B463A] h-full transition-all duration-500 ease-out"
                  style={{ width: `${((activeStageIndex + 1) / VERIFY_STAGES.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading || smsText.trim().length < 40}
              className="landing-start-verify-btn w-full py-3.5 sm:py-4 text-sm sm:text-base font-extrabold flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.99] shadow-md"
            >
              <ShieldCheck size={20} className="text-[#E4C977]" />
              <span>{loading ? 'Parsing SMS & Validating Proof...' : 'Verify Receipt'}</span>
              {!loading && <ArrowRight size={17} className="opacity-90" />}
            </button>
            <p className="text-[11px] text-[#40564C] text-center font-medium mt-1.5">
              Takes &lt; 2s · Cryptographic seal · Anti-tamper inspection
            </p>
          </div>
        </form>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div className="verify-workspace-hub w-full flex justify-center scroll-mt-36 pt-4 sm:pt-8" id="verify-desk">
        <section className="bg-white rounded-3xl border border-[rgba(27,70,58,0.14)] p-6 sm:p-8 shadow-sm w-full max-w-xl sm:max-w-2xl mx-auto mt-3 sm:mt-6">
          {flow}
        </section>
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Verify Receipt" wide={true}>
      <div className="modal-body space-y-4">
        {flow}
      </div>
    </Modal>
  )
}
