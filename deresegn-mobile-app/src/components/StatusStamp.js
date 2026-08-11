import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius } from '../theme/tokens'

export default function StatusStamp({ tier }) {
  const { t } = useLocale()
  const key = String(tier || 'verified').toLowerCase()

  let bg = colors.successMuted
  let color = colors.verified
  let label = t('common.verified')

  if (key.includes('suspic') || key.includes('fail') || key.includes('reject')) {
    bg = colors.errorMuted
    color = colors.maroon
    label = t('history.suspicious') || 'Suspicious'
  } else if (key.includes('likely')) {
    bg = 'rgba(198, 162, 78, 0.15)'
    color = '#6b5418'
    label = t('history.likelyValid') || 'Likely valid'
  }

  return (
    <View style={[styles.stamp, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  stamp: {
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
})
