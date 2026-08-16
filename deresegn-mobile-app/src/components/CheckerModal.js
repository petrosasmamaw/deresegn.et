import { useEffect, useMemo, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import VerificationCertificate from './VerificationCertificate'
import VerificationFormatGuide from './VerificationFormatGuide'
import {
  VerificationFailureList,
  VerificationWarningList,
} from './VerificationResult'
import { ui } from '../theme/styles'
import { colors, radius, space } from '../theme/tokens'
import { api } from '../api/http'
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
  telebirr: require('../../assets/banks/telebirr.jpg'),
  cbe: require('../../assets/banks/cbe.png'),
  boa: require('../../assets/banks/boa.jpg'),
  dashen: require('../../assets/banks/dashen.png'),
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

function getCheckCostByAmount(amount) {
  const numAmount = parseFloat(amount) || 0
  if (numAmount < 100) return 2
  if (numAmount < 1000) return 5
  if (numAmount < 5000) return 10
  if (numAmount < 10000) return 15
  return 20
}

function PickBadge() {
  return (
    <View style={styles.pick}>
      <Ionicons name="checkmark" size={10} color="#fff" />
    </View>
  )
}

export default function CheckerModal({
  visible = false,
  embedded = false,
  onClose,
  onSubmit,
  onReferenceSubmit,
  onSmsSubmit,
  loading,
  error,
  lastResult,
  lastResolvedDetails,
}) {
  const { t } = useLocale()
  const dispatch = useDispatch()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
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

  const active = embedded || visible

  const methods = useMemo(
    () => [
      { id: 'telebirr', label: t('method.telebirr') },
      { id: 'cbe', label: t('method.cbe') },
      { id: 'boa', label: t('method.boa') },
      { id: 'dashen', label: t('method.dashen') },
    ],
    [t],
  )

  const visibleMethods = useMemo(
    () => methods.filter((m) => {
      const bank = channelMap[m.id]
      return !bank || bank.enabled !== false
    }),
    [methods, channelMap],
  )

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

  const referenceFieldsByMethod = useMemo(
    () => ({
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
    }),
    [t],
  )

  const referenceDetailByMethod = useMemo(
    () => ({
      telebirr: t('ref.telebirrDetail'),
      dashen: t('ref.dashenDetail'),
      cbe: t('ref.cbeDetail'),
      boa: t('ref.boaDetail'),
    }),
    [t],
  )

  const savedForMethod = savedAccounts.find((a) => a.method === method && a.accountNumber)
  const canMatchMyAccount = Boolean(savedForMethod)

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    api.get('/me/accounts')
      .then((res) => {
        if (cancelled) return
        if (res.status >= 400) {
          setSavedAccounts([])
          return
        }
        setSavedAccounts(unwrap(res).accounts || [])
      })
      .catch(() => {
        if (!cancelled) setSavedAccounts([])
      })
    api.get('/check/channels')
      .then((res) => {
        if (cancelled) return
        if (res.status >= 400) {
          setChannelMap({})
          return
        }
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

  useEffect(() => {
    setMatchMyAccount(canMatchMyAccount)
  }, [canMatchMyAccount, method])

  const referenceFields = useMemo(() => {
    const fields = referenceFieldsByMethod[method] || []
    if (method !== 'cbe') return fields
    if (isCbeFtLike(referenceForm.transactionCode) && !isCbeTokenLike(referenceForm.transactionCode)) {
      return fields
    }
    return fields.filter((f) => !f.legacyOnly)
  }, [method, referenceFieldsByMethod, referenceForm.transactionCode])

  const referenceReady = referenceFields.every((f) => String(referenceForm[f.key] || '').trim())

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
    setPickedBank(false)
    dispatch(clearError())
  }

  const handleClose = () => {
    resetForm()
    onClose?.()
  }

  const successStep = 4

  const dismissLastAttempt = () => {
    setRejected(false)
    setFailureIssues([])
    dispatch(clearError())
  }

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

  const pickImage = async (fromCamera) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          Alert.alert(t('check.title'), t('check.cameraPermission'))
          return
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!perm.granted) {
          Alert.alert(t('check.title'), t('check.libraryPermission'))
          return
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })

      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      setScreenshot({
        uri: asset.uri,
        width: asset.width,
        height: asset.height,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || 'receipt.jpg',
      })
      setPreview(asset.uri)
    } catch (err) {
      Alert.alert(t('check.title'), err?.message || t('check.pickerFailed'))
    }
  }

  const runVerify = async () => {
    if (!screenshot) {
      setFailureIssues([{ code: 'SCREENSHOT_REQUIRED', field: 'screenshot', message: t('check.screenshotRequired') }])
      setRejected(true)
      return
    }
    setRejected(false)
    setFailureIssues([])
    const result = await onSubmit({ screenshot, method, form: EMPTY_FORM, withDetails: false, matchMyAccount })
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

  const runReferenceVerify = async () => {
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

  const runSmsVerify = async () => {
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

  const openMyAccounts = () => {
    if (!embedded) handleClose()
    navigation.navigate('MyAccounts')
  }

  const payToMyAccountBlock = (
    <View style={[styles.payBox, matchMyAccount && styles.payBoxOn, !canMatchMyAccount && styles.payBoxLocked]}>
      <Pressable
        disabled={!canMatchMyAccount}
        onPress={() => canMatchMyAccount && setMatchMyAccount((v) => !v)}
        style={styles.payRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: matchMyAccount, disabled: !canMatchMyAccount }}
        accessibilityLabel={t('check.payToMyAccount')}
      >
        <View style={[styles.paySwitch, matchMyAccount && styles.paySwitchOn, !canMatchMyAccount && styles.paySwitchLocked]}>
          <View style={[styles.payKnob, matchMyAccount && styles.payKnobOn]} />
        </View>
        <View style={styles.payCopy}>
          <Text style={[styles.payTitle, !canMatchMyAccount && styles.payTitleLocked]}>
            {t('check.payToMyAccount')}
          </Text>
          {savedForMethod ? (
            <Text style={styles.paySaved} numberOfLines={1}>
              {savedForMethod.accountName} · {savedForMethod.accountNumber}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {!canMatchMyAccount ? (
        <Pressable onPress={openMyAccounts} style={styles.payAdd}>
          <Text style={styles.payAddText}>{t('check.addAccountLink')}</Text>
        </Pressable>
      ) : null}
    </View>
  )

  const summaryDetails =
    successDetails ||
    lastResolvedDetails ||
    (lastResult
      ? {
          senderName: lastResult.senderName,
          senderAccount: lastResult.senderAccount,
          receiverName: lastResult.receiverName,
          receiverAccount: lastResult.receiverAccount,
          amount: lastResult.amount,
          transactionCode: lastResult.transactionCode,
        }
      : null)

  const checkForCert = successCheck || lastResult
  const previousVerification = checkForCert?.previousVerification || null
  const previousVerificationLabel =
    previousVerification?.verifiedBy === 'self'
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

  const showingResult = rejected || step === successStep

  const selector = (
    <>
      <View style={styles.deskHead}>
        <View style={styles.titleRow}>
          <Text style={styles.deskTitle}>{t('check.title')}</Text>
          <Text style={styles.liveStamp}>{t('check.liveStamp')}</Text>
        </View>
        <Text style={styles.deskHint}>{t('check.deskHint')}</Text>
      </View>

      <Text style={styles.stepLabel}>
        <Text style={styles.stepNum}>1 </Text>
        {t('check.stepMethod')}
      </Text>
      <View style={styles.bankGrid}>
        {visibleMethods.length === 0 ? (
          <Text style={styles.stepHint}>{t('check.noChannels')}</Text>
        ) : null}
        {visibleMethods.map((m) => {
          const on = method === m.id
          return (
            <Pressable
              key={m.id}
              onPress={() => selectBank(m.id)}
              style={[styles.bank, on && styles.bankOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={m.label}
            >
              {on ? <PickBadge /> : null}
              <View style={styles.bankMark}>
                <Image source={BANK_LOGOS[m.id]} style={styles.bankLogo} />
              </View>
              <Text style={[styles.bankName, on && styles.bankNameOn]} numberOfLines={1}>
                {t(`method.short.${m.id}`)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {method && enabledModes.length > 0 ? (
        <>
          <Text style={styles.stepLabel}>
            <Text style={styles.stepNum}>2 </Text>
            {t('check.stepMode')}
          </Text>
          <View style={styles.modeGrid}>
            {enabledModes.includes('screenshot') ? (
              <Pressable
                onPress={() => pickMode('screenshot')}
                style={[styles.modeBtn, verifyMode === 'screenshot' && styles.bankOn]}
              >
                {verifyMode === 'screenshot' ? <PickBadge /> : null}
                <Ionicons name="camera-outline" size={18} color={verifyMode === 'screenshot' ? colors.birrGreen : colors.ink} />
                <Text style={[styles.modeName, verifyMode === 'screenshot' && styles.bankNameOn]}>
                  {t('check.modeScreenshotShort')}
                </Text>
              </Pressable>
            ) : null}
            {enabledModes.includes('sms') ? (
              <Pressable
                onPress={() => pickMode('sms')}
                style={[styles.modeBtn, verifyMode === 'sms' && styles.bankOn]}
              >
                {verifyMode === 'sms' ? <PickBadge /> : null}
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={verifyMode === 'sms' ? colors.birrGreen : colors.ink} />
                <Text style={[styles.modeName, verifyMode === 'sms' && styles.bankNameOn]}>
                  {t('check.modeSmsShort')}
                </Text>
              </Pressable>
            ) : null}
            {enabledModes.includes('reference') ? (
              <Pressable
                onPress={() => pickMode('reference')}
                style={[styles.modeBtn, verifyMode === 'reference' && styles.bankOn]}
              >
                {verifyMode === 'reference' ? <PickBadge /> : null}
                <Ionicons name="keypad-outline" size={18} color={verifyMode === 'reference' ? colors.birrGreen : colors.ink} />
                <Text style={[styles.modeName, verifyMode === 'reference' && styles.bankNameOn]}>
                  {t('check.modeReferenceShort')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}
    </>
  )

  const flow = rejected ? (
    <View style={styles.outcome}>
      <View style={styles.failHero}>
        <Ionicons name="close-circle" size={32} color={colors.maroon} />
        <Text style={styles.outcomeTitle}>{t('result.couldNotVerify')}</Text>
        <Text style={styles.outcomeLead}>{t('result.failedHint')}</Text>
      </View>
      <VerificationFailureList issues={failureIssues} nested />
      <View style={styles.rowBtns}>
        <Pressable
          style={[ui.btnSecondary, styles.flexBtn]}
          onPress={() => {
            dismissLastAttempt()
            setStep(3)
          }}
        >
          <Text style={ui.btnSecondaryText}>{t('common.tryAgain')}</Text>
        </Pressable>
        <Pressable style={[styles.anotherBtn, styles.flexBtn]} onPress={embedded ? startAnother : handleClose}>
          <Text style={styles.anotherText}>{embedded ? t('check.another') : t('common.close')}</Text>
        </Pressable>
      </View>
    </View>
  ) : step === successStep ? (
    <View style={styles.outcome}>
      {previousVerificationLabel ? (
        <Text style={styles.prevLine}>
          {previousVerificationLabel}
          {previousVerificationMeta ? ` · ${t('check.verifiedOn', { when: previousVerificationMeta })}` : ''}
        </Text>
      ) : null}
      {checkForCert ? <VerificationCertificate check={checkForCert} details={summaryDetails} /> : null}
      <VerificationWarningList issues={checkForCert?.validationResult?.issues || []} />
      <Text style={styles.balanceNote}>
        {checkForCert?.isRecheck
          ? t('check.noCharge')
          : t('check.deducted', {
              amount: checkForCert?.balanceDeducted || getCheckCostByAmount(summaryDetails?.amount),
            })}
      </Text>
      <Pressable style={styles.anotherBtn} onPress={embedded ? startAnother : handleClose}>
        <Text style={styles.anotherText}>{embedded ? t('check.another') : t('check.complete')}</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.flow}>
      {selector}
      {error && !rejected && step === 3 ? (
        <View style={ui.errorBox}>
          <Text style={ui.errorText}>
            {typeof error === 'string' ? error : error.message || t('result.failed')}
          </Text>
        </View>
      ) : null}

      {step === 3 && verifyMode === 'screenshot' ? (
        <>
          <Text style={styles.stepTitle}>{t('check.stepUpload')}</Text>
          <Text style={styles.stepHint}>
            {method === 'telebirr' ? t('check.stepUploadHintTelebirr') : t('check.stepUploadHintOther')}
          </Text>
          <Pressable style={[styles.dropZone, preview && styles.dropHas]} onPress={() => pickImage(false)}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.birrGreen} />
            <Text style={styles.uploadTitle}>{preview ? t('check.changeFile') : t('check.uploadReceipt')}</Text>
            <Text style={styles.uploadHint}>{preview ? t('check.screenshotUploaded') : t('check.uploadHint')}</Text>
            <Text style={styles.uploadCta}>{preview ? t('check.changeFile') : t('check.uploadBtn')}</Text>
            {preview ? <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" /> : null}
          </Pressable>
          <View style={styles.pickRow}>
            <Pressable style={[ui.btnSecondary, styles.flexBtn]} onPress={() => pickImage(false)}>
              <Text style={ui.btnSecondaryText}>{t('check.uploadBtn')}</Text>
            </Pressable>
            <Pressable style={[ui.btnSecondary, styles.flexBtn]} onPress={() => pickImage(true)}>
              <Text style={ui.btnSecondaryText}>{t('check.camera')}</Text>
            </Pressable>
          </View>
          {payToMyAccountBlock}
          <Pressable
            style={[ui.btnPrimary, (!screenshot || loading) && ui.btnDisabled]}
            disabled={!screenshot || loading}
            onPress={runVerify}
          >
            {loading ? <ActivityIndicator color={colors.ink} /> : (
              <Text style={ui.btnPrimaryText}>{t('check.verifyBtn')}</Text>
            )}
          </Pressable>
          {loading ? <Text style={styles.verifying}>{t('check.verifying')}</Text> : null}
        </>
      ) : null}

      {step === 3 && verifyMode === 'reference' ? (
        <>
          <Text style={styles.stepTitle}>{t('check.stepPaymentId')}</Text>
          <Text style={styles.stepHint}>{t('check.stepPaymentIdHint')}</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>{methods.find((m) => m.id === method)?.label}</Text>
            <Text style={styles.infoBody}>{referenceDetailByMethod[method]}</Text>
          </View>
          {referenceFields.map((field) => (
            <View key={field.key}>
              <Text style={ui.label}>{field.label}</Text>
              <TextInput
                style={ui.input}
                value={referenceForm[field.key]}
                onChangeText={(v) => setReferenceForm((prev) => ({ ...prev, [field.key]: v }))}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {field.hint ? <Text style={ui.helper}>{field.hint}</Text> : null}
            </View>
          ))}
          {payToMyAccountBlock}
          <Pressable
            style={[ui.btnPrimary, (!referenceReady || loading) && ui.btnDisabled]}
            disabled={!referenceReady || loading}
            onPress={runReferenceVerify}
          >
            {loading ? <ActivityIndicator color={colors.ink} /> : (
              <Text style={ui.btnPrimaryText}>{t('check.verifyPaymentId')}</Text>
            )}
          </Pressable>
          <Text style={styles.costHint}>{t('check.costRange')}</Text>
        </>
      ) : null}

      {step === 3 && verifyMode === 'sms' ? (
        <>
          <Text style={styles.stepTitle}>{t('check.stepSms')}</Text>
          <Text style={styles.stepHint}>{t('check.stepSmsHint')}</Text>
          <Text style={ui.label}>{t('check.smsLabel')}</Text>
          <TextInput
            style={[ui.input, styles.smsInput]}
            value={smsText}
            onChangeText={setSmsText}
            placeholder={SMS_PLACEHOLDERS[method]}
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
          />
          <Text style={ui.helper}>
            {method === 'telebirr' ? t('check.stepSmsHintTelebirr') : t('check.stepSmsHintCbe')}
          </Text>
          {payToMyAccountBlock}
          <Pressable
            style={[ui.btnPrimary, (smsText.trim().length < 40 || loading) && ui.btnDisabled]}
            disabled={smsText.trim().length < 40 || loading}
            onPress={runSmsVerify}
          >
            {loading ? <ActivityIndicator color={colors.ink} /> : (
              <Text style={ui.btnPrimaryText}>{t('check.verifySms')}</Text>
            )}
          </Pressable>
          <Text style={styles.costHint}>{t('check.costRange')}</Text>
        </>
      ) : null}
    </View>
  )

  const body = (
    <View style={styles.stage}>
      <View style={styles.desk}>{flow}</View>
      {!showingResult ? (
        <View style={styles.template}>
          <VerificationFormatGuide method={method} mode={verifyMode || 'screenshot'} />
        </View>
      ) : null}
    </View>
  )

  if (embedded) {
    if (!active) return null
    return body
  }

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.sheet}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, space[4]) }]}>
          <Text style={styles.headerTitle}>{t('check.title')}</Text>
          <Pressable onPress={handleClose} hitSlop={12} accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  stage: { gap: space[4] },
  desk: {
    backgroundColor: colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    gap: space[3],
  },
  template: { marginBottom: space[2] },
  deskHead: { gap: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  deskTitle: { fontSize: 18, fontWeight: '800', color: colors.ink },
  liveStamp: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.verified,
    backgroundColor: 'rgba(62,143,98,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
    borderRadius: 999,
  },
  deskHint: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
  stepLabel: { fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 4 },
  stepNum: { color: colors.foilGold },
  bankGrid: { flexDirection: 'row', gap: 8 },
  bank: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 72,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(14,36,32,0.16)',
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  bankOn: {
    borderWidth: 2,
    borderColor: '#1B463A',
    backgroundColor: '#E8F3EC',
  },
  pick: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1B463A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankMark: {
    width: 32,
    height: 32,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(14,36,32,0.08)',
  },
  bankLogo: { width: '100%', height: '100%' },
  bankName: { fontSize: 10, fontWeight: '700', color: colors.ink },
  bankNameOn: { color: '#1B463A' },
  modeGrid: { flexDirection: 'row', gap: 8 },
  modeBtn: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 64,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(14,36,32,0.16)',
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  modeName: { fontSize: 11, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  flow: { gap: space[3] },
  stepTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  stepHint: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  dropZone: {
    borderWidth: 2,
    borderColor: '#1B463A',
    borderStyle: 'dashed',
    borderRadius: 14,
    backgroundColor: '#fff',
    padding: space[4],
    alignItems: 'center',
    gap: 6,
  },
  dropHas: { borderStyle: 'solid' },
  uploadTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  uploadHint: { fontSize: 12, color: colors.textSecondary, textAlign: 'center' },
  uploadCta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
    backgroundColor: colors.foilGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: 'hidden',
    borderRadius: 4,
  },
  preview: { width: '100%', height: 160, marginTop: 8, borderRadius: radius.sm },
  pickRow: { flexDirection: 'row', gap: space[2] },
  verifying: { textAlign: 'center', fontSize: 13, color: colors.textSecondary },
  infoBox: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(198, 162, 78, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.35)',
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: colors.ink },
  infoBody: { marginTop: 4, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  smsInput: { minHeight: 160, textAlignVertical: 'top', fontSize: 13 },
  costHint: { textAlign: 'center', fontSize: 12, color: colors.textSecondary },
  outcome: { gap: space[3] },
  failHero: { alignItems: 'center', gap: 8, paddingVertical: space[2] },
  outcomeTitle: { fontSize: 18, fontWeight: '800', color: colors.maroon, textAlign: 'center' },
  outcomeLead: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },
  prevLine: { fontSize: 13, fontWeight: '600', color: colors.ink },
  balanceNote: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  anotherBtn: {
    backgroundColor: colors.foilGold,
    borderRadius: radius.sm,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[5],
  },
  anotherText: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  rowBtns: { flexDirection: 'row', gap: space[3] },
  flexBtn: { flex: 1 },
  payBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  payBoxOn: {
    borderColor: 'rgba(62, 143, 98, 0.42)',
    backgroundColor: 'rgba(62, 143, 98, 0.1)',
  },
  payBoxLocked: { backgroundColor: colors.bgSubtle },
  payRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  paySwitch: {
    width: 32,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 36, 32, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  paySwitchOn: { backgroundColor: colors.verified },
  paySwitchLocked: { backgroundColor: 'rgba(14, 36, 32, 0.12)' },
  payKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
  },
  payKnobOn: { transform: [{ translateX: 14 }] },
  payCopy: { flex: 1, minWidth: 0 },
  payTitle: { fontSize: 13, fontWeight: '600', color: colors.ink },
  payTitleLocked: { color: 'rgba(14, 36, 32, 0.42)' },
  paySaved: { marginTop: 1, fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  payAdd: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.foilGold,
    backgroundColor: 'rgba(198, 162, 78, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payAddText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  sheet: { flex: 1, backgroundColor: colors.parchment },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[5],
    paddingBottom: space[4],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalBody: { padding: space[4], paddingBottom: space[12] },
})
