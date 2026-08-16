import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import { colors, space } from '../theme/tokens'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Mirrors client BottomNav: Home | FAB Verify | History
 */
export default function AppBottomBar({ state, navigation, onFabPress }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const active = state?.routes?.[state.index]?.name

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        <Pressable
          style={styles.tab}
          onPress={() => navigation.navigate('HomeTab')}
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'HomeTab' }}
        >
          <Ionicons
            name={active === 'HomeTab' ? 'home' : 'home-outline'}
            size={22}
            color={active === 'HomeTab' ? colors.foilGold : 'rgba(244,238,220,0.72)'}
          />
          <Text style={[styles.label, active === 'HomeTab' && styles.labelActive]}>
            {t('bottom.home')}
          </Text>
        </Pressable>

        <View style={styles.fabSlot} />

        <Pressable
          style={styles.tab}
          onPress={() => navigation.navigate('HistoryTab')}
          accessibilityRole="button"
          accessibilityState={{ selected: active === 'HistoryTab' }}
        >
          <Ionicons
            name={active === 'HistoryTab' ? 'time' : 'time-outline'}
            size={22}
            color={active === 'HistoryTab' ? colors.foilGold : 'rgba(244,238,220,0.72)'}
          />
          <Text style={[styles.label, active === 'HistoryTab' && styles.labelActive]}>
            {t('bottom.history')}
          </Text>
        </Pressable>
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.fabRail, { bottom: Math.max(insets.bottom, 8) + 8 }]}
      >
        <Pressable
          style={styles.fab}
          onPress={onFabPress}
          accessibilityLabel={t('bottom.verifyAria')}
        >
          <Ionicons name="shield-checkmark" size={22} color={colors.ink} />
          <Text style={styles.fabLabel}>{t('bottom.verify')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.ink,
    borderTopWidth: 1,
    borderTopColor: 'rgba(198, 162, 78, 0.25)',
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 56,
    paddingHorizontal: space[2],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    gap: 3,
    minHeight: 48,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: 'rgba(244, 238, 220, 0.72)',
  },
  labelActive: {
    color: colors.foilGold,
  },
  fabSlot: {
    width: 72,
  },
  fabRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.foilGold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.ink,
    elevation: 6,
    shadowColor: colors.ink,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    gap: 1,
  },
  fabLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: colors.ink,
  },
})
