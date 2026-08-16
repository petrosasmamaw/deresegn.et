import { useCallback, useEffect, useRef, useState } from 'react'
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
import CheckerModal from '../components/CheckerModal'
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
  const { current: balance, loading: balanceLoading } = useSelector((s) => s.balance)
  const {
    list,
    lastCheck,
    submitting: checkLoading,
    error: checkError,
    lastResolvedDetails,
  } = useSelector((s) => s.checks)
  const { openVerify, openTopUp, deskTick, verifyHandlers } = useDashboardUi()
  const [refreshing, setRefreshing] = useState(false)
  const [detail, setDetail] = useState(null)
  const scrollRef = useRef(null)
  const deskY = useRef(0)

  const latest = lastCheck || list?.[0] || null

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory(20))
    }, [dispatch]),
  )

  useEffect(() => {
    if (!deskTick) return
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(deskY.current - 12, 0), animated: true })
    }, 80)
    return () => clearTimeout(id)
  }, [deskTick])

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
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
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
            <Pressable
              style={styles.credit}
              onPress={openTopUp}
              accessibilityLabel={t('nav.balanceAria', { balance: Number(balance || 0).toFixed(2) })}
            >
              <Text style={styles.creditAmt}>{Number(balance || 0).toFixed(0)}</Text>
              <Text style={styles.creditUnit}>{t('common.birr')}</Text>
            </Pressable>
            <LangToggle />
            <Pressable
              style={styles.logoutBtn}
              onPress={() => dispatch(logout())}
              accessibilityLabel={t('nav.logout')}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.heroTitle}>{t('hero.title')}</Text>
        <Text style={styles.heroBody}>{t('hero.body')}</Text>
        <Text style={styles.heroCoverage}>{t('hero.coverage')}</Text>

        <View
          onLayout={(e) => {
            deskY.current = e.nativeEvent.layout.y
          }}
        >
          {verifyHandlers ? (
            <CheckerModal
              embedded
              onSubmit={verifyHandlers.onSubmit}
              onReferenceSubmit={verifyHandlers.onReferenceSubmit}
              onSmsSubmit={verifyHandlers.onSmsSubmit}
              loading={checkLoading}
              error={checkError}
              lastResult={lastCheck}
              lastResolvedDetails={lastResolvedDetails}
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <BalanceCard
            balance={balance}
            loading={balanceLoading && balance === 0}
            onTopUp={openTopUp}
            onAccounts={() => navigation.navigate('MyAccounts')}
            onApi={() => navigation.navigate('DeveloperApi')}
          />
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
                  {latest.createdAt ? new Date(latest.createdAt).toLocaleString() : '—'}
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
    paddingHorizontal: space[4],
    paddingBottom: space[12],
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
  credit: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.foilGold,
    backgroundColor: 'rgba(198,162,78,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditAmt: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  creditUnit: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.birrGreen,
    textTransform: 'uppercase',
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
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.birrGreen,
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: 6,
  },
  heroCoverage: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: space[4],
  },
  section: {
    marginTop: space[5],
    marginBottom: space[2],
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space[2],
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
