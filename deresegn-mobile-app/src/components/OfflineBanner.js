import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import NetInfo from '@react-native-community/netinfo'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '../i18n/LocaleContext'
import { colors, space } from '../theme/tokens'

export default function OfflineBanner() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const noLink = state.isConnected === false
      const noNet = state.isInternetReachable === false
      setOffline(noLink || noNet)
    })
    return () => unsub()
  }, [])

  if (!offline) return null

  return (
    <View
      style={[styles.wrap, { paddingTop: Math.max(insets.top, 8) }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.title}>{t('offline.title')}</Text>
      <Text style={styles.body}>{t('offline.body')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.maroon,
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    zIndex: 80,
  },
  title: {
    color: colors.parchment,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  body: {
    marginTop: 2,
    color: 'rgba(244, 238, 220, 0.88)',
    fontSize: 12,
    lineHeight: 16,
  },
})
