import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius } from '../theme/tokens'

const BANK_STYLES = {
  telebirr: { bg: 'rgba(14, 36, 32, 0.08)', color: colors.ink, border: 'rgba(14, 36, 32, 0.18)' },
  cbe: { bg: 'rgba(27, 70, 58, 0.1)', color: colors.birrGreen, border: 'rgba(27, 70, 58, 0.22)' },
  dashen: { bg: 'rgba(198, 162, 78, 0.14)', color: '#6b5418', border: 'rgba(198, 162, 78, 0.35)' },
  boa: { bg: 'rgba(124, 42, 51, 0.08)', color: colors.maroon, border: 'rgba(124, 42, 51, 0.22)' },
}

export default function BankStamp({ method }) {
  const { t } = useLocale()
  const key = String(method || '').toLowerCase()
  const style = BANK_STYLES[key] || BANK_STYLES.cbe
  const labels = {
    telebirr: t('method.telebirr') || 'Telebirr',
    cbe: 'CBE',
    boa: t('method.boa') || 'BOA',
    dashen: t('method.dashen') || 'Dashen',
  }

  return (
    <View style={[styles.stamp, { backgroundColor: style.bg, borderColor: style.border }]}>
      <Text style={[styles.text, { color: style.color }]}>
        {labels[key] || method || '—'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stamp: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
})
