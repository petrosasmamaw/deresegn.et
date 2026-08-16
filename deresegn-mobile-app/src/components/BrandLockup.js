import { Image, Text, View, StyleSheet } from 'react-native'
import { useLocale } from '../i18n/LocaleContext'
import { colors, space } from '../theme/tokens'
import { ui } from '../theme/styles'

const logo = require('../../assets/deresegn-logo.png')

export default function BrandLockup({ dark = true, compact = false }) {
  const { t, locale } = useLocale()
  const brandTitle = locale === 'am' ? t('home.titleAm') : t('auth.brand')
  const brandAlt = locale === 'am' ? 'Tamagn Check' : t('home.titleAm')

  if (compact) {
    return (
      <View style={styles.compactWrap}>
        <Image source={logo} style={styles.compactLogo} resizeMode="contain" accessibilityLabel={t('nav.logoAlt')} />
        <View>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {brandTitle}
          </Text>
          <Text style={styles.compactAlt} numberOfLines={1}>
            {brandAlt}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.wrap}>
      <Image source={logo} style={styles.logo} resizeMode="contain" accessibilityLabel={t('nav.logoAlt')} />
      <Text style={[ui.brandTitle, !dark && styles.inkTitle]}>{brandTitle}</Text>
      <Text style={[ui.brandAlt, !dark && styles.foilAlt]}>{brandAlt}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: space[4],
  },
  inkTitle: {
    color: colors.ink,
  },
  foilAlt: {
    color: colors.foilGold,
  },
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
    maxWidth: '70%',
  },
  compactLogo: {
    width: 40,
    height: 40,
  },
  compactTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  compactAlt: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.foilGold,
    marginTop: 1,
  },
})
