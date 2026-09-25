import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import { colors, space } from '../theme/tokens'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/** 5-hub premium native bar: Accounts | Top up | Verify FAB | History | API */
export default function AppBottomBar({ state, navigation, onFabPress, onTopUpPress }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const active = state?.routes?.[state.index]?.name

  const isHome = active === 'HomeTab'
  const isAccounts = active === 'AccountsTab'
  const isHistory = active === 'HistoryTab'
  const isApi = active === 'DeveloperApiTab'

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row}>
        {/* 1. Accounts */}
        <Pressable
          style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          onPress={() => navigation.navigate('AccountsTab')}
          accessibilityRole="button"
          accessibilityState={{ selected: isAccounts }}
          accessibilityLabel={t('nav.myAccounts') || 'Accounts'}
        >
          <Ionicons
            name={isAccounts ? 'wallet' : 'wallet-outline'}
            size={22}
            color={isAccounts ? colors.foilGold : 'rgba(244, 238, 220, 0.65)'}
          />
          <Text style={[styles.label, isAccounts && styles.labelActive]}>
            {t('nav.myAccounts') || 'Accounts'}
          </Text>
        </Pressable>

        {/* 2. Top Up */}
        <Pressable
          style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          onPress={onTopUpPress}
          accessibilityRole="button"
          accessibilityLabel={t('bottom.topupAria') || 'Top Up'}
        >
          <Ionicons
            name="add-circle-outline"
            size={22}
            color="rgba(244, 238, 220, 0.75)"
          />
          <Text style={styles.label}>{t('bottom.topup') || 'Top Up'}</Text>
        </Pressable>

        {/* 3. Center FAB spacer */}
        <View style={styles.fabSlot} />

        {/* 4. History */}
        <Pressable
          style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          onPress={() => navigation.navigate('HistoryTab')}
          accessibilityRole="button"
          accessibilityState={{ selected: isHistory }}
          accessibilityLabel={t('bottom.history') || 'History'}
        >
          <Ionicons
            name={isHistory ? 'time' : 'time-outline'}
            size={22}
            color={isHistory ? colors.foilGold : 'rgba(244, 238, 220, 0.65)'}
          />
          <Text style={[styles.label, isHistory && styles.labelActive]}>
            {t('bottom.history') || 'History'}
          </Text>
        </Pressable>

        {/* 5. API */}
        <Pressable
          style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          onPress={() => navigation.navigate('DeveloperApiTab')}
          accessibilityRole="button"
          accessibilityState={{ selected: isApi }}
          accessibilityLabel={t('nav.getApi') || 'API'}
        >
          <Ionicons
            name={isApi ? 'key' : 'key-outline'}
            size={22}
            color={isApi ? colors.foilGold : 'rgba(244, 238, 220, 0.65)'}
          />
          <Text style={[styles.label, isApi && styles.labelActive]}>
            {t('nav.getApi') || 'API'}
          </Text>
        </Pressable>
      </View>

      {/* Elevated Center FAB: Verify */}
      <View
        pointerEvents="box-none"
        style={[styles.fabRail, { bottom: Math.max(insets.bottom, 8) + 8 }]}
      >
        <Pressable
          style={({ pressed }) => [styles.fab, isHome && styles.fabHome, pressed && styles.fabPressed]}
          onPress={() => {
            if (!isHome) navigation.navigate('HomeTab')
            onFabPress?.()
          }}
          accessibilityRole="button"
          accessibilityLabel={t('bottom.verifyAria') || 'Verify Receipt'}
        >
          <Ionicons name="shield-checkmark" size={24} color="#091A16" />
          <Text style={styles.fabLabel}>{t('bottom.verify') || 'Verify'}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#0E2420',
    borderTopWidth: 1,
    borderTopColor: 'rgba(198, 162, 78, 0.28)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 56,
    paddingHorizontal: space[1],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 6,
    gap: 2,
    minHeight: 48,
  },
  tabPressed: {
    opacity: 0.65,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: 'rgba(244, 238, 220, 0.65)',
    textAlign: 'center',
  },
  labelActive: {
    color: colors.foilGold,
    fontWeight: '800',
  },
  fabSlot: {
    width: 68,
  },
  fabRail: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.foilGold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3.5,
    borderColor: '#0E2420',
    elevation: 10,
    shadowColor: colors.foilGold,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    gap: 1,
  },
  fabHome: {
    borderColor: '#0E2420',
    shadowOpacity: 0.6,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  fabLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#091A16',
  },
})
