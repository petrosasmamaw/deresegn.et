import { useEffect, useMemo, useState } from 'react'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../api/http'
import { unwrap } from '../api/unwrap'
import { useLocale } from '../i18n/LocaleContext'
import ReceiptSummaryCard from './ReceiptSummaryCard'
import { VerificationFailureList } from './VerificationResult'
import { ui } from '../theme/styles'
import { colors, radius, space } from '../theme/tokens'

const SMS_PLACEHOLDERS = {
  telebirr: `Dear customer
You have transferred ETB 60.00 ...
https://transactioninfo.ethiotelecom.et/receipt/XXXX`,
  cbe: `Dear ... You have received ETB 2,000.00 ... Thanks for Banking with CBE.
https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
}

const EMPTY_REFERENCE = {
  transactionCode: '',
  accountSuffix: '',
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

export default function TopUpModal({
  visible,
  onClose,
  onSubmit,
  onReferenceSubmit,
  onSmsSubmit,
  loading,
  error,
}) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState('telebirr')
  const [verifyMode, setVerifyMode] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [preview, setPreview] = useState(null)
  const [rejected, setRejected] = useState(false)
  const [failureIssues, setFailureIssues] = useState([])
  const [successDetails, setSuccessDetails] = useState(null)
  const [receiverAccounts, setReceiverAccounts] = useState([])
  const [referenceForm, setReferenceForm] = useState(EMPTY_REFERENCE)
  const [smsText, setSmsText] = useState('')

  const methods = useMemo(
    () => [
      {
        id: 'telebirr',
        label: t('method.telebirr'),
        icon: 'phone-portrait-outline',
        desc: t('method.telebirrTopupDesc'),
      },
      {
        id: 'cbe',
        label: t('method.cbe'),
        icon: 'business-outline',
        desc: t('method.cbeTopupDesc'),
      },
    ],
    [t],
  )

  const referenceDetailByMethod = useMemo(
    () => ({
      telebirr: t('ref.telebirrDetail'),
      cbe: t('ref.cbeDetail'),
    }),
    [t],
  )

  const referenceFieldsByMethod = useMemo(
    () => ({
      telebirr: [
        {
          key: 'transactionCode',
          label: t('ref.invoice'),
          placeholder: 'DG65L5I9M5',
          hint: t('ref.invoiceHint'),
        },
      ],
      cbe: [
        {
          key: 'transactionCode',
          label: t('ref.ft'),
          placeholder: 'FT26169D8C5M',
          hint: t('ref.ftHint'),
        },
        {
          key: 'accountSuffix',
          label: t('ref.cbeSuffix'),
          placeholder: '12345678',
          hint: t('ref.cbeSuffixHintShort'),
        },
      ],
    }),
    [t],
  )

  useEffect(() => {
    if (!visible) return
    let mounted = true
    ;(async () => {
      try {
        const res = await api.get('/balance/topup-accounts')
        if (res.status >= 400) throw new Error('load failed')
        const data = unwrap(res)
        if (mounted) setReceiverAccounts(data.accounts || [])
      } catch {
        if (mounted) setReceiverAccounts([])
      }
    })()
    return () => {
      mounted = false
    }
  }, [visible])

  const selectedAccount = receiverAccounts.find((a) => a.method === method)
  const referenceFields = referenceFieldsByMethod[method] || []
  const referenceReady = referenceFields.every((f) =>
    String(referenceForm[f.key] || '').trim(),
  )
  const successStep = 4

  const reset = () => {
    setStep(1)
    setMethod('telebirr')
    setVerifyMode('')
    setScreenshot(null)
    setPreview(null)
    setRejected(false)
    setFailureIssues([])
    setSuccessDetails(null)
    setReferenceForm(EMPTY_REFERENCE)
    setSmsText('')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFailure = (result) => {
    setFailureIssues(result.issues || [])
    setRejected(true)
  }

  const pickImage = async (fromCamera) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync()
        if (!perm.granted) {
          Alert.alert(t('topup.title'), 'Camera permission is required')
          return
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!perm.granted) {
          Alert.alert(t('topup.title'), 'Photo library permission is required')
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
      Alert.alert(t('topup.title'), err?.message || 'Could not open image picker')
    }
  }

  const runTopUpScreenshot = async () => {
    if (!screenshot) {
      setFailureIssues([
        {
          code: 'SCREENSHOT_REQUIRED',
          field: 'screenshot',
          message: t('topup.screenshotRequired'),
        },
      ])
      setRejected(true)
      return
    }
    setRejected(false)
    setFailureIssues([])
    const result = await onSubmit({ screenshot, method })
    if (result?.failed) return handleFailure(result)
    if (result?.success) {
      setSuccessDetails(result.resolvedDetails)
      setStep(successStep)
    }
  }

  const runTopUpReference = async () => {
    setRejected(false)
    setFailureIssues([])
    const result = await onReferenceSubmit({
      method,
      transactionCode: referenceForm.transactionCode,
      accountSuffix: referenceForm.accountSuffix,
    })
    if (result?.failed) return handleFailure(result)
    if (result?.success) {
      setSuccessDetails(result.resolvedDetails)
      setStep(successStep)
    }
  }

  const runTopUpSms = async () => {
    setRejected(false)
    setFailureIssues([])
    const result = await onSmsSubmit({ method, smsText })
    if (result?.failed) return handleFailure(result)
    if (result?.success) {
      setSuccessDetails(result.resolvedDetails)
      setStep(successStep)
    }
  }

  const successSubtext =
    verifyMode === 'sms'
      ? t('topup.subSms')
      : verifyMode === 'reference'
        ? t('topup.subReference')
        : method === 'telebirr'
          ? t('topup.subTelebirr')
          : t('topup.subQr')

  const methodLabel = methods.find((m) => m.id === method)?.label || method

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.sheet}>
        <View style={[styles.header, { paddingTop: Math.max(insets.top, space[4]) }]}>
          <Text style={styles.headerTitle}>{t('topup.title')}</Text>
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
              <VerificationFailureList issues={failureIssues} title={t('topup.failed')} />
              <View style={styles.rowBtns}>
                <Pressable
                  style={[ui.btnSecondary, styles.flexBtn]}
                  onPress={() => {
                    setRejected(false)
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
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={28} color={colors.verified} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>{t('topup.verified')}</Text>
                  <Text style={styles.successSub}>{successSubtext}</Text>
                </View>
              </View>
              {successDetails ? (
                <ReceiptSummaryCard
                  details={successDetails}
                  title={t('topup.paymentSummary')}
                />
              ) : null}
              <Pressable style={ui.btnPrimary} onPress={handleClose}>
                <Text style={ui.btnPrimaryText}>{t('topup.done')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {error && !rejected ? (
                <View style={ui.errorBox}>
                  <Text style={ui.errorText}>
                    {typeof error === 'string'
                      ? error
                      : error.message || t('topup.failed')}
                  </Text>
                </View>
              ) : null}

              {step === 1 && (
                <>
                  <Text style={styles.stepTitle}>{t('topup.stepMethod')}</Text>
                  <Text style={styles.stepHint}>{t('topup.stepMethodHint')}</Text>
                  {methods.map((m) => (
                    <SelectCard
                      key={m.id}
                      icon={m.icon}
                      title={m.label}
                      desc={m.desc}
                      onPress={() => {
                        setMethod(m.id)
                        setStep(2)
                      }}
                    />
                  ))}
                </>
              )}

              {step === 2 && (
                <>
                  <Pressable onPress={() => setStep(1)}>
                    <Text style={styles.backLink}>← {t('common.back')}</Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{t('topup.stepMode')}</Text>
                  <Text style={styles.stepHint}>{t('topup.stepModeHint')}</Text>

                  {selectedAccount ? (
                    <View style={styles.sendBox}>
                      <Text style={styles.sendLabel}>{t('topup.sendTo')}</Text>
                      <Text style={styles.sendName}>{selectedAccount.receiverName}</Text>
                      <Text style={styles.sendAccount}>
                        {selectedAccount.receiverAccount}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.sendBox}>
                      <Text style={styles.stepHint}>
                        Loading receiver account…
                      </Text>
                    </View>
                  )}

                  <SelectCard
                    icon="camera-outline"
                    title={t('check.modeScreenshot')}
                    desc={
                      method === 'telebirr'
                        ? t('topup.modeScreenshotDescTelebirr')
                        : t('topup.modeScreenshotDesc')
                    }
                    onPress={() => {
                      setVerifyMode('screenshot')
                      setStep(3)
                    }}
                  />
                  <SelectCard
                    icon="keypad-outline"
                    title={t('check.modeReference')}
                    desc={t('topup.modeReferenceDesc')}
                    tint={colors.foilGold}
                    onPress={() => {
                      setVerifyMode('reference')
                      setStep(3)
                    }}
                  />
                  <SelectCard
                    icon="chatbubble-ellipses-outline"
                    title={t('check.modeSms')}
                    desc={t('topup.modeSmsDesc')}
                    tint={colors.birrGreen}
                    onPress={() => {
                      setVerifyMode('sms')
                      setStep(3)
                    }}
                  />
                </>
              )}

              {step === 3 && verifyMode === 'screenshot' && (
                <>
                  <Pressable onPress={() => setStep(2)}>
                    <Text style={styles.backLink}>← {t('common.back')}</Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{t('topup.stepUpload')}</Text>
                  <Text style={styles.stepHint}>
                    {t('topup.stepUploadHint', { method: methodLabel })}
                    {method === 'telebirr' ? t('topup.stepUploadHintTelebirrExtra') : ''}
                  </Text>

                  <View style={styles.dropZone}>
                    {preview ? (
                      <>
                        <Text style={styles.uploaded}>{t('topup.screenshotReady')}</Text>
                        <Image
                          source={{ uri: preview }}
                          style={styles.preview}
                          resizeMode="contain"
                        />
                      </>
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={28} color={colors.birrGreen} />
                        <Text style={styles.uploadTitle}>{t('topup.uploadReceipt')}</Text>
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

                  <Pressable
                    style={[ui.btnPrimary, (!screenshot || loading) && ui.btnDisabled]}
                    disabled={!screenshot || loading}
                    onPress={runTopUpScreenshot}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={ui.btnPrimaryText}>{t('topup.verifyBtn')}</Text>
                    )}
                  </Pressable>
                </>
              )}

              {step === 3 && verifyMode === 'reference' && (
                <>
                  <Pressable onPress={() => setStep(2)}>
                    <Text style={styles.backLink}>← {t('common.back')}</Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{t('topup.stepPaymentId')}</Text>
                  <Text style={styles.stepHint}>
                    {t('topup.stepPaymentIdHint', {
                      detail: referenceDetailByMethod[method],
                    })}
                  </Text>

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

                  <Pressable
                    style={[
                      ui.btnPrimary,
                      (!referenceReady || loading) && ui.btnDisabled,
                    ]}
                    disabled={!referenceReady || loading}
                    onPress={runTopUpReference}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={ui.btnPrimaryText}>{t('topup.verifyBtn')}</Text>
                    )}
                  </Pressable>
                </>
              )}

              {step === 3 && verifyMode === 'sms' && (
                <>
                  <Pressable onPress={() => setStep(2)}>
                    <Text style={styles.backLink}>← {t('common.back')}</Text>
                  </Pressable>
                  <Text style={styles.stepTitle}>{t('topup.stepSms')}</Text>
                  <Text style={styles.stepHint}>{t('topup.stepSmsHint')}</Text>

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

                  <Pressable
                    style={[
                      ui.btnPrimary,
                      (smsText.trim().length < 40 || loading) && ui.btnDisabled,
                    ]}
                    disabled={smsText.trim().length < 40 || loading}
                    onPress={runTopUpSms}
                  >
                    {loading ? (
                      <ActivityIndicator color={colors.ink} />
                    ) : (
                      <Text style={ui.btnPrimaryText}>{t('topup.verifyBtn')}</Text>
                    )}
                  </Pressable>
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
  selectText: { flex: 1 },
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
  sendBox: {
    padding: space[4],
    borderRadius: radius.md,
    backgroundColor: 'rgba(27, 70, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27, 70, 58, 0.22)',
    marginBottom: space[2],
  },
  sendLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.birrGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  sendName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  sendAccount: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
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
  flexBtn: { flex: 1 },
  smsInput: {
    minHeight: 160,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: 'rgba(62, 143, 98, 0.35)',
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.verified,
  },
  successSub: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },
})
