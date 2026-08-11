import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius } from '../theme/tokens'

export default function LangToggle() {
  const { locale, setLocale, t } = useLocale()

  return (
    <View style={styles.track} accessibilityRole="tablist">
      <Pressable
        onPress={() => setLocale('en')}
        style={[styles.btn, locale === 'en' && styles.active]}
        accessibilityLabel={t('lang.switchToEn')}
        accessibilityState={{ selected: locale === 'en' }}
      >
        <Text style={[styles.text, locale === 'en' && styles.activeText]}>{t('lang.en')}</Text>
      </Pressable>
      <Pressable
        onPress={() => setLocale('am')}
        style={[styles.btn, locale === 'am' && styles.active]}
        accessibilityLabel={t('lang.switchToAm')}
        accessibilityState={{ selected: locale === 'am' }}
      >
        <Text style={[styles.text, locale === 'am' && styles.activeText]}>{t('lang.am')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#16302b',
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.55)',
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  active: {
    backgroundColor: colors.foilGold,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: 'rgba(244, 238, 220, 0.78)',
  },
  activeText: {
    color: colors.ink,
  },
})
