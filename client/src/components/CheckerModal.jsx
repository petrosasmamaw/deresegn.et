import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import {
  Smartphone,
  Building2,
  RotateCcw,
  Upload,
  Hash,
  Camera,
  MessageSquare,
  XCircle,
  Check,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  FileUp,
  Info,
} from 'lucide-react'
import Modal from './Modal'
import { VerificationFailureList, VerificationWarningList } from './VerificationResult'
import VerificationCertificate from './VerificationCertificate'
import VerificationFormatGuide from './VerificationFormatGuide'
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
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('')
  const [verifyMode, setVerifyMode] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [matchMyAccount, setMatchMyAccount] = useState(false)
  const [savedAccounts, setSavedAccounts] = useState([])
  const [successDetails, setSuccessDetails] = useState(null)
  const [successCheck, setSuccessCheck] = useState(null)
  const [referenceForm, setReferenceForm] = useState(EMPTY_REFERENCE)
  const [smsText, setSmsText] = useState('')
  const [channelMap, setChannelMap] = useState({})
  const [pickedBank, setPickedBank] = useState(false)

  const active = embedded || isOpen

  const methods = useMemo(() => [
    { id: 'telebirr', label: t('method.telebirr'), icon: Smartphone, desc: t('method.telebirrCheckDesc') },
    { id: 'cbe', label: t('method.cbe'), icon: Building2, desc: t('method.cbeCheckDesc') },
    { id: 'boa', label: t('method.boa'), icon: Building2, desc: t('method.boaCheckDesc') },
    { id: 'dashen', label: t('method.dashen'), icon: Building2, desc: t('method.dashenCheckDesc') },
  ], [t])

  const visibleMethods = useMemo(() => (
    methods.filter((m) => {
      const bank = channelMap[m.id]
      return !bank || bank.enabled !== false
    })
  ), [methods, channelMap])

  const enabledModes = useMemo(() => {
    if (!method) return []
    const bank = channelMap[method]
    return ['screenshot', 'reference', 'sms'].filter((mode) => {
      if (mode === 'sms' && !SMS_SUPPORTED.has(method)) return false
      if (!bank) return true
      return Boolean(bank.modes?.[mode])
    })
  }, [method, channelMap])

  const selectBank = (id) => {
    setMethod(id)
    setPickedBank(true)
    setRejected(false)
    setFailureIssues([])
    dispatch(clearError())
    const bank = channelMap[id]
    const modes = ['screenshot', 'reference', 'sms'].filter((mode) => {
      if (mode === 'sms' && !SMS_SUPPORTED.has(id)) return false
      if (!bank) return true
      return Boolean(bank.modes?.[mode])
    })
    const nextMode = modes.includes(verifyMode) ? verifyMode : (modes[0] || '')
    setVerifyMode(nextMode)
    setStep(nextMode ? 3 : 1)
  }

  useEffect(() => {
    if (!pickedBank && visibleMethods[0] && Object.keys(channelMap).length) {
      selectBank(visibleMethods[0].id)
    }
  }, [visibleMethods, channelMap, pickedBank])

  const referenceDetailByMethod = useMemo(() => ({
    telebirr: t('ref.telebirrDetail'),
    dashen: t('ref.dashenDetail'),
    cbe: t('ref.cbeDetail'),
    boa: t('ref.boaDetail'),
  }), [t])

  const referenceFieldsByMethod = useMemo(() => ({
    telebirr: [
      { key: 'transactionCode', label: t('ref.invoice'), placeholder: 'DG65L5I9M5', hint: t('ref.invoiceHint') },
    ],
    dashen: [
      { key: 'transactionCode', label: t('ref.ipss'), placeholder: '110IPSS2616900WO', hint: t('ref.ipssHint') },
    ],
    cbe: [
      { key: 'transactionCode', label: t('ref.cbeToken'), placeholder: 'FT26226GC3H3 or v2-…', hint: t('ref.cbeTokenHint') },
      { key: 'accountSuffix', label: t('ref.cbeAccount'), placeholder: '33687112', hint: t('ref.cbeAccountHint'), legacyOnly: true },
    ],
    boa: [
      { key: 'transactionCode', label: t('ref.boaId'), placeholder: 'TT26171RW0YG', hint: t('ref.boaIdHint') },
      { key: 'accountSuffix', label: t('ref.boaAccount'), placeholder: '246302723', hint: t('ref.boaAccountHint') },
    ],
  }), [t])

  const referenceFields = useMemo(() => {
    const fields = referenceFieldsByMethod[method] || []
    if (method !== 'cbe') return fields
    // Token-first: hide account unless user entered a legacy FT reference.
    if (isCbeFtLike(referenceForm.transactionCode) && !isCbeTokenLike(referenceForm.transactionCode)) {
      return fields
    }
    return fields.filter((f) => !f.legacyOnly)
  }, [method, referenceFieldsByMethod, referenceForm.transactionCode])

  const referenceReady = referenceFields.every((f) => String(referenceForm[f.key] || '').trim())

  const savedForMethod = savedAccounts.find((a) => a.method === method && a.accountNumber)
  const canMatchMyAccount = Boolean(savedForMethod)

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

  // Track whether the user manually flipped the switch for the current bank.
  // Auto-default ON only when a saved account first becomes available — never
  // re-force ON after the user turns it off.
  const matchUserOverrideRef = useRef(false)

  useEffect(() => {
    matchUserOverrideRef.current = false
    setMatchMyAccount(Boolean(canMatchMyAccount))
  }, [method])

  useEffect(() => {
    if (!canMatchMyAccount) {
      setMatchMyAccount(false)
      return
    }
    if (!matchUserOverrideRef.current) {
      setMatchMyAccount(true)
    }
  }, [canMatchMyAccount])

  const handleReferenceChange = (field, value) => {
    setReferenceForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setPreview(URL.createObjectURL(file))
  }

  const dismissLastAttempt = () => {
    setRejected(false)
    setFailureIssues([])
    dispatch(clearError())
  }

  const resetForm = () => {
    setStep(1)
    setMethod('')
    setVerifyMode('')
    setScreenshot(null)
    setPreview(null)
    setRejected(false)
    setFailureIssues([])
    setMatchMyAccount(false)
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
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: t('check.screenshotRequired') }])
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

  const payState = !canMatchMyAccount ? 'is-locked' : matchMyAccount ? 'is-on' : 'is-ready'
  const payToMyAccountBlock = (
    <div className={`p-3.5 rounded-2xl border transition-all ${
      !canMatchMyAccount
        ? 'bg-[#FAF8F5]/80 border-[rgba(27,70,58,0.12)]'
        : matchMyAccount
          ? 'bg-[#EBF5EE] border-[#1B463A]/40 shadow-xs'
          : 'bg-[#FAF8F5] border-[rgba(27,70,58,0.14)]'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <label className={`flex items-center gap-3 flex-1 min-w-0 ${canMatchMyAccount ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}`}>
          <div className="relative inline-flex items-center shrink-0">
            <input
              type="checkbox"
              checked={matchMyAccount}
              disabled={!canMatchMyAccount}
              onChange={(e) => {
                matchUserOverrideRef.current = true
                setMatchMyAccount(e.target.checked)
              }}
              className="sr-only"
            />
            <div className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out p-0.5 ${
              matchMyAccount ? 'bg-[#1B463A]' : 'bg-gray-300'
            }`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                matchMyAccount ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-[#091A16] block">{t('check.payToMyAccount')}</span>
            {savedForMethod ? (
              <span className="text-[11px] text-[#40564C] font-semibold block truncate">
                {savedForMethod.accountName} · {savedForMethod.accountNumber}
              </span>
            ) : (
              <span className="text-[11px] text-[#8C6A21] font-medium block">
                No saved account registered for this bank yet
              </span>
            )}
          </div>
        </label>
        {!canMatchMyAccount && (
          <Link
            to="/accounts"
            onClick={embedded ? undefined : handleClose}
            className="text-xs font-bold text-[#1B463A] hover:underline shrink-0"
          >
            {t('check.addAccountLink')}
          </Link>
        )}
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

  const previousVerification = (successCheck || lastResult)?.previousVerification || null
  const previousVerificationLabel = previousVerification?.verifiedBy === 'self'
    ? t('check.prevSelf')
    : previousVerification?.verifiedBy === 'other'
      ? t('check.prevOther')
      : null

  const previousVerificationMeta = previousVerification?.checkedAt
    ? (() => {
        const when = new Date(previousVerification.checkedAt)
        return Number.isNaN(when.getTime()) ? null : when.toLocaleString()
      })()
    : null

  const startAnother = () => {
    setRejected(false)
    setFailureIssues([])
    setSuccessDetails(null)
    setSuccessCheck(null)
    setScreenshot(null)
    setPreview(null)
    setReferenceForm(EMPTY_REFERENCE)
    setSmsText('')
    setStep(verifyMode ? 3 : 1)
    dispatch(clearError())
  }

  const pickMode = (mode) => {
    dismissLastAttempt()
    setVerifyMode(mode)
    setStep(3)
  }

  const selector = (
    <>
      <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-[rgba(27,70,58,0.1)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl sm:text-2xl font-black text-[#091A16] tracking-tight">
              {t('check.title')}
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#1B463A]/10 text-[#1B463A] border border-[#1B463A]/20 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {t('check.liveStamp')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#40564C] font-medium leading-relaxed max-w-xl">
            {t('check.deskHint')}
          </p>
        </div>
      </div>

      {/* Step 1: Bank Selection */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
          <span className="text-xs font-bold text-[#091A16] uppercase tracking-wider">{t('check.stepMethod')}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {visibleMethods.length === 0 && (
            <p className="text-sm text-[#40564C] col-span-full">{t('check.noChannels')}</p>
          )}
          {visibleMethods.map((m) => {
            const isSelected = method === m.id
            const meta = BANK_METADATA[m.id] || { name: m.label, type: 'Bank' }
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectBank(m.id)}
                className={`relative flex flex-col items-center justify-center text-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-[#EBF5EE] border-2 border-[#1B463A] shadow-md ring-2 ring-[#1B463A]/15 scale-[1.01]'
                    : 'bg-white/90 hover:bg-white border-[rgba(27,70,58,0.14)] hover:border-[#1B463A]/40 shadow-xs hover:shadow-sm'
                }`}
                aria-label={m.label}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#1B463A] text-white flex items-center justify-center shadow-xs">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                <div className="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center mb-1.5 shadow-xs border border-[rgba(27,70,58,0.08)]">
                  <img src={BANK_LOGOS[m.id]} alt={m.label} className="w-full h-full object-contain rounded" />
                </div>
                <span className="text-xs font-extrabold text-[#091A16] block leading-tight">{m.label}</span>
                <span className="text-[10px] font-medium text-[#40564C] block mt-0.5">{meta.type}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Step 2: Verification Mode */}
      {method && enabledModes.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
            <span className="text-xs font-bold text-[#091A16] uppercase tracking-wider">{t('check.stepMode')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-[#FAF8F5] border border-[rgba(27,70,58,0.12)]">
            {enabledModes.includes('screenshot') && (
              <button
                type="button"
                role="tab"
                aria-selected={verifyMode === 'screenshot'}
                onClick={() => pickMode('screenshot')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  verifyMode === 'screenshot'
                    ? 'bg-[#1B463A] text-white shadow-md'
                    : 'text-[#1F362D] hover:text-[#091A16] hover:bg-white/80'
                }`}
              >
                <Camera size={16} strokeWidth={2} />
                <span>{t('check.modeScreenshotShort')}</span>
              </button>
            )}
            {enabledModes.includes('sms') && (
              <button
                type="button"
                role="tab"
                aria-selected={verifyMode === 'sms'}
                onClick={() => pickMode('sms')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  verifyMode === 'sms'
                    ? 'bg-[#1B463A] text-white shadow-md'
                    : 'text-[#1F362D] hover:text-[#091A16] hover:bg-white/80'
                }`}
              >
                <MessageSquare size={16} strokeWidth={2} />
                <span>{t('check.modeSmsShort')}</span>
              </button>
            )}
            {enabledModes.includes('reference') && (
              <button
                type="button"
                role="tab"
                aria-selected={verifyMode === 'reference'}
                onClick={() => pickMode('reference')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  verifyMode === 'reference'
                    ? 'bg-[#1B463A] text-white shadow-md'
                    : 'text-[#1F362D] hover:text-[#091A16] hover:bg-white/80'
                }`}
              >
                <Hash size={16} strokeWidth={2} />
                <span>{t('check.modeReferenceShort')}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )

  const showingResult = rejected || step === successStep

  const flow = rejected ? (
    <div className="verify-outcome verify-outcome--fail">
      <div className="verify-outcome-hero">
        <span className="verify-outcome-mark" aria-hidden="true">
          <XCircle size={28} strokeWidth={2} />
        </span>
        <h2 className="verify-outcome-title">{t('result.couldNotVerify')}</h2>
        <p className="verify-outcome-lead">{t('result.failedHint')}</p>
      </div>
      <VerificationFailureList issues={failureIssues} nested />
      <div className="verify-outcome-cta">
        <button
          type="button"
          onClick={() => {
            dismissLastAttempt()
            setStep(3)
          }}
          className="verify-outcome-again"
        >
          <RotateCcw size={18} strokeWidth={2} />
          {t('common.tryAgain')}
        </button>
        {embedded ? (
          <button type="button" onClick={startAnother} className="verify-outcome-another">
            {t('check.another')}
          </button>
        ) : (
          <button type="button" onClick={handleClose} className="verify-outcome-another">
            {t('common.close')}
          </button>
        )}
      </div>
    </div>
  ) : step === successStep ? (
    <div className="verify-outcome verify-outcome--pass">
      {previousVerificationLabel && (
        <p className="verify-outcome-prev">
          {previousVerificationLabel}
          {previousVerificationMeta ? ` · ${t('check.verifiedOn', { when: previousVerificationMeta })}` : ''}
        </p>
      )}
      {(successCheck || lastResult) && (
        <VerificationCertificate
          check={successCheck || lastResult}
          details={summaryDetails}
        />
      )}
      <VerificationWarningList issues={lastResult?.validationResult?.issues || successCheck?.validationResult?.issues || []} />
      <div className="verify-outcome-cta">
        <p className="verify-outcome-balance">
          {(successCheck || lastResult)?.isRecheck
            ? t('check.noCharge')
            : t('check.deducted', { amount: (successCheck || lastResult)?.balanceDeducted || getCheckCostByAmount(summaryDetails?.amount) })}
        </p>
        <button type="button" onClick={embedded ? startAnother : handleClose} className="verify-outcome-another">
          {embedded ? t('check.another') : t('check.complete')}
        </button>
      </div>
    </div>
  ) : (
    <div className="space-y-4">
      {selector}
      {error && !rejected && step === 3 && (
        <div className="alert alert-error mt-4">
          <p className="font-semibold text-sm">{typeof error === 'string' ? error : error.message || t('result.failed')}</p>
        </div>
      )}

      {step === 3 && verifyMode === 'screenshot' && (
        <form onSubmit={handleQuickVerify} className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              <p className="text-xs font-bold text-[#091A16] uppercase tracking-wider">{t('check.stepUpload')}</p>
            </div>
            <p className="text-xs text-[#40564C] mb-3">
              {method === 'telebirr'
                ? t('check.stepUploadHintTelebirr')
                : t('check.stepUploadHintOther')}
            </p>
            <label
              className={`relative block rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer overflow-hidden p-6 sm:p-8 text-center ${
                preview
                  ? 'border-[#1B463A] bg-[#F2F8F4]'
                  : 'border-[rgba(27,70,58,0.25)] hover:border-[#1B463A] bg-[#FAF8F5]/80 hover:bg-[#F6FAF7]'
              }`}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFile}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                required={!screenshot}
              />
              {preview ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="relative group max-h-48 overflow-hidden rounded-xl border border-[rgba(27,70,58,0.15)] shadow-md bg-white p-1">
                    <img src={preview} alt="Receipt preview" className="max-h-40 object-contain rounded-lg" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1B463A] text-white shadow-xs">
                      <CheckCircle2 size={13} />
                      <span>{t('check.screenshotUploaded')}</span>
                    </span>
                    <p className="text-xs text-[#40564C] font-semibold mt-1.5">Tap box to choose a different receipt screenshot</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#1B463A]/10 text-[#1B463A] flex items-center justify-center shadow-xs">
                    <Upload size={24} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm sm:text-base font-extrabold text-[#091A16]">{t('check.uploadReceipt')}</p>
                    <p className="text-xs text-[#40564C] font-medium max-w-sm mx-auto mt-0.5">{t('check.uploadHint')}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B463A] text-white text-xs font-bold shadow-sm pointer-events-none mt-1">
                    <FileUp size={15} />
                    <span>{t('check.uploadBtn')}</span>
                  </span>
                </div>
              )}
            </label>
          </div>

          {payToMyAccountBlock}

          <button
            type="submit"
            disabled={loading || !screenshot}
            className="landing-start-verify-btn w-full py-4 text-base font-extrabold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={20} className="text-[#E4C977]" />
            <span>{loading ? t('check.verifying') : t('check.verifyBtn')}</span>
            <ArrowRight size={18} className="opacity-90" />
          </button>
          <p className="text-[11px] text-[#40564C] text-center font-medium">Takes &lt; 5 seconds · Secure cryptographic seal</p>
        </form>
      )}

      {step === 3 && verifyMode === 'reference' && (
        <form onSubmit={runReferenceVerify} className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              <p className="text-xs font-bold text-[#091A16] uppercase tracking-wider">{t('check.stepPaymentId')}</p>
            </div>
            <p className="text-xs text-[#40564C] mb-3">{t('check.stepPaymentIdHint')}</p>
          </div>

          <div className="rounded-2xl p-3.5 border text-xs bg-[#FAF8F5] border-[rgba(27,70,58,0.12)]">
            <p className="font-extrabold text-sm text-[#091A16] mb-1">
              {methods.find((m) => m.id === method)?.label}
            </p>
            <p className="text-[#40564C] font-medium leading-relaxed">
              {referenceDetailByMethod[method]}
            </p>
          </div>

          {referenceFields.map((field) => (
            <div key={field.key}>
              <label className="label text-xs font-bold text-[#091A16] mb-1 block">{field.label}</label>
              <input
                type="text"
                className="input w-full rounded-xl py-2.5 text-sm font-semibold"
                placeholder={field.placeholder}
                value={referenceForm[field.key]}
                onChange={(e) => handleReferenceChange(field.key, e.target.value)}
                required
              />
              {field.hint && (
                <p className="text-[11px] text-[#40564C] mt-1 font-medium">{field.hint}</p>
              )}
            </div>
          ))}

          {payToMyAccountBlock}

          <button
            type="submit"
            disabled={loading || !referenceReady}
            className="landing-start-verify-btn w-full py-4 text-base font-extrabold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={20} className="text-[#E4C977]" />
            <span>{loading ? t('check.verifying') : t('check.verifyPaymentId')}</span>
            <ArrowRight size={18} className="opacity-90" />
          </button>
          <p className="text-[11px] text-[#40564C] text-center font-medium">
            {t('check.costRange')}
          </p>
        </form>
      )}

      {step === 3 && verifyMode === 'sms' && (
        <form onSubmit={runSmsVerify} className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-5 h-5 rounded-full bg-[#1B463A] text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
              <p className="text-xs font-bold text-[#091A16] uppercase tracking-wider">{t('check.stepSms')}</p>
            </div>
            <p className="text-xs text-[#40564C] mb-3">{t('check.stepSmsHint')}</p>
          </div>

          <div>
            <label className="label text-xs font-bold text-[#091A16] mb-1 block">{t('check.smsLabel')}</label>
            <textarea
              className="input w-full min-h-[8rem] font-mono text-xs rounded-xl p-3"
              placeholder={SMS_PLACEHOLDERS[method]}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              required
            />
            <p className="text-[11px] text-[#40564C] mt-1.5 font-medium">
              {method === 'telebirr'
                ? t('check.stepSmsHintTelebirr')
                : t('check.stepSmsHintCbe')}
            </p>
          </div>

          {payToMyAccountBlock}

          <button
            type="submit"
            disabled={loading || smsText.trim().length < 40}
            className="landing-start-verify-btn w-full py-4 text-base font-extrabold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ShieldCheck size={20} className="text-[#E4C977]" />
            <span>{loading ? t('check.verifying') : t('check.verifySms')}</span>
            <ArrowRight size={18} className="opacity-90" />
          </button>
          <p className="text-[11px] text-[#40564C] text-center font-medium">
            {t('check.costRange')}
          </p>
        </form>
      )}
    </div>
  )

  const template = (
    <VerificationFormatGuide
      method={method}
      mode={verifyMode || 'screenshot'}
    />
  )

  if (embedded) {
    return (
      <div className={`verify-stage${showingResult ? ' is-result' : ''}`} id="verify-desk">
        <section className="verify-desk">
          {flow}
        </section>
        {!showingResult && (
          <div className="verify-template">
            {template}
          </div>
        )}
      </div>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('check.title')} wide={!showingResult}>
      <div className={`modal-body${showingResult ? '' : ' modal-split'}`}>
        <div className={showingResult ? '' : 'modal-split-main modal-split-main-pad'}>{flow}</div>
        {!showingResult && template}
      </div>
    </Modal>
  )
}
