import { Image, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius, space } from '../theme/tokens'

const RECEIPT_IMAGES = {
  telebirr: require('../../assets/receipts/telebirr.jpg'),
  cbe: require('../../assets/receipts/cbe.jpg'),
  boa: require('../../assets/receipts/boa.jpg'),
  dashen: require('../../assets/receipts/dashen.jpg'),
}

const BANK_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'CBE',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
}

const BANK_TINT = {
  telebirr: '#7B2CBF',
  cbe: '#8B1E3F',
  boa: '#C9A227',
  dashen: '#1B4F9C',
}

function FormatTextPanel({ method, mode }) {
  const { t } = useLocale()
  const label = BANK_LABELS[method] || method

  if (mode === 'reference') {
    const hintKey = {
      telebirr: 'guide.telebirrHint',
      cbe: 'guide.cbeHint',
      boa: 'guide.boaHint',
      dashen: 'guide.dashenHint',
    }[method]
    if (!hintKey) return null

    const linesByMethod = {
      telebirr: [
        { label: t('guide.field'), value: 'Invoice No.' },
        { label: t('guide.example'), value: 'DG65L5I9M5' },
        { label: t('guide.format'), value: '10 uppercase letters & digits' },
      ],
      cbe: [
        { label: t('ref.cbeToken'), value: 'FT… or mbreciept / v2-…' },
        { label: t('guide.example'), value: 'FT26226GC3H3' },
        { label: t('ref.cbeAccount'), value: '33687112' },
        { label: t('guide.format'), value: 'FT + last 8 digits · or SMS v2-link (no account)' },
      ],
      boa: [
        { label: t('ref.boaId'), value: 'FT… or TT…' },
        { label: t('guide.example'), value: 'TT26171RW0YG' },
        { label: t('ref.boaAccount'), value: '246302723' },
        { label: t('guide.format'), value: 'FT/TT + chars · full 9-digit account' },
      ],
      dashen: [
        { label: 'IPSS Reference', value: '110IPSS2616900WO' },
        { label: t('guide.format'), value: 'Starts with digits + IPSS' },
      ],
    }

    return (
      <View style={styles.panel} accessibilityLabel={t('guide.paymentIdFormat')}>
        <Text style={styles.label}>{t('guide.paymentIdFormat')}</Text>
        <Text style={styles.hint}>{t(hintKey)}</Text>
        {(linesByMethod[method] || []).map((line) => (
          <View key={`${line.label}-${line.value}`} style={styles.row}>
            <Text style={styles.key}>{line.label}</Text>
            <Text style={styles.value}>{line.value}</Text>
          </View>
        ))}
        <Text style={[styles.badge, { backgroundColor: BANK_TINT[method] || colors.ink }]}>{label}</Text>
      </View>
    )
  }

  if (mode === 'sms') {
    const hintKey = {
      telebirr: 'guide.telebirrSmsHint',
      cbe: 'guide.cbeSmsHint',
      boa: 'guide.boaSmsHint',
      dashen: 'guide.dashenSmsHint',
    }[method]
    if (!hintKey) return null

    const bodyByMethod = {
      telebirr: `Dear customer
You have transferred ETB 60.00 to Receiver Name (2519****4025) on 17/06/2026 18:14:15. Your transaction number is DFH51OFIED. Your current balance is ETB 1,240.00.
https://transactioninfo.ethiotelecom.et/receipt/DFH51OFIED`,
      cbe: `Dear Petiros Asmamaw Abebe You have received ETB 2,000.00 from account 1**0947 (Sender Name) to your account 1**7112. Your current balance is ETB 3,103.06. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-xxxxxxxx`,
      boa: `Dear Petros, your account 2*23 was debited with ETB 200.00. Available Balance: ETB 102.63.
Receipt: https://cs.bankofabyssinia.com/slip/?trx=TT26171RW0YG02723
For help, call 8397 (24/7 Toll-Free). Bank of Abyssinia.`,
      dashen: `Dear Customer, your account 5110****011 has been debited with ETB 100.48 on 2026-06-18 at 10:23:00. A service fee of ETB 0.4, VAT of ETB 0.06 and DRRF fee of ETB 0.02 have been applied. Your current balance is ETB 64.52. Thank you for using Dashen Super App!
For receipt https://receipt.dashensuperapp.com/receipt/110IPSS2616900WO`,
    }
    const body = bodyByMethod[method]
    if (!body) return null

    return (
      <View style={styles.panel} accessibilityLabel={t('guide.smsFormat')}>
        <Text style={styles.label}>{t('guide.smsFormat')}</Text>
        <Text style={styles.hint}>{t(hintKey)}</Text>
        <Text style={styles.pre}>{body}</Text>
        <Text style={[styles.badge, { backgroundColor: BANK_TINT[method] || colors.ink }]}>{label}</Text>
      </View>
    )
  }

  return null
}

export default function VerificationFormatGuide({ method, mode = 'screenshot' }) {
  const { t } = useLocale()

  if (!method) {
    return (
      <View style={[styles.panel, styles.idle]} accessibilityLabel={t('guide.templateIdleTitle')}>
        <Text style={styles.label}>{t('guide.templateIdleTitle')}</Text>
        <Text style={styles.hint}>{t('guide.templateIdleHint')}</Text>
        <Ionicons name="receipt-outline" size={36} color={colors.birrGreen} />
      </View>
    )
  }

  const label = BANK_LABELS[method] || method

  if (mode === 'screenshot' && RECEIPT_IMAGES[method]) {
    return (
      <View style={styles.panel} accessibilityLabel={t('guide.receiptGuide')}>
        <Text style={styles.label}>{t('guide.receiptGuide')}</Text>
        <Text style={styles.hint}>{t(`upload.${method}`)}</Text>
        <Image source={RECEIPT_IMAGES[method]} style={styles.receipt} resizeMode="contain" />
        <Text style={[styles.badge, { backgroundColor: BANK_TINT[method] || colors.ink }]}>{label}</Text>
      </View>
    )
  }

  if (mode === 'reference' || mode === 'sms') {
    return <FormatTextPanel method={method} mode={mode} />
  }

  return null
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.bgElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    gap: 8,
  },
  idle: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.birrGreen,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  receipt: {
    width: '100%',
    height: 220,
    borderRadius: radius.md,
    backgroundColor: colors.bgSubtle,
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  key: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  value: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  pre: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
    borderRadius: 4,
  },
})
