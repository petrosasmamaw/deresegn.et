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
import ReceiptSummaryCard from './ReceiptSummaryCard'
import VerificationCertificate from './VerificationCertificate'
import {
  VerificationFailureList,
  VerificationSuccessNote,
  VerificationWarningList,
} from './VerificationResult'
import { ui } from '../theme/styles'
import { colors, radius, space } from '../theme/tokens'
import { api } from '../api/http'
import { unwrap } from '../api/unwrap'
import { clearError } from '../features/checks/checksSlice'

const SMS_SUPPORTED = new Set(['telebirr', 'cbe', 'boa'])

const SMS_PLACEHOLDERS = {
  telebirr: `Dear customer
You have transferred ETB 60.00 ... transaction number is DFH51OFIED
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
  cbe: `Dear ... You have received ETB 2,000.00 ... Thanks for Banking with CBE.
https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
  boa: `Dear Petros, your account 2*23 was debited with ETB 200.00...
Receipt: https://cs.bankofabyssinia.com/slip/?trx=TT26171RW0YG02723
Bank of Abyssinia.`,
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

function SelectCard({ icon, title, desc, onPress, tint = colors.birrGreen }) {
  return (
    <Pressable style={styles.selectCard} onPress={onPress}>
      <Ionicons name={icon} size={22} color={tint} />
      <View style={styles.selectText}>
        <Text style={styles.selectTitle}>{title}</Text>
        <Text style={styles.selectDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={tint} />
    </Pressable>
  )
}

export default function CheckerModal({
  visible,
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

  const methods = useMemo(
    () => [
      { id: 'telebirr', label: t('method.telebirr'), icon: 'phone-portrait-outline', desc: t('method.telebirrCheckDesc') },
      { id: 'cbe', label: t('method.cbe'), icon: 'business-outline', desc: t('method.cbeCheckDesc') },
      { id: 'boa', label: t('method.boa'), icon: 'business-outline', desc: t('method.boaCheckDesc') },
      { id: 'dashen', label: t('method.dashen'), icon: 'business-outline', desc: t('method.dashenCheckDesc') },
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
    const bank = channelMap[id]
    const modes = ['screenshot', 'reference', 'sms'].filter((mode) => {
      if (mode === 'sms' && !SMS_SUPPORTED.has(id)) return false
      if (!bank) return true
      return Boolean(bank.modes?.[mode])
    })
    if (modes.length === 1) {
      setVerifyMode(modes[0])
      setStep(3)
    } else {
      setVerifyMode('')
      setStep(2)
    }
  }

  const backFromInput = () => {
    setRejected(false)
    setFailureIssues([])
    dispatch(clearError())
    if (enabledModes.length <= 1) {
      setVerifyMode('')
      setStep(1)
    } else {
      setStep(2)
    }
  }

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

  const uploadHints = useMemo(
    () => ({
      telebirr: t('upload.telebirr'),
      cbe: t('upload.cbe'),
      boa: t('upload.boa'),
      dashen: t('upload.dashen'),
    }),
    [t],
  )

  const savedForMethod = savedAccounts.find((a) => a.method === method && a.accountNumber)
  const canMatchMyAccount = Boolean(savedForMethod)

  useEffect(() => {
    if (!visible) return undefined
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
  }, [visible])

  useEffect(() => {
    if (!visible) return
    dispatch(clearError())
    setRejected(false)
    setFailureIssues([])
  }, [visible, dispatch])

  useEffect(() => {
    setMatchMyAccount(canMatchMyAccount)
  }, [canMatchMyAccount, method])

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

  const pickImage = async (fromCamera) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          Alert.alert(t('check.title'), 'Camera permission is required')
          return
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!perm.granted) {
          Alert.alert(t('check.title'), 'Photo library permission is required')
          return
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.9,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.9,
          })

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
      Alert.alert(t('check.title'), err?.message || 'Could not open image picker')
    }
  }

  const runVerify = async () => {
    if (!screenshot) {
      setFailureIssues([
        {
          code: 'SCREENSHOT_REQUIRED',
          field: 'screenshot',
          message: t('check.screenshotRequired'),
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
      setStep(4)
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

  const referenceFields = useMemo(() => {
    const fields = referenceFieldsByMethod[method] || []
    if (method !== 'cbe') return fields
    const code = String(referenceForm.transactionCode || '').trim()
    const ftLike = /^FT[A-Z0-9]{8,}/i.test(code.replace(/\s+/g, ''))
    const tokenLike = /mbreciept\.cbe\.com\.et/i.test(code) || /^v2-[A-Za-z0-9_-]{8,}/i.test(code)
    if (ftLike && !tokenLike) return fields
    return fields.filter((f) => !f.legacyOnly)
  }, [method, referenceFieldsByMethod, referenceForm.transactionCode])
  const referenceReady = referenceFields.every((f) =>
    String(referenceForm[f.key] || '').trim(),
  )

  const openMyAccounts = () => {
    handleClose()
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
        accessibilityHint={canMatchMyAccount ? t('check.payToMyAccountHint') : t('check.payToMyAccountOff')}
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
        <Pressable onPress={openMyAccounts} style={styles.payAdd} accessibilityRole="link">
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

  const successMessage =
    verifyMode === 'sms'
      ? t('check.successSms')
      : verifyMode === 'reference'
        ? t('check.successReference')
        : t('check.successReceipt')

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

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          {rejected ? (
            <>
              <VerificationFailureList issues={failureIssues} />
              <View style={styles.rowBtns}>
                <Pressable
                  style={[ui.btnSecondary, styles.flexBtn]}
                  onPress={() => {
                    setRejected(false)
                    setFailureIssues([])
                    dispatch(clearError())
                    setStep(3)
                  }}
                >
                  <Text style={ui.btnSecondaryText}>{t('common.tryAgain')}</Text>
                </Pressable>
                <Pressable style={[ui.btnPrimary, styles.flexBtn]} onPress={handleClose}>
                  <Text style={ui.btnPrimaryText}>{t('common.close')}</Text>
                </Pressable>
              </View>
            </>
          ) : step === successStep ? (
            <>
              {previousVerificationLabel ? (
                <View style={styles.prevBox}>
                  <Text style={styles.prevTitle}>{previousVerificationLabel}</Text>
                  <Text style={styles.prevHint}>
                    {previousVerification?.verifiedBy === 'self'
                      ? t('check.prevSelfHint')
                      : t('check.prevOtherHint')}
                    {previousVerificationMeta
                      ? ` ${t('check.verifiedOn', { when: previousVerificationMeta })}`
                      : ''}
                  </Text>
                </View>
              ) : null}

              <VerificationSuccessNote message={successMessage} />
              {checkForCert ? <VerificationCertificate check={checkForCert} /> : null}
              {summaryDetails ? <ReceiptSummaryCard details={summaryDetails} /> : null}
              <VerificationWarningList
                issues={
                  checkForCert?.validationResult?.issues ||
                  successCheck?.validationResult?.issues ||
                  []
                }
              />
              <View style={styles.balanceBox}>
                <Text style={styles.balanceTitle}>{t('check.balanceUpdate')}</Text>
                <Text style={styles.balanceText}>
                  {checkForCert?.isRecheck
                    ? t('check.noCharge')
                    : t('check.deducted', {
                        amount:
                          checkForCert?.balanceDeducted ||
                          getCheckCostByAmount(summaryDetails?.amount),
                      })}
                </Text>
              </View>
              <Pressable style={ui.btnPrimary} onPress={handleClose}>
                <Text style={ui.btnPrimaryText}>{t('check.complete')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {error && !rejected && step === 3 ? (
                <View style={ui.errorBox}>
                  <Text style={ui.errorText}>
                    {typeof error === 'string'
                      ? error
                      : error.message || t('result.failed')}
                  </Text>
                </View>
              ) : null}

              {step === 1 && (
                <>
                  <Text style={styles.stepTitle}>{t('check.stepMethod')}</Text>
                  <Text style={styles.stepHint}>{t('check.stepMethodHint')}</Text>
                  {visibleMethods.length === 0 && (
                    <Text style={styles.stepHint}>{t('check.noChannels')}</Text>
                  )}
                  {visibleMethods.map((m) => (
                    <SelectCard
                      key={m.id}
                      icon={m.icon}
                      title={m.label}
                      desc={m.desc}
                      onPress={() => selectBank(m.id)}
                    />
                  ))}
                </>
              )}

              {step === 2 && (
                <>
                  <Pressable onPress={() => {
                    setRejected(false)
                    setFailureIssues([])
                    dispatch(clearError())
                    setStep(1)
                  }}>
                    <Text style={styles.backLink}>{t('check.backMethod')}</Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{t('check.stepMode')}</Text>
                  <Text style={styles.stepHint}>{t('check.stepModeHint')}</Text>

                  {enabledModes.includes('screenshot') && (
                  <SelectCard
                    icon="camera-outline"
                    title={t('check.modeScreenshot')}
                    desc={t('check.modeScreenshotDesc')}
                    onPress={() => {
                      setVerifyMode('screenshot')
                      setStep(3)
                    }}
                  />
                  )}
                  {enabledModes.includes('reference') && (
                  <SelectCard
                    icon="keypad-outline"
                    title={t('check.modeReference')}
                    desc={t('check.modeReferenceDesc')}
                    tint={colors.foilGold}
                    onPress={() => {
                      setVerifyMode('reference')
                      setStep(3)
                    }}
                  />
                  )}
                  {enabledModes.includes('sms') && (
                    <SelectCard
                      icon="chatbubble-ellipses-outline"
                      title={t('check.modeSms')}
                      desc={t('check.modeSmsDesc')}
                      tint={colors.birrGreen}
                      onPress={() => {
                        setVerifyMode('sms')
                        setStep(3)
                      }}
                    />
                  )}

                  <View style={styles.guideBox}>
                    <Text style={styles.guideTitle}>{t('check.paymentIdGuide')}</Text>
                    <Text style={styles.guideLine}>
                      Telebirr → {t('ref.telebirrDetail')}
                    </Text>
                    <Text style={styles.guideLine}>
                      Dashen → {t('ref.dashenDetail')}
                    </Text>
                    <Text style={styles.guideLine}>CBE → {t('ref.cbeDetail')}</Text>
                    <Text style={styles.guideLine}>BOA → {t('ref.boaDetail')}</Text>
                    {enabledModes.includes('sms') && (
                      <Text style={[styles.guideLine, { marginTop: 8 }]}>
                        SMS → {t('check.smsGuide')}
                      </Text>
                    )}
                  </View>
                </>
              )}

              {step === 3 && verifyMode === 'screenshot' && (
                <>
                  <Pressable onPress={backFromInput}>
                    <Text style={styles.backLink}>{t('check.backType')}</Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{t('check.stepUpload')}</Text>
                  <Text style={styles.stepHint}>
                    {method === 'telebirr'
                      ? t('check.stepUploadHintTelebirr')
                      : t('check.stepUploadHintOther')}
                  </Text>

                  <Text style={ui.label}>{t('check.screenshotLabel')}</Text>
                  <View style={styles.dropZone}>
                    {preview ? (
                      <>
                        <Text style={styles.uploaded}>{t('check.screenshotUploaded')}</Text>
                        <Image source={{ uri: preview }} style={styles.preview} resizeMode="contain" />
                      </>
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={28} color={colors.birrGreen} />
                        <Text style={styles.uploadTitle}>{t('check.uploadReceipt')}</Text>
                        <Text style={styles.uploadHint}>{uploadHints[method]}</Text>
                      </>
                    )}
                    <View style={styles.pickRow}>
                      <Pressable
                        style={[ui.btnSecondary, styles.flexBtn]}
                        onPress={() => pickImage(false)}
                      >
                        <Text style={ui.btnSecondaryText}>{t('check.changeFile')}</Text>
                      </Pressable>
                      <Pressable
                        style={[ui.btnSecondary, styles.flexBtn]}
                        onPress={() => pickImage(true)}
                      >
                        <Text style={ui.btnSecondaryText}>Camera</Text>
                      </Pressable>
                    </View>
                  </View>

                  {payToMyAccountBlock}
                  <Pressable
                    style={[
                      ui.btnPrimary,
                      (!screenshot || loading) && ui.btnDisabled,
                    ]}
                    disabled={!screenshot || loading}
                    onPress={() => runVerify()}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={ui.btnPrimaryText}>{t('check.verifyBtn')}</Text>
                    )}
                  </Pressable>
                </>
              )}

              {step === 3 && verifyMode === 'reference' && (
                <>
                  <Pressable onPress={backFromInput}>
                    <Text style={styles.backLink}>{t('check.backType')}</Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{t('check.stepPaymentId')}</Text>
                  <Text style={styles.stepHint}>{t('check.stepPaymentIdHint')}</Text>

                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>
                      {methods.find((m) => m.id === method)?.label}
                    </Text>
                    <Text style={styles.infoBody}>{referenceDetailByMethod[method]}</Text>
                  </View>

                  {referenceFields.map((field) => (
                    <View key={field.key}>
                      <Text style={ui.label}>{field.label}</Text>
                      <TextInput
                        style={ui.input}
                        value={referenceForm[field.key]}
                        onChangeText={(v) =>
                          setReferenceForm((prev) => ({ ...prev, [field.key]: v }))
                        }
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
                    style={[
                      ui.btnPrimary,
                      (!referenceReady || loading) && ui.btnDisabled,
                    ]}
                    disabled={!referenceReady || loading}
                    onPress={runReferenceVerify}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={ui.btnPrimaryText}>{t('check.verifyPaymentId')}</Text>
                    )}
                  </Pressable>
                  <Text style={styles.costHint}>{t('check.costRange')}</Text>
                </>
              )}

              {step === 3 && verifyMode === 'sms' && (
                <>
                  <Pressable onPress={backFromInput}>
                    <Text style={styles.backLink}>{t('check.backType')}</Text>
                  </Pressable>
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
                    {method === 'telebirr'
                      ? t('check.stepSmsHintTelebirr')
                      : t('check.stepSmsHintCbe')}
                  </Text>

                  {payToMyAccountBlock}

                  <Pressable
                    style={[
                      ui.btnPrimary,
                      (smsText.trim().length < 40 || loading) && ui.btnDisabled,
                    ]}
                    disabled={smsText.trim().length < 40 || loading}
                    onPress={runSmsVerify}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={ui.btnPrimaryText}>{t('check.verifySms')}</Text>
                    )}
                  </Pressable>
                  <Text style={styles.costHint}>{t('check.costRange')}</Text>
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    padding: space[5],
    paddingBottom: space[12],
    gap: space[3],
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
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
  payBoxLocked: {
    backgroundColor: colors.bgSubtle,
  },
  payRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  paySwitch: {
    width: 32,
    height: 18,
    borderRadius: 999,
    backgroundColor: 'rgba(14, 36, 32, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  paySwitchOn: {
    backgroundColor: colors.verified,
  },
  paySwitchLocked: {
    backgroundColor: 'rgba(14, 36, 32, 0.12)',
  },
  payKnob: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#fff',
    shadowColor: '#0E2420',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  payKnobOn: {
    transform: [{ translateX: 14 }],
  },
  payCopy: {
    flex: 1,
    minWidth: 0,
  },
  payTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    lineHeight: 16,
  },
  payTitleLocked: {
    color: 'rgba(14, 36, 32, 0.42)',
  },
  paySaved: {
    marginTop: 1,
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
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
  payAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  stepHint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: space[2],
  },
  backLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.birrGreen,
    marginBottom: space[2],
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space[4],
  },
  selectText: {
    flex: 1,
  },
  selectTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  selectDesc: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  guideBox: {
    marginTop: space[2],
    padding: space[4],
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  guideTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space[2],
  },
  guideLine: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  dropZone: {
    borderWidth: 1.5,
    borderColor: colors.borderAccent,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    padding: space[5],
    alignItems: 'center',
    gap: space[2],
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  uploadHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  uploaded: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.verified,
  },
  preview: {
    width: '100%',
    height: 180,
    marginVertical: space[2],
    borderRadius: radius.sm,
  },
  pickRow: {
    flexDirection: 'row',
    gap: space[2],
    width: '100%',
    marginTop: space[2],
  },
  rowBtns: {
    flexDirection: 'row',
    gap: space[3],
    marginTop: space[2],
  },
  flexBtn: {
    flex: 1,
  },
  infoBox: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(198, 162, 78, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.35)',
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  infoBody: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
  smsInput: {
    minHeight: 160,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  costHint: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: space[2],
  },
  balanceBox: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(27, 70, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27, 70, 58, 0.22)',
  },
  balanceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.birrGreen,
    marginBottom: 4,
  },
  balanceText: {
    fontSize: 14,
    color: colors.ink,
  },
  prevBox: {
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(198, 162, 78, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.4)',
  },
  prevTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  prevHint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
})
