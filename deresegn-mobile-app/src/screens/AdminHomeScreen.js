import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { logout } from '../features/auth/authSlice'
import { api } from '../api/http'
import { unwrap } from '../api/unwrap'
import { friendlyErrorMessage } from '../lib/errors'
import { useLocale } from '../i18n/LocaleContext'
import BankStamp from '../components/BankStamp'
import StatusStamp from '../components/StatusStamp'
import { ui } from '../theme/styles'
import { colors, radius, space } from '../theme/tokens'

export default function AdminHomeScreen() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const user = useSelector((s) => s.auth.user)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [registrationBonus, setRegistrationBonus] = useState(null)
  const [recentChecks, setRecentChecks] = useState([])
  const [recentTopups, setRecentTopups] = useState([])

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.get('/admin/dashboard')
      if (res.status >= 400) {
        throw Object.assign(new Error(res.data?.message || 'Failed to load dashboard'), {
          response: res,
        })
      }
      const data = unwrap(res)
      setStats(data.stats || null)
      setRegistrationBonus(data.registrationBonus || null)
      setRecentChecks(data.recentChecks || [])
      setRecentTopups(data.recentTopups || [])
    } catch (err) {
      setError(friendlyErrorMessage(err, t, 'Failed to load admin dashboard'))
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        setLoading(true)
        await load()
        if (active) setLoading(false)
      })()
      return () => {
        active = false
      }
    }, [load]),
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>{t('admin.eyebrow')}</Text>
          <Text style={styles.title}>{t('admin.title')}</Text>
          <Text style={styles.sub}>{user?.email}</Text>
        </View>
        <Pressable
          style={styles.logoutBtn}
          onPress={() => dispatch(logout())}
          accessibilityLabel={t('nav.logout')}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.foilGold}
            colors={[colors.foilGold]}
          />
        }
      >
        <View style={styles.banner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.birrGreen} />
          <Text style={styles.bannerText}>{t('admin.webWriteNote')}</Text>
        </View>

        {error ? (
          <View style={ui.errorBox}>
            <Text style={ui.errorText}>{error}</Text>
            <Pressable style={[ui.btnPrimary, { marginTop: space[3] }]} onPress={load}>
              <Text style={ui.btnPrimaryText}>{t('common.tryAgain')}</Text>
            </Pressable>
          </View>
        ) : null}

        {loading && !stats ? (
          <ActivityIndicator color={colors.foilGold} style={{ marginTop: space[8] }} />
        ) : stats ? (
          <>
            <View style={styles.statsGrid}>
              <StatCard label={t('admin.users')} value={stats.totalUsers} />
              <StatCard label={t('admin.verifications')} value={stats.totalChecks} />
              <StatCard label={t('admin.topups')} value={stats.totalTopups} />
              <StatCard
                label={t('admin.totalBalance')}
                value={Number(stats.totalBalance || 0).toFixed(0)}
              />
            </View>

            {registrationBonus ? (
              <View style={styles.bonusCard}>
                <Text style={styles.sectionTitle}>{t('admin.regBonus')}</Text>
                <Text style={styles.bonusText}>
                  {registrationBonus.enabled === false
                    ? t('admin.bonusOff')
                    : t('admin.bonusOn', {
                        amount: registrationBonus.amount ?? registrationBonus.bonusAmount ?? 20,
                      })}
                </Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>{t('admin.recentChecks')}</Text>
            {recentChecks.length === 0 ? (
              <Text style={styles.empty}>{t('admin.noChecks')}</Text>
            ) : (
              recentChecks.slice(0, 15).map((c) => (
                <View key={c.id} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <BankStamp method={c.paymentMethod} />
                    <StatusStamp tier={c.confidenceTier || 'verified'} />
                  </View>
                  <Text style={styles.tx} numberOfLines={1}>
                    {c.transactionCode || '—'}
                  </Text>
                  <View style={styles.rowMeta}>
                    <Text style={styles.meta}>
                      {c.amount != null ? `${c.amount} ETB` : '—'}
                    </Text>
                    <Text style={styles.meta}>
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { marginTop: space[5] }]}>
              {t('admin.recentTopups')}
            </Text>
            {recentTopups.length === 0 ? (
              <Text style={styles.empty}>{t('admin.noTopups')}</Text>
            ) : (
              recentTopups.slice(0, 12).map((item) => (
                <View key={item.id} style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.statusPill}>
                      {String(item.status || '—').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.tx} numberOfLines={1}>
                    {item.transactionCode || `#${item.id}`}
                  </Text>
                  <View style={styles.rowMeta}>
                    <Text style={styles.meta}>
                      {item.amount != null ? `${item.amount} ETB` : '—'}
                    </Text>
                    <Text style={styles.meta}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  )
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value ?? '—'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.foilGold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    marginTop: 2,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: space[5],
    paddingBottom: space[12],
  },
  banner: {
    flexDirection: 'row',
    gap: 10,
    padding: space[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(27, 70, 58, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(27, 70, 58, 0.18)',
    marginBottom: space[4],
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[3],
    marginBottom: space[5],
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  bonusCard: {
    marginBottom: space[5],
    padding: space[4],
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bonusText: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space[3],
  },
  empty: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: space[3],
  },
  rowCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    marginBottom: space[3],
  },
  rowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space[2],
  },
  tx: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  rowMeta: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.birrGreen,
    letterSpacing: 0.4,
  },
})
