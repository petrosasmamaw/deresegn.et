import { useEffect, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { useLocale } from '../i18n/LocaleContext'
import BrandLockup from '../components/BrandLockup'
import { colors, space } from '../theme/tokens'
import { ui } from '../theme/styles'

const ACTS = [
  { titleKey: 'sessionOpen.act1Title', bodyKey: 'sessionOpen.act1Body' },
  { titleKey: 'sessionOpen.act2Title', bodyKey: 'sessionOpen.act2Body' },
  { titleKey: 'sessionOpen.act3Title', bodyKey: 'sessionOpen.act3Body' },
]

/**
 * Lightweight session splash (web SessionOpenPage simplified for Phase 1).
 */
export default function SplashScreen({ onFinished }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const initializing = useSelector((s) => s.auth.initializing)
  const [actIndex, setActIndex] = useState(0)
  const [minHoldDone, setMinHoldDone] = useState(false)

  useEffect(() => {
    const hold = setTimeout(() => setMinHoldDone(true), 900)
    const acts = setInterval(() => {
      setActIndex((i) => (i + 1) % ACTS.length)
    }, 1400)
    return () => {
      clearTimeout(hold)
      clearInterval(acts)
    }
  }, [])

  useEffect(() => {
    if (!initializing && minHoldDone) {
      const tmr = setTimeout(() => onFinished?.(), 280)
      return () => clearTimeout(tmr)
    }
    return undefined
  }, [initializing, minHoldDone, onFinished])

  const act = ACTS[actIndex]

  return (
    <View
      style={[
        ui.screen,
        styles.center,
        { paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[6] },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={t('sessionOpen.checking')}
    >
      <BrandLockup dark={false} />
      <View style={styles.act} key={act.titleKey}>
        <Text style={styles.actTitle}>{t(act.titleKey)}</Text>
        <Text style={styles.actBody}>{t(act.bodyKey)}</Text>
      </View>
      <ActivityIndicator color={colors.foilGold} style={{ marginTop: space[8] }} />
      <Text style={styles.hint}>{t('sessionOpen.checking')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[6],
  },
  act: {
    marginTop: space[8],
    minHeight: 96,
    alignItems: 'center',
  },
  actTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.birrGreen,
    textAlign: 'center',
    marginBottom: space[2],
  },
  actBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  hint: {
    marginTop: space[3],
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
})
