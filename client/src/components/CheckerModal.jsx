import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link } from 'react-router-dom'
import { Smartphone, Building2, RotateCcw, Upload, Hash, Camera, MessageSquare, XCircle, Check } from 'lucide-react'
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
    <div className={`pay-my-account ${payState}`}>
      <label
        className={`pay-my-account-toggle ${canMatchMyAccount ? '' : 'is-disabled'}`}
        title={canMatchMyAccount ? t('check.payToMyAccountHint') : t('check.payToMyAccountOff')}
      >
        <input
          type="checkbox"
          checked={matchMyAccount}
          disabled={!canMatchMyAccount}
          onChange={(e) => {
            matchUserOverrideRef.current = true
            setMatchMyAccount(e.target.checked)
          }}
        />
        <span className="pay-my-account-switch" aria-hidden="true" />
        <span className="pay-my-account-copy">
          <span className="pay-my-account-title">{t('check.payToMyAccount')}</span>
          {savedForMethod && (
            <span className="pay-my-account-meta">
              {savedForMethod.accountName} · {savedForMethod.accountNumber}
            </span>
          )}
        </span>
      </label>
      {!canMatchMyAccount && (
        <Link to="/accounts" onClick={embedded ? undefined : handleClose} className="pay-my-account-add">
          {t('check.addAccountLink')}
        </Link>
      )}
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
      <div className="verify-desk-head">
        <div>
          <h2 className="verify-desk-title">
            {t('check.title')}
            <span className="verify-live">{t('check.liveStamp')}</span>
          </h2>
          <p className="verify-desk-desc">{t('check.deskHint')}</p>
        </div>
      </div>

      <p className="verify-step"><span className="verify-step-num">1</span>{t('check.stepMethod')}</p>
      <div className="verify-bank-grid">
        {visibleMethods.length === 0 && (
          <p className="text-sm text-[var(--color-text-secondary)] col-span-full">{t('check.noChannels')}</p>
        )}
        {visibleMethods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => selectBank(m.id)}
            className={`verify-bank${method === m.id ? ' is-active' : ''}`}
            aria-label={m.label}
            aria-pressed={method === m.id}
          >
            <span className="verify-pick" aria-hidden="true">
              <Check size={10} strokeWidth={3} />
            </span>
            <span className="verify-bank-mark">
              <img src={BANK_LOGOS[m.id]} alt="" width="32" height="32" />
            </span>
            <span className="verify-bank-name">{t(`method.short.${m.id}`)}</span>
          </button>
        ))}
      </div>

      {method && enabledModes.length > 0 && (
        <>
          <p className="verify-step"><span className="verify-step-num">2</span>{t('check.stepMode')}</p>
          <div className="verify-mode-grid" role="tablist">
            {enabledModes.includes('screenshot') && (
              <button type="button" role="tab" aria-selected={verifyMode === 'screenshot'} className={`verify-mode-btn${verifyMode === 'screenshot' ? ' is-active' : ''}`} onClick={() => pickMode('screenshot')}>
                <span className="verify-pick" aria-hidden="true"><Check size={10} strokeWidth={3} /></span>
                <Camera size={18} strokeWidth={2} />
                {t('check.modeScreenshotShort')}
              </button>
            )}
            {enabledModes.includes('sms') && (
              <button type="button" role="tab" aria-selected={verifyMode === 'sms'} className={`verify-mode-btn${verifyMode === 'sms' ? ' is-active' : ''}`} onClick={() => pickMode('sms')}>
                <span className="verify-pick" aria-hidden="true"><Check size={10} strokeWidth={3} /></span>
                <MessageSquare size={18} strokeWidth={2} />
                {t('check.modeSmsShort')}
              </button>
            )}
            {enabledModes.includes('reference') && (
              <button type="button" role="tab" aria-selected={verifyMode === 'reference'} className={`verify-mode-btn${verifyMode === 'reference' ? ' is-active' : ''}`} onClick={() => pickMode('reference')}>
                <span className="verify-pick" aria-hidden="true"><Check size={10} strokeWidth={3} /></span>
                <Hash size={18} strokeWidth={2} />
                {t('check.modeReferenceShort')}
              </button>
            )}
          </div>
        </>
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
    <div className="space-y-1">
      {selector}
      {error && !rejected && step === 3 && (
        <div className="alert alert-error mt-4">
          <p className="font-semibold text-sm">{typeof error === 'string' ? error : error.message || t('result.failed')}</p>
        </div>
      )}

      {step === 3 && verifyMode === 'screenshot' && (
              <div className="verify-flow">
                <form onSubmit={handleQuickVerify} className="verify-flow-form">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepUpload')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {method === 'telebirr'
                      ? t('check.stepUploadHintTelebirr')
                      : t('check.stepUploadHintOther')}
                  </p>
                </div>

                <div>
                  <label className={`upload-box${preview ? ' has-file' : ''}`}>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} required />
                    <span className="upload-box-icon" aria-hidden="true">
                      <Upload size={22} strokeWidth={2.25} />
                    </span>
                    <span className="upload-box-title">
                      {preview ? t('check.changeFile') : t('check.uploadReceipt')}
                    </span>
                    <span className="upload-box-hint">
                      {preview ? t('check.screenshotUploaded') : t('check.uploadHint')}
                    </span>
                    <span className="upload-box-cta">
                      {preview ? t('check.changeFile') : t('check.uploadBtn')}
                    </span>
                    {preview && (
                      <img src={preview} alt="" className="upload-preview" />
                    )}
                  </label>
                </div>

                <div className="space-y-2.5">
                  {payToMyAccountBlock}
                  <button type="submit" disabled={loading || !screenshot} className="btn-verify w-full">
                    {loading ? t('check.verifying') : t('check.verifyBtn')}
                  </button>
                </div>
              </form>
              </div>
            )}

            {step === 3 && verifyMode === 'reference' && (
              <div className="verify-flow">
              <form onSubmit={runReferenceVerify} className="verify-flow-form">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepPaymentId')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {t('check.stepPaymentIdHint')}
                  </p>
                </div>

                <div className="rounded-lg p-3 border text-[var(--text-xs)]" style={{ background: 'var(--color-accent-muted)', borderColor: 'var(--color-accent-border)' }}>
                  <p className="font-semibold text-[var(--text-sm)] mb-1">
                    {methods.find((m) => m.id === method)?.label}
                  </p>
                  <p className="text-[var(--color-text-secondary)]">
                    {referenceDetailByMethod[method]}
                  </p>
                </div>

                {referenceFields.map((field) => (
                  <div key={field.key}>
                    <label className="label">{field.label}</label>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder={field.placeholder}
                      value={referenceForm[field.key]}
                      onChange={(e) => handleReferenceChange(field.key, e.target.value)}
                      required
                    />
                    {field.hint && (
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">{field.hint}</p>
                    )}
                  </div>
                ))}

                <div className="space-y-2.5">
                  {payToMyAccountBlock}
                  <button type="submit" disabled={loading || !referenceReady} className="btn-verify w-full">
                    {loading ? t('check.verifying') : t('check.verifyPaymentId')}
                  </button>
                </div>
                <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] text-center">
                  {t('check.costRange')}
                </p>
              </form>
              </div>
            )}

            {step === 3 && verifyMode === 'sms' && (
              <div className="verify-flow">
              <form onSubmit={runSmsVerify} className="verify-flow-form">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t('check.stepSms')}</p>
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-1">
                    {t('check.stepSmsHint')}
                  </p>
                </div>

                <div>
                  <label className="label">{t('check.smsLabel')}</label>
                  <textarea
                    className="input w-full min-h-[7.5rem] font-mono text-[var(--text-xs)]"
                    placeholder={SMS_PLACEHOLDERS[method]}
                    value={smsText}
                    onChange={(e) => setSmsText(e.target.value)}
                    required
                  />
                  <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] mt-2">
                    {method === 'telebirr'
                      ? t('check.stepSmsHintTelebirr')
                      : t('check.stepSmsHintCbe')}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {payToMyAccountBlock}
                  <button type="submit" disabled={loading || smsText.trim().length < 40} className="btn-verify w-full">
                    {loading ? t('check.verifying') : t('check.verifySms')}
                  </button>
                </div>
                <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)] text-center">
                  {t('check.costRange')}
                </p>
              </form>
              </div>
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
