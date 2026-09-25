import { useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import useIsOnline from '../hooks/useIsOnline'
import { alertIfOffline } from '../lib/guardOnline'
import VerificationCertificate from './VerificationCertificate'
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

function getCheckCostByAmount(amount) {
  const numAmount = parseFloat(amount) || 0
  if (numAmount < 100) return 2
  if (numAmount < 1000) return 5
  if (numAmount < 5000) return 10
  if (numAmount < 10000) return 15
  return 20
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
  const online = useIsOnline()
  const navigation = useNavigation()
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

  const active = embedded || visible

  // Multi-stage loading animation
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

  const methods = useMemo(
    () => [
      { id: 'telebirr', label: 'Telebirr' },
      { id: 'cbe', label: 'Commercial Bank of Ethiopia' },
      { id: 'boa', label: 'Bank of Abyssinia' },
      { id: 'dashen', label: 'Dashen Bank' },
    ],
    [],
  )

  const visibleMethods = useMemo(
    () =>
      methods.filter((m) => {
        const bank = channelMap[m.id]
        return !bank || bank.enabled !== false
      }),
    [methods, channelMap],
  )

  const enabledModes = useMemo(() => {
    if (!method) return ['screenshot', 'sms', 'reference']
    const bank = channelMap[method]
    return ['screenshot', 'sms', 'reference'].filter((mode) => {
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
    const modes = ['screenshot', 'sms', 'reference'].filter((mode) => {
      if (mode === 'sms' && !SMS_SUPPORTED.has(id)) return false
      if (!bank) return true
      return Boolean(bank.modes?.[mode])
    })
    const nextMode = modes.includes(verifyMode) ? verifyMode : modes[0] || 'screenshot'
    setVerifyMode(nextMode)
    setStep(3)
  }

  useEffect(() => {
    if (!pickedBank && visibleMethods[0] && Object.keys(channelMap).length) {
      selectBank(visibleMethods[0].id)
    }
  }, [visibleMethods, channelMap, pickedBank])

  const referenceFieldsByMethod = useMemo(
    () => ({
      telebirr: [
        {
          key: 'transactionCode',
          label: 'Telebirr Invoice No.',
          placeholder: 'DG65L5I9M5',
          hint: 'Format starts with TBL... or alphanumeric code',
        },
      ],
      dashen: [
        {
          key: 'transactionCode',
          label: 'Dashen IPSS Reference',
          placeholder: '110IPSS2616900WO',
          hint: 'Format starts with IPSS or 110IPSS...',
        },
      ],
      cbe: [
        {
          key: 'transactionCode',
          label: 'CBE Token or Reference',
          placeholder: 'FT26226GC3H3 or v2-...',
          hint: 'Format starts with FT... or receipt token URL',
        },
        {
          key: 'accountSuffix',
          label: 'Recipient Account Number',
          placeholder: '1000...',
          hint: 'Target account for validation',
          legacyOnly: true,
        },
      ],
      boa: [
        {
          key: 'transactionCode',
          label: 'BOA Transaction Reference',
          placeholder: 'TT26171RW0YG',
          hint: 'Format starts with TT...',
        },
        {
          key: 'accountSuffix',
          label: 'Account Number Suffix',
          placeholder: '246302723',
          hint: 'Last digits of receiver account',
        },
      ],
    }),
    [],
  )

  const savedForMethod = savedAccounts.find((a) => a.method === method && a.accountNumber)
  const canMatchMyAccount = Boolean(savedForMethod)
  const defaultAccountLine = 'seifeslasie asmamaw abebe · 0989886956'
  const displayAccount = savedForMethod
    ? `${savedForMethod.accountName} · ${savedForMethod.accountNumber}`
    : defaultAccountLine

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    api
      .get('/me/accounts')
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
    api
      .get('/check/channels')
      .then((res) => {
        if (cancelled) return
        if (res.status >= 400) {
          setChannelMap({})
          return
        }
        const banks = unwrap(res).banks || []
        const next = {}
        banks.forEach((bank) => {
          next[bank.id] = bank
        })
        setChannelMap(next)
      })
      .catch(() => {
        if (!cancelled) setChannelMap({})
      })
    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    if (!active) return
    dispatch(clearError())
    setRejected(false)
    setFailureIssues([])
  }, [active, dispatch])

  const referenceFields = useMemo(() => {
    const fields = referenceFieldsByMethod[method] || referenceFieldsByMethod.telebirr
    if (method !== 'cbe') return fields
    if (isCbeFtLike(referenceForm.transactionCode) && !isCbeTokenLike(referenceForm.transactionCode)) {
      return fields
    }
    return fields.filter((f) => !f.legacyOnly)
  }, [method, referenceFieldsByMethod, referenceForm.transactionCode])

  const referenceReady = referenceFields.every((f) => String(referenceForm[f.key] || '').trim())

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
    setPickedBank(true)
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
      setFileDetails({
        name: asset.fileName || 'receipt.jpg',
        size: asset.fileSize ? `${(asset.fileSize / 1024).toFixed(1)} KB` : 'Image ready',
      })
    } catch (err) {
      Alert.alert(t('check.title'), err?.message || t('check.pickerFailed'))
    }
  }

  const runVerify = async () => {
    if (!alertIfOffline(online, t)) return
    if (!screenshot) {
      setFailureIssues([
        {
          code: 'SCREENSHOT_REQUIRED',
          field: 'screenshot',
          message: 'Please upload or choose a receipt screenshot to verify.',
        },
      ])
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

  const runReferenceVerify = async () => {
    if (!alertIfOffline(online, t)) return
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
    if (!alertIfOffline(online, t)) return
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

  // Recipient Account Fraud Shield ("Payment to my account")
  const payToMyAccountBlock = (
    <View
      style={[
        styles.payBox,
        matchMyAccount ? styles.payBoxOn : styles.payBoxOff,
      ]}
    >
      <View style={styles.payRow}>
        <View style={styles.payInfo}>
          <View style={styles.payTitleRow}>
            <Ionicons
              name="lock-closed"
              size={13}
              color={matchMyAccount ? colors.birrGreen : '#9CA3AF'}
            />
            <Text style={styles.payTitle}>Payment to my account</Text>
          </View>
          <Text style={styles.paySaved} numberOfLines={1}>
            {displayAccount}
          </Text>
        </View>

        <View style={styles.payActions}>
          <Switch
            value={matchMyAccount}
            onValueChange={setMatchMyAccount}
            trackColor={{ false: '#D1D5DB', true: colors.birrGreen }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#D1D5DB"
          />
          <Pressable onPress={openMyAccounts} hitSlop={8}>
            <Text style={styles.payManage}>Manage</Text>
          </Pressable>
        </View>
      </View>
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

  // ── Tampered / Security Alert View ──
  const failedOutcome = (
    <View style={styles.outcomeSpace}>
      <View style={styles.failHero}>
        <View style={styles.failHeroTop}>
          <View style={styles.failIconWrap}>
            <Ionicons name="shield" size={20} color="#F87171" />
          </View>
          <View style={styles.failHeroCopy}>
            <View style={styles.failBadge}>
              <Text style={styles.failBadgeText}>SECURITY ALERT</Text>
            </View>
            <Text style={styles.failTitle}>TAMPERED / MANIPULATION DETECTED</Text>
            <Text style={styles.failSubtitle}>
              This receipt failed cryptographic verification against official bank settlement ledgers or font metric baselines.
            </Text>
          </View>
        </View>
      </View>

      <VerificationFailureList issues={failureIssues} nested />

      <View style={styles.outcomeCta}>
        <Pressable
          style={styles.btnPrimary}
          onPress={() => {
            dismissLastAttempt()
            setStep(3)
          }}
        >
          <Ionicons name="refresh" size={16} color="#FFFFFF" />
          <Text style={styles.btnPrimaryText}>{t('common.tryAgain')}</Text>
        </Pressable>

        <Pressable style={styles.btnOutline} onPress={startAnother}>
          <Text style={styles.btnOutlineText}>Check Another Receipt</Text>
        </Pressable>
      </View>
    </View>
  )

  // ── Success Certificate View ──
  const successOutcome = (
    <View style={styles.outcomeSpace}>
      {checkForCert ? (
        <VerificationCertificate check={checkForCert} details={summaryDetails} />
      ) : null}
      <VerificationWarningList
        issues={
          lastResult?.validationResult?.issues ||
          successCheck?.validationResult?.issues ||
          []
        }
      />
      <View style={styles.successCtaRow}>
        <Text style={styles.feeNote}>
          {(successCheck || lastResult)?.isRecheck
            ? 'Free instant re-check record'
            : `Deducted ${
                (successCheck || lastResult)?.balanceDeducted ||
                getCheckCostByAmount(summaryDetails?.amount)
              } Birr from balance`}
        </Text>
        <Pressable style={styles.btnPrimary} onPress={startAnother}>
          <Text style={styles.btnPrimaryText}>Verify Another Receipt</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  )

  // ── Main Verify Interactive Flow ──
  const formFlow = (
    <View style={styles.formContainer}>
      {/* ── Step 1: Bank Selection (Spacious Heightened Cards) ── */}
      <View style={styles.stepSection}>
        <View style={styles.stepHeading}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>1</Text>
          </View>
          <Text style={styles.stepTitle}>CHOOSE BANK / MOBILE WALLET</Text>
        </View>

        <View style={styles.bankGrid}>
          {visibleMethods.map((m) => {
            const isSelected = method === m.id
            const meta = BANK_METADATA[m.id] || { name: m.label, type: 'Bank' }
            return (
              <Pressable
                key={m.id}
                onPress={() => selectBank(m.id)}
                style={[
                  styles.bankCard,
                  isSelected ? styles.bankCardSelected : styles.bankCardDefault,
                ]}
              >
                {isSelected ? (
                  <View style={styles.bankCheckBadge}>
                    <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                  </View>
                ) : null}

                <View style={styles.bankLogoWrap}>
                  <Image source={BANK_LOGOS[m.id]} style={styles.bankLogoImg} resizeMode="contain" />
                </View>

                <Text style={styles.bankLabel} numberOfLines={1}>
                  {m.label}
                </Text>
                <Text style={styles.bankType} numberOfLines={1}>
                  {meta.type}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* ── Step 2: Verification Method Selector ── */}
      <View style={styles.stepSection}>
        <View style={styles.stepHeading}>
          <View style={styles.stepCircle}>
            <Text style={styles.stepNumber}>2</Text>
          </View>
          <Text style={styles.stepTitle}>VERIFICATION METHOD</Text>
        </View>

        <View style={styles.modesRow}>
          <Pressable
            onPress={() => pickMode('screenshot')}
            style={[
              styles.modeTab,
              verifyMode === 'screenshot' ? styles.modeTabActive : styles.modeTabInactive,
            ]}
          >
            <Ionicons
              name="camera-outline"
              size={17}
              color={verifyMode === 'screenshot' ? '#E4C977' : colors.birrGreen}
            />
            <Text
              style={[
                styles.modeTabText,
                verifyMode === 'screenshot' ? styles.modeTabTextActive : styles.modeTabTextInactive,
              ]}
            >
              Screenshot
            </Text>
          </Pressable>

          <Pressable
            onPress={() => pickMode('sms')}
            style={[
              styles.modeTab,
              verifyMode === 'sms' ? styles.modeTabActive : styles.modeTabInactive,
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={17}
              color={verifyMode === 'sms' ? '#E4C977' : colors.birrGreen}
            />
            <Text
              style={[
                styles.modeTabText,
                verifyMode === 'sms' ? styles.modeTabTextActive : styles.modeTabTextInactive,
              ]}
            >
              SMS
            </Text>
          </Pressable>

          <Pressable
            onPress={() => pickMode('reference')}
            style={[
              styles.modeTab,
              verifyMode === 'reference' ? styles.modeTabActive : styles.modeTabInactive,
            ]}
          >
            <Ionicons
              name="keypad-outline"
              size={17}
              color={verifyMode === 'reference' ? '#E4C977' : colors.birrGreen}
            />
            <Text
              style={[
                styles.modeTabText,
                verifyMode === 'reference' ? styles.modeTabTextActive : styles.modeTabTextInactive,
              ]}
            >
              Payment ID
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Error alert */}
      {error && !rejected ? (
        <View style={styles.errorAlert}>
          <Ionicons name="alert-circle" size={16} color="#DC2626" />
          <Text style={styles.errorAlertText}>
            {typeof error === 'string' ? error : error.message || t('result.failed')}
          </Text>
        </View>
      ) : null}

      {/* ── Step 3: Input Form depending on chosen method ── */}
      {verifyMode === 'screenshot' ? (
        <View style={styles.stepSection}>
          <View style={styles.stepHeading}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepTitle}>UPLOAD RECEIPT SCREENSHOT</Text>
          </View>

          {/* Spacious Dropzone matching web client */}
          <Pressable
            style={[
              styles.dropzone,
              preview ? styles.dropzoneFilled : styles.dropzoneEmpty,
            ]}
            onPress={() => pickImage(false)}
          >
            {preview ? (
              <View style={styles.dropPreviewRow}>
                <View style={styles.dropPreviewThumbWrap}>
                  <Image source={{ uri: preview }} style={styles.dropPreviewThumb} resizeMode="contain" />
                </View>
                <View style={styles.dropPreviewInfo}>
                  <View style={styles.readyBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#FFFFFF" />
                    <Text style={styles.readyBadgeText}>Receipt Ready</Text>
                  </View>
                  {fileDetails ? (
                    <Text style={styles.fileDetailsText} numberOfLines={1}>
                      {fileDetails.name} · {fileDetails.size}
                    </Text>
                  ) : null}
                  <Text style={styles.changeLinkText}>Change Screenshot</Text>
                </View>
              </View>
            ) : (
              <View style={styles.dropEmptyContent}>
                <View style={styles.uploadIconCircle}>
                  <Ionicons name="cloud-upload" size={24} color={colors.birrGreen} />
                </View>
                <Text style={styles.dropMainText}>Choose Receipt Screenshot</Text>
                <Text style={styles.dropSubText}>
                  Supports PNG, JPG, or WEBP from Telebirr, CBE, Abyssinia, or Dashen.
                </Text>
                <View style={styles.dropActionsRow}>
                  <View style={styles.browseButton}>
                    <Ionicons name="images-outline" size={15} color="#FFFFFF" />
                    <Text style={styles.browseButtonText}>Browse Gallery</Text>
                  </View>
                  <Pressable
                    style={styles.cameraButton}
                    onPress={(e) => {
                      e.stopPropagation?.()
                      pickImage(true)
                    }}
                  >
                    <Ionicons name="camera-outline" size={15} color={colors.birrGreen} />
                    <Text style={styles.cameraButtonText}>Take Photo</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>

          {payToMyAccountBlock}

          {/* Multi-Stage Loading Progress Banner */}
          {loading ? (
            <View style={styles.loadingBanner}>
              <View style={styles.loadingBannerTop}>
                <View style={styles.loadingBannerLeft}>
                  <ActivityIndicator size="small" color="#C6A24E" />
                  <Text style={styles.loadingStageText}>{VERIFY_STAGES[activeStageIndex]}</Text>
                </View>
                <Text style={styles.loadingStepText}>Step {activeStageIndex + 1} of 4</Text>
              </View>
              <View style={styles.loadingTrack}>
                <View
                  style={[
                    styles.loadingBar,
                    { width: `${((activeStageIndex + 1) / VERIFY_STAGES.length) * 100}%` },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {/* Bottom Action Button */}
          <Pressable
            style={[styles.verifyButton, (!screenshot || loading) && styles.verifyButtonDisabled]}
            disabled={!screenshot || loading}
            onPress={runVerify}
          >
            {loading ? (
              <ActivityIndicator color="#F4EEDC" />
            ) : (
              <View style={styles.verifyBtnContent}>
                <Ionicons name="shield-checkmark" size={20} color="#E4C977" />
                <Text style={styles.verifyBtnText}>Verify Receipt</Text>
                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.9)" />
              </View>
            )}
          </Pressable>
          <Text style={styles.speedSub}>Takes &lt; 2s · Cryptographic seal · Anti-tamper inspection</Text>
        </View>
      ) : null}

      {verifyMode === 'reference' ? (
        <View style={styles.stepSection}>
          <View style={styles.stepHeading}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepTitle}>DIRECT PAYMENT ID QUERY</Text>
          </View>
          <Text style={styles.stepSub}>
            Enter the bank transaction reference number to query the official ledger directly.
          </Text>

          {referenceFields.map((field) => (
            <View key={field.key} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={styles.fieldInput}
                value={referenceForm[field.key]}
                onChangeText={(v) =>
                  setReferenceForm((prev) => ({ ...prev, [field.key]: v }))
                }
                placeholder={field.placeholder}
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {field.hint ? <Text style={styles.fieldHint}>{field.hint}</Text> : null}
            </View>
          ))}

          {payToMyAccountBlock}

          {loading ? (
            <View style={styles.loadingBanner}>
              <View style={styles.loadingBannerTop}>
                <View style={styles.loadingBannerLeft}>
                  <ActivityIndicator size="small" color="#C6A24E" />
                  <Text style={styles.loadingStageText}>{VERIFY_STAGES[activeStageIndex]}</Text>
                </View>
                <Text style={styles.loadingStepText}>Step {activeStageIndex + 1} of 4</Text>
              </View>
              <View style={styles.loadingTrack}>
                <View
                  style={[
                    styles.loadingBar,
                    { width: `${((activeStageIndex + 1) / VERIFY_STAGES.length) * 100}%` },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.verifyButton,
              (!referenceReady || loading) && styles.verifyButtonDisabled,
            ]}
            disabled={!referenceReady || loading}
            onPress={runReferenceVerify}
          >
            {loading ? (
              <ActivityIndicator color="#F4EEDC" />
            ) : (
              <View style={styles.verifyBtnContent}>
                <Ionicons name="shield-checkmark" size={20} color="#E4C977" />
                <Text style={styles.verifyBtnText}>Verify Receipt</Text>
                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.9)" />
              </View>
            )}
          </Pressable>
          <Text style={styles.speedSub}>Takes &lt; 2s · Cryptographic seal · Anti-tamper inspection</Text>
        </View>
      ) : null}

      {verifyMode === 'sms' ? (
        <View style={styles.stepSection}>
          <View style={styles.stepHeading}>
            <View style={styles.stepCircle}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
            <Text style={styles.stepTitle}>BANK SMS TEXT PARSER</Text>
          </View>
          <Text style={styles.stepSub}>
            Paste the complete SMS received from 127, CBE, or bank shortcodes.
          </Text>

          <View style={styles.smsHeaderRow}>
            <Text style={styles.fieldLabel}>SMS Message Content</Text>
            <Pressable
              onPress={() => {
                const sample = SMS_PLACEHOLDERS[method] || SMS_PLACEHOLDERS.telebirr
                setSmsText(sample)
              }}
              hitSlop={8}
            >
              <Text style={styles.pasteSampleLink}>Paste sample</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.smsTextarea}
            value={smsText}
            onChangeText={setSmsText}
            placeholder={
              SMS_PLACEHOLDERS[method] || 'Paste complete official bank transaction SMS here...'
            }
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            autoCorrect={false}
          />

          {payToMyAccountBlock}

          {loading ? (
            <View style={styles.loadingBanner}>
              <View style={styles.loadingBannerTop}>
                <View style={styles.loadingBannerLeft}>
                  <ActivityIndicator size="small" color="#C6A24E" />
                  <Text style={styles.loadingStageText}>{VERIFY_STAGES[activeStageIndex]}</Text>
                </View>
                <Text style={styles.loadingStepText}>Step {activeStageIndex + 1} of 4</Text>
              </View>
              <View style={styles.loadingTrack}>
                <View
                  style={[
                    styles.loadingBar,
                    { width: `${((activeStageIndex + 1) / VERIFY_STAGES.length) * 100}%` },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.verifyButton,
              (smsText.trim().length < 40 || loading) && styles.verifyButtonDisabled,
            ]}
            disabled={smsText.trim().length < 40 || loading}
            onPress={runSmsVerify}
          >
            {loading ? (
              <ActivityIndicator color="#F4EEDC" />
            ) : (
              <View style={styles.verifyBtnContent}>
                <Ionicons name="shield-checkmark" size={20} color="#E4C977" />
                <Text style={styles.verifyBtnText}>Verify Receipt</Text>
                <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.9)" />
              </View>
            )}
          </Pressable>
          <Text style={styles.speedSub}>Takes &lt; 2s · Cryptographic seal · Anti-tamper inspection</Text>
        </View>
      ) : null}
    </View>
  )

  const activeContent = rejected ? failedOutcome : step === successStep ? successOutcome : formFlow

  if (embedded) {
    if (!active) return null
    return (
      <View style={styles.embeddedDesk}>
        {activeContent}
      </View>
    )
  }

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalScreen}>
        <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, space[4]) }]}>
          <Text style={styles.modalHeaderTitle}>Verify Receipt</Text>
          <Pressable onPress={handleClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.embeddedDesk}>
            {activeContent}
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  embeddedDesk: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.14)',
    padding: space[4],
    shadowColor: '#1B463A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: space[3],
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#091A16',
  },
  modalScroll: {
    padding: space[4],
    paddingBottom: space[10],
  },
  formContainer: {
    gap: space[4],
  },
  stepSection: {
    gap: space[2],
  },
  stepHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1B463A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#091A16',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  stepSub: {
    fontSize: 11,
    color: '#40564C',
    marginBottom: 4,
  },
  // ── Step 1: Bank Cards ──
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bankCard: {
    width: '48%',
    minHeight: 92,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bankCardDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.14)',
  },
  bankCardSelected: {
    backgroundColor: '#EBF5EE',
    borderWidth: 2,
    borderColor: '#1B463A',
  },
  bankCheckBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1B463A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankLogoWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  bankLogoImg: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  bankLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#091A16',
    textAlign: 'center',
  },
  bankType: {
    fontSize: 9,
    fontWeight: '600',
    color: '#40564C',
    marginTop: 1,
    textAlign: 'center',
  },
  // ── Step 2: Verification Mode Tabs ──
  modesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeTab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
  },
  modeTabActive: {
    backgroundColor: '#1B463A',
    borderWidth: 2,
    borderColor: '#1B463A',
  },
  modeTabInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(27,70,58,0.16)',
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '800',
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  modeTabTextInactive: {
    color: '#091A16',
  },
  // ── Step 3: Screenshot Dropzone ──
  dropzone: {
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
    padding: space[4],
  },
  dropzoneEmpty: {
    borderColor: 'rgba(27,70,58,0.22)',
    backgroundColor: 'rgba(250,248,245,0.85)',
  },
  dropzoneFilled: {
    borderColor: '#1B463A',
    backgroundColor: '#F2F8F4',
  },
  dropEmptyContent: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  uploadIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(27,70,58,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  dropMainText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#091A16',
    textAlign: 'center',
  },
  dropSubText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#40564C',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
  dropActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  browseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1B463A',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  cameraButtonText: {
    color: colors.birrGreen,
    fontSize: 12,
    fontWeight: '800',
  },
  dropPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropPreviewThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.2)',
    backgroundColor: '#FFFFFF',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropPreviewThumb: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  dropPreviewInfo: {
    flex: 1,
    gap: 3,
  },
  readyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1B463A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  readyBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  fileDetailsText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#40564C',
  },
  changeLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B463A',
    textDecorationLine: 'underline',
  },
  // ── Payment to My Account Block ──
  payBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  payBoxOn: {
    backgroundColor: '#EBF5EE',
    borderColor: 'rgba(27,70,58,0.3)',
  },
  payBoxOff: {
    backgroundColor: '#FAF8F5',
    borderColor: 'rgba(27,70,58,0.14)',
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  payInfo: {
    flex: 1,
  },
  payTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  payTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#091A16',
  },
  paySaved: {
    fontSize: 11,
    fontWeight: '600',
    color: '#40564C',
    marginTop: 2,
  },
  payActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payManage: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1B463A',
    textDecorationLine: 'underline',
  },
  // ── Multi-Stage Loading Banner ──
  loadingBanner: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.25)',
    gap: 6,
  },
  loadingBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  loadingStageText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B463A',
  },
  loadingStepText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#40564C',
    fontFamily: 'monospace',
  },
  loadingTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(27,70,58,0.12)',
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: '#1B463A',
    borderRadius: 3,
  },
  // ── Verify Receipt Button ──
  verifyButton: {
    backgroundColor: '#1B463A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1B463A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  speedSub: {
    fontSize: 11,
    color: '#40564C',
    textAlign: 'center',
    fontWeight: '500',
  },
  // ── Input Fields ──
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#091A16',
  },
  fieldInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: '#091A16',
  },
  fieldHint: {
    fontSize: 10,
    color: '#40564C',
    fontWeight: '500',
  },
  smsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pasteSampleLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1B463A',
    textDecorationLine: 'underline',
  },
  smsTextarea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.2)',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'monospace',
    color: '#091A16',
    minHeight: 80,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#F87171',
    borderRadius: 12,
    padding: 10,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  // ── Failure & Success Outcomes ──
  outcomeSpace: {
    gap: space[4],
  },
  failHero: {
    backgroundColor: '#7F1D1D',
    borderRadius: 18,
    padding: 14,
  },
  failHeroTop: {
    flexDirection: 'row',
    gap: 10,
  },
  failIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#991B1B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F87171',
  },
  failHeroCopy: {
    flex: 1,
    gap: 3,
  },
  failBadge: {
    backgroundColor: '#991B1B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  failBadgeText: {
    color: '#FEE2E2',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  failTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  failSubtitle: {
    color: '#FECACA',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  outcomeCta: {
    gap: 8,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1B463A',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.2)',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnOutlineText: {
    color: '#091A16',
    fontSize: 13,
    fontWeight: '700',
  },
  successCtaRow: {
    gap: 8,
  },
  feeNote: {
    fontSize: 12,
    fontWeight: '700',
    color: '#40564C',
    textAlign: 'center',
  },
})
