import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius, space } from '../theme/tokens'

export default function BalanceCard({ balance = 0, loading = false, onTopUp }) {
  const { t } = useLocale()
  const amount = Number(balance || 0).toFixed(2)

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.meta}>{t('balance.title')}</Text>
          {loading ? (
            <ActivityIndicator color={colors.foilGold} style={{ marginTop: space[3], alignSelf: 'flex-start' }} />
          ) : (
            <>
              <Text style={styles.amount}>{amount}</Text>
              <Text style={styles.available}>{t('balance.available')}</Text>
            </>
          )}
        </View>
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={26} color={colors.foilGold} />
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.topUpBtn} onPress={onTopUp}>
          <Ionicons name="trending-up" size={18} color={colors.ink} />
          <Text style={styles.topUpText}>{t('balance.topUp')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  meta: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: space[2],
  },
  amount: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  available: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: 'rgba(198, 162, 78, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space[3],
  },
  actions: {
    marginTop: space[5],
    paddingTop: space[4],
    borderTopWidth: 1,
    borderTopColor: 'rgba(14, 36, 32, 0.08)',
  },
  topUpBtn: {
    backgroundColor: colors.foilGold,
    borderRadius: radius.sm,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  topUpText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 15,
  },
})
