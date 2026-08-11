import { useCallback, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { logout } from '../features/auth/authSlice'
import { fetchBalance } from '../features/balance/balanceSlice'
import { fetchCheckHistory } from '../features/checks/checksSlice'
import { useDashboardUi } from '../context/DashboardUiContext'
import { useLocale } from '../i18n/LocaleContext'
import BrandLockup from '../components/BrandLockup'
import LangToggle from '../components/LangToggle'
import BalanceCard from '../components/BalanceCard'
import BankStamp from '../components/BankStamp'
import StatusStamp from '../components/StatusStamp'
import OnboardingModal from '../components/OnboardingModal'
import CheckDetailModal from '../components/CheckDetailModal'
import { ui } from '../theme/styles'
import { colors, radius, space } from '../theme/tokens'

export default function HomeScreen() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const user = useSelector((s) => s.auth.user)
  const { current: balance, loading: balanceLoading } = useSelector((s) => s.balance)
  const { list, lastCheck } = useSelector((s) => s.checks)
  const { openVerify, openTopUp } = useDashboardUi()
  const [refreshing, setRefreshing] = useState(false)
  const [detail, setDetail] = useState(null)

  const latest = lastCheck || list?.[0] || null

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory(20))
    }, [dispatch]),
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([
      dispatch(fetchBalance()),
      dispatch(fetchCheckHistory(20)),
    ])
    setRefreshing(false)
  }

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]}>
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
        <View style={styles.topBar}>
          <BrandLockup compact />
          <View style={styles.topActions}>
            <LangToggle />
            <Pressable
              style={styles.logoutBtn}
              onPress={() => navigation.navigate('DeveloperApi')}
              accessibilityLabel={t('nav.getApi')}
            >
              <Ionicons name="key-outline" size={20} color={colors.ink} />
            </Pressable>
            <Pressable
              style={styles.logoutBtn}
              onPress={() => dispatch(logout())}
              accessibilityLabel={t('nav.logout')}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.greeting}>
          {user?.name ? user.name : user?.email || '—'}
        </Text>
        <Text style={styles.email}>{user?.email}</Text>

        <View style={styles.section}>
          <BalanceCard
            balance={balance}
            loading={balanceLoading && balance === 0}
            onTopUp={openTopUp}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dash.quickVerify')}</Text>
          <Text style={styles.sectionSub}>{t('dash.quickVerifyDesc')}</Text>
          <Pressable style={[ui.btnPrimary, styles.verifyBtn]} onPress={openVerify}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.ink} />
            <Text style={ui.btnPrimaryText}>{t('dash.verifyReceipt')}</Text>
          </Pressable>
          <Pressable
            style={[ui.btnSecondary, styles.apiBtn]}
            onPress={() => navigation.navigate('DeveloperApi')}
          >
            <Ionicons name="key-outline" size={18} color={colors.ink} />
            <Text style={ui.btnSecondaryText}>{t('nav.getApi')}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('dash.lastVerification')}</Text>
          {latest ? (
            <Pressable style={styles.lastCard} onPress={() => setDetail(latest)}>
              <View style={styles.lastTop}>
                <BankStamp method={latest.paymentMethod} />
                <StatusStamp tier={latest.confidenceTier || latest.status} />
              </View>
              <Text style={styles.tx} numberOfLines={1}>
                {latest.transactionCode || '—'}
              </Text>
              <View style={styles.lastMeta}>
                <Text style={styles.metaText}>
                  {latest.createdAt
                    ? new Date(latest.createdAt).toLocaleString()
                    : '—'}
                </Text>
                {latest.amount != null && (
                  <Text style={styles.amount}>{latest.amount} ETB</Text>
                )}
              </View>
            </Pressable>
          ) : (
            <View style={styles.emptyLast}>
              <Text style={styles.metaText}>{t('history.empty')}</Text>
              <Text style={[styles.metaText, { marginTop: 4 }]}>
                {t('history.emptyHint')}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <OnboardingModal onTopUp={openTopUp} onVerify={openVerify} />
      <CheckDetailModal
        check={detail}
        visible={!!detail}
        onClose={() => setDetail(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space[5],
    paddingBottom: space[10],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space[3],
    marginBottom: space[4],
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  email: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: space[5],
  },
  section: {
    marginBottom: space[6],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space[1],
  },
  sectionSub: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: space[3],
  },
  verifyBtn: {
    flexDirection: 'row',
    gap: 8,
  },
  apiBtn: {
    flexDirection: 'row',
    gap: 8,
    marginTop: space[2],
  },
  lastCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  lastTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space[2],
  },
  tx: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  lastMeta: {
    marginTop: space[2],
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  emptyLast: {
    padding: space[4],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
})
