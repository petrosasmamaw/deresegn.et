import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { fetchCheckHistory } from '../features/checks/checksSlice'
import { fetchBalance } from '../features/balance/balanceSlice'
import { useDashboardUi } from '../context/DashboardUiContext'
import { useLocale } from '../i18n/LocaleContext'
import CheckDetailModal from '../components/CheckDetailModal'
import { colors, radius, space } from '../theme/tokens'

const BANK_LOGOS = {
  telebirr: require('../../assets/banks/telebirr.jpg'),
  cbe: require('../../assets/banks/cbe.png'),
  boa: require('../../assets/banks/boa.jpg'),
  dashen: require('../../assets/banks/dashen.png'),
}

const BANK_LABELS = {
  telebirr: 'Telebirr',
  cbe: 'Commercial Bank of Ethiopia',
  boa: 'Bank of Abyssinia',
  dashen: 'Dashen Bank',
}

const BANK_SHORT = {
  telebirr: 'Telebirr',
  cbe: 'CBE',
  boa: 'Abyssinia',
  dashen: 'Dashen',
}

export default function HistoryScreen() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const { openTopUp } = useDashboardUi()
  const { current: balance } = useSelector((s) => s.balance)
  const { list: checks = [], loading: checksLoading } = useSelector((s) => s.checks)

  const [selectedCheck, setSelectedCheck] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filters state matching FinancialDashboardPage
  const [search, setSearch] = useState('')
  const [bankFilter, setBankFilter] = useState('all')
  const [timeFilter, setTimeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchBalance())
      dispatch(fetchCheckHistory(100))
    }, [dispatch]),
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        dispatch(fetchBalance()),
        dispatch(fetchCheckHistory(100)),
      ])
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  // Filtered & Sorted Checks matching client
  const filteredChecks = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

    return (checks || [])
      .filter((check) => {
        // Bank filter
        if (bankFilter !== 'all' && check.paymentMethod !== bankFilter) return false

        // Status filter
        const isTampered =
          check.confidenceTier === 'suspicious' ||
          check.status === 'failed' ||
          check.status === 'rejected' ||
          Boolean(check.isTampered)
        if (statusFilter === 'genuine' && isTampered) return false
        if (statusFilter === 'tampered' && !isTampered) return false

        // Time filter
        if (timeFilter !== 'all') {
          const checkTime = new Date(check.createdAt).getTime()
          if (timeFilter === 'today' && checkTime < todayStart) return false
          if (timeFilter === 'week' && checkTime < weekStart) return false
          if (timeFilter === 'month' && checkTime < monthStart) return false
        }

        // Search query
        const q = search.trim().toLowerCase()
        if (q) {
          const matchCode = check.transactionCode?.toLowerCase().includes(q)
          const matchSender = check.senderName?.toLowerCase().includes(q)
          const matchReceiver = check.receiverName?.toLowerCase().includes(q)
          const matchSenderAcc = check.senderAccount?.toLowerCase().includes(q)
          const matchReceiverAcc = check.receiverAccount?.toLowerCase().includes(q)
          const matchAmount = check.amount?.toString().includes(q)
          if (!matchCode && !matchSender && !matchReceiver && !matchSenderAcc && !matchReceiverAcc && !matchAmount) {
            return false
          }
        }

        return true
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt)
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt)
        if (sortBy === 'highest_amount') return (Number(b.amount) || 0) - (Number(a.amount) || 0)
        if (sortBy === 'highest_fee') return (Number(b.balanceDeducted) || 0) - (Number(a.balanceDeducted) || 0)
        return 0
      })
  }, [checks, search, bankFilter, timeFilter, statusFilter, sortBy])

  // Top Financial Metrics computed matching client
  const metrics = useMemo(() => {
    let totalVerifiedVolume = 0
    let totalFeesDeducted = 0
    let genuineCount = 0
    let tamperedCount = 0

    const bankStats = {
      telebirr: { volume: 0, fees: 0, count: 0 },
      cbe: { volume: 0, fees: 0, count: 0 },
      boa: { volume: 0, fees: 0, count: 0 },
      dashen: { volume: 0, fees: 0, count: 0 },
    }

    ;(checks || []).forEach((c) => {
      const amt = Number(c.amount) || 0
      const fee = Number(c.balanceDeducted) || 0
      const isTampered =
        c.confidenceTier === 'suspicious' ||
        c.status === 'failed' ||
        c.status === 'rejected' ||
        Boolean(c.isTampered)

      totalVerifiedVolume += amt
      totalFeesDeducted += fee

      if (isTampered) {
        tamperedCount++
      } else {
        genuineCount++
      }

      const method = c.paymentMethod
      if (bankStats[method]) {
        bankStats[method].volume += amt
        bankStats[method].fees += fee
        bankStats[method].count += 1
      }
    })

    return {
      totalVerifiedVolume,
      totalFeesDeducted,
      totalCount: checks.length,
      genuineCount,
      tamperedCount,
      bankStats,
    }
  }, [checks])

  const hasActiveFilters =
    search || bankFilter !== 'all' || timeFilter !== 'all' || statusFilter !== 'all' || sortBy !== 'newest'

  const resetFilters = () => {
    setSearch('')
    setBankFilter('all')
    setTimeFilter('all')
    setStatusFilter('all')
    setSortBy('newest')
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.foilGold}
            colors={[colors.foilGold]}
          />
        }
      >
        {/* ── Page Header matching FinancialDashboardPage ── */}
        <View style={styles.headerBlock}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>FINANCIAL INTELLIGENCE</Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>Financial Dashboard & Verification Ledger</Text>
          <Text style={styles.headerSub}>
            Real-time audit overview of total verified transaction volumes, decreased Birr service fees, and bank settlement records.
          </Text>

          {/* Quick Action Buttons */}
          <View style={styles.headerActions}>
            <Pressable style={styles.refreshBtn} onPress={handleRefresh}>
              <Ionicons
                name="refresh"
                size={14}
                color="#1B463A"
                style={refreshing ? styles.spin : undefined}
              />
              <Text style={styles.refreshBtnText}>Refresh</Text>
            </Pressable>

            <Pressable style={styles.topUpBtn} onPress={openTopUp}>
              <Ionicons name="wallet-outline" size={15} color="#091A16" />
              <Text style={styles.topUpBtnText}>Top Up Balance</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Top 4 Key Financial Indicator Cards (2x2 Grid) ── */}
        <View style={styles.metricsGrid}>
          {/* 1. Verified Volume */}
          <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabel} numberOfLines={1}>VERIFIED VOLUME</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
              </View>
            </View>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>
                {metrics.totalVerifiedVolume.toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text style={styles.metricUnit}>ETB</Text>
            </View>
            <Text style={styles.metricSub}>Total authenticated funds</Text>
          </View>

          {/* 2. Decreased Fees */}
          <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabel} numberOfLines={1}>DECREASED FEES</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="cash-outline" size={14} color="#B45309" />
              </View>
            </View>
            <View style={styles.metricValueRow}>
              <Text style={[styles.metricValue, { color: '#B45309' }]}>
                −{metrics.totalFeesDeducted.toLocaleString('en-US', {
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <Text style={[styles.metricUnit, { color: '#B45309' }]}>Birr</Text>
            </View>
            <Text style={styles.metricSub}>Audit service charges</Text>
          </View>

          {/* 3. Total Verifications */}
          <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabel} numberOfLines={1}>TOTAL AUDITS</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(27,70,58,0.1)' }]}>
                <Ionicons name="document-text-outline" size={14} color="#1B463A" />
              </View>
            </View>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>{metrics.totalCount}</Text>
              <Text style={styles.metricUnit}>Checks</Text>
            </View>
            <Text style={styles.metricSub}>
              <Text style={{ color: '#059669', fontWeight: '800' }}>{metrics.genuineCount} OK</Text> ·{' '}
              <Text style={{ color: '#DC2626', fontWeight: '800' }}>{metrics.tamperedCount} Flag</Text>
            </Text>
          </View>

          {/* 4. Active Balance */}
          <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
              <Text style={styles.metricLabel} numberOfLines={1}>BALANCE</Text>
              <View style={[styles.metricIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="wallet-outline" size={14} color="#C6A24E" />
              </View>
            </View>
            <View style={styles.metricValueRow}>
              <Text style={styles.metricValue}>{Number(balance || 0).toFixed(2)}</Text>
              <Text style={styles.metricUnit}>ETB</Text>
            </View>
            <View style={styles.balanceSubRow}>
              <Text style={styles.metricSub}>Active</Text>
              <Pressable onPress={openTopUp} hitSlop={6}>
                <Text style={styles.balanceTopUpLink}>+ Top Up</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* ── Bank Gateway Distribution (2x2 Grid) ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>BANK GATEWAY DISTRIBUTION</Text>
          <Text style={styles.sectionSub}>Real-time settlement metrics</Text>
        </View>

        <View style={styles.bankStatsGrid}>
          {Object.keys(BANK_LABELS).map((bankKey) => {
            const stat = metrics.bankStats[bankKey] || { volume: 0, fees: 0, count: 0 }
            const logo = BANK_LOGOS[bankKey]
            const name = BANK_SHORT[bankKey] || BANK_LABELS[bankKey]

            return (
              <View key={bankKey} style={styles.bankStatCard}>
                <View style={styles.bankStatTop}>
                  <View style={styles.bankStatLogoWrap}>
                    <Image source={logo} style={styles.bankStatLogo} resizeMode="contain" />
                  </View>
                  <View style={styles.bankStatCopy}>
                    <Text style={styles.bankStatName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.bankStatCount}>
                      {stat.count} {stat.count === 1 ? 'audit' : 'audits'}
                    </Text>
                  </View>
                </View>

                <View style={styles.bankStatNumbers}>
                  <View style={styles.bankStatCol}>
                    <Text style={styles.bankStatLabel}>Volume</Text>
                    <Text style={styles.bankStatVal} numberOfLines={1}>
                      {stat.volume.toLocaleString('en-US', { maximumFractionDigits: 0 })} ETB
                    </Text>
                  </View>
                  <View style={styles.bankStatCol}>
                    <Text style={styles.bankStatLabel}>Decreased</Text>
                    <Text style={[styles.bankStatVal, { color: '#B45309' }]} numberOfLines={1}>
                      −{stat.fees.toFixed(1)} Birr
                    </Text>
                  </View>
                </View>
              </View>
            )
          })}
        </View>

        {/* ── Verification Audit Ledger & Filters ── */}
        <View style={styles.ledgerContainer}>
          {/* Search Box */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={15} color="#40564C" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search invoice ID, payer, recipient, account..."
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </Pressable>
            ) : null}
          </View>

          {/* Filter Pills: Bank */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {[
              { id: 'all', label: 'All Banks' },
              { id: 'telebirr', label: 'Telebirr' },
              { id: 'cbe', label: 'CBE' },
              { id: 'boa', label: 'Abyssinia' },
              { id: 'dashen', label: 'Dashen' },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setBankFilter(item.id)}
                style={[
                  styles.filterChip,
                  bankFilter === item.id ? styles.filterChipActive : styles.filterChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    bankFilter === item.id ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Filter Pills: Status & Time */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {[
              { id: 'all', label: 'All Statuses' },
              { id: 'genuine', label: 'Verified Genuine' },
              { id: 'tampered', label: 'Tampered' },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setStatusFilter(item.id)}
                style={[
                  styles.filterChip,
                  statusFilter === item.id ? styles.filterChipActive : styles.filterChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === item.id ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}

            <View style={styles.filterDivider} />

            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
            ].map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setTimeFilter(item.id)}
                style={[
                  styles.filterChip,
                  timeFilter === item.id ? styles.filterChipActive : styles.filterChipInactive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    timeFilter === item.id ? styles.filterChipTextActive : styles.filterChipTextInactive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Count and Reset summary */}
          <View style={styles.countSummaryRow}>
            <Text style={styles.countSummaryText}>
              Showing {filteredChecks.length} of {checks.length} verifications
            </Text>
            {hasActiveFilters ? (
              <Pressable onPress={resetFilters} hitSlop={8}>
                <Text style={styles.resetFiltersLink}>Reset all filters</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Ledger Items List */}
          {checksLoading && checks.length === 0 ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.foilGold} />
              <Text style={styles.loadingText}>Loading verification ledger...</Text>
            </View>
          ) : checks.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="time-outline" size={32} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No Verification Records</Text>
              <Text style={styles.emptySub}>
                Your transaction receipts and decreased verification fees will appear here once you begin checking receipts.
              </Text>
            </View>
          ) : filteredChecks.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="filter-outline" size={28} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No matching records</Text>
              <Text style={styles.emptySub}>
                No verification records match your active search and filters.
              </Text>
            </View>
          ) : (
            <View style={styles.cardsList}>
              {filteredChecks.map((check) => {
                const isTampered =
                  check.confidenceTier === 'suspicious' ||
                  check.status === 'failed' ||
                  check.status === 'rejected' ||
                  Boolean(check.isTampered)
                const logo = BANK_LOGOS[check.paymentMethod] || BANK_LOGOS.telebirr

                return (
                  <Pressable
                    key={check.id}
                    onPress={() => setSelectedCheck(check)}
                    style={styles.checkCard}
                  >
                    {/* Top Row: Bank + Code + Status Pill */}
                    <View style={styles.cardTopRow}>
                      <View style={styles.cardBankWrap}>
                        <View style={styles.cardLogoBox}>
                          <Image source={logo} style={styles.cardLogoImg} resizeMode="contain" />
                        </View>
                        <View>
                          <Text style={styles.cardBankName}>
                            {BANK_LABELS[check.paymentMethod] || check.paymentMethod}
                          </Text>
                          <Text style={styles.cardCode} numberOfLines={1}>
                            {check.transactionCode || `#${check.id}`}
                          </Text>
                        </View>
                      </View>

                      {isTampered ? (
                        <View style={styles.statusPillTampered}>
                          <Ionicons name="alert-circle" size={10} color="#991B1B" />
                          <Text style={styles.statusPillTamperedText}>TAMPERED</Text>
                        </View>
                      ) : (
                        <View style={styles.statusPillVerified}>
                          <Ionicons name="checkmark-circle" size={10} color="#065F46" />
                          <Text style={styles.statusPillVerifiedText}>VERIFIED</Text>
                        </View>
                      )}
                    </View>

                    {/* Middle Row: Party */}
                    <View style={styles.cardPartyRow}>
                      <Text style={styles.cardPartyLabel}>Party: </Text>
                      <Text style={styles.cardPartySender} numberOfLines={1}>
                        {check.senderName || 'Sender'}
                      </Text>
                      <Text style={styles.cardPartyArrow}> → </Text>
                      <Text style={styles.cardPartyReceiver} numberOfLines={1}>
                        {check.receiverName || check.receiverAccount || 'Merchant'}
                      </Text>
                    </View>

                    {/* Bottom Row: Amount + Date + Fee Badge */}
                    <View style={styles.cardBottomRow}>
                      <View>
                        <Text style={styles.cardAmount}>
                          {Number(check.amount || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{' '}
                          ETB
                        </Text>
                        <Text style={styles.cardDate}>
                          {new Date(check.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>

                      <View>
                        {check.isRecheck ? (
                          <View style={styles.freeRecheckBadge}>
                            <Text style={styles.freeRecheckText}>Free Recheck</Text>
                          </View>
                        ) : (
                          <View style={styles.feeBadge}>
                            <Text style={styles.feeBadgeText}>
                              −{check.balanceDeducted || 5} Birr
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Detail Inspection Modal */}
      <CheckDetailModal
        check={selectedCheck}
        visible={!!selectedCheck}
        onClose={() => setSelectedCheck(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  scrollContent: {
    paddingHorizontal: space[4],
    paddingBottom: space[12],
  },
  // ── Header Block ──
  headerBlock: {
    paddingTop: space[3],
    paddingBottom: space[4],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,70,58,0.12)',
    marginBottom: space[4],
  },
  badgeRow: {
    marginBottom: 6,
  },
  badge: {
    backgroundColor: 'rgba(27,70,58,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#1B463A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#091A16',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 12,
    fontWeight: '500',
    color: '#40564C',
    lineHeight: 17,
    marginBottom: space[3],
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.18)',
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1B463A',
  },
  topUpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#C6A24E',
  },
  topUpBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#091A16',
  },
  // ── 4 Top Metrics (2x2 Grid) ──
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: space[4],
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.14)',
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 96,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#40564C',
    letterSpacing: 0.5,
    flex: 1,
  },
  metricIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#091A16',
    fontFamily: 'monospace',
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1B463A',
  },
  metricSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#40564C',
    marginTop: 2,
  },
  balanceSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  balanceTopUpLink: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1B463A',
    textDecorationLine: 'underline',
  },
  // ── Bank Distribution ──
  sectionHeader: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#091A16',
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#40564C',
  },
  bankStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: space[4],
  },
  bankStatCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.12)',
    padding: 10,
    gap: 8,
  },
  bankStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankStatLogoWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.1)',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankStatLogo: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  bankStatCopy: {
    flex: 1,
  },
  bankStatName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#091A16',
  },
  bankStatCount: {
    fontSize: 9,
    fontFamily: 'monospace',
    color: '#40564C',
  },
  bankStatNumbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(27,70,58,0.06)',
  },
  bankStatCol: {
    flex: 1,
  },
  bankStatLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#40564C',
  },
  bankStatVal: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: '#091A16',
  },
  // ── Verification Ledger ──
  ledgerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.14)',
    overflow: 'hidden',
    padding: space[3],
    gap: space[2],
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.15)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: {
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#091A16',
    padding: 0,
  },
  filterScroll: {
    gap: 6,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: '#1B463A',
    borderColor: '#1B463A',
  },
  filterChipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(27,70,58,0.16)',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipTextInactive: {
    color: '#091A16',
  },
  filterDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(27,70,58,0.14)',
    alignSelf: 'center',
    marginHorizontal: 4,
  },
  countSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(27,70,58,0.06)',
  },
  countSummaryText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#40564C',
  },
  resetFiltersLink: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1B463A',
    textDecorationLine: 'underline',
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#40564C',
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 6,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#091A16',
  },
  emptySub: {
    fontSize: 11,
    color: '#40564C',
    textAlign: 'center',
    lineHeight: 16,
  },
  cardsList: {
    gap: 10,
    marginTop: 4,
  },
  checkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.12)',
    padding: 12,
    gap: 8,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBankWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  cardLogoBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(27,70,58,0.1)',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLogoImg: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  cardBankName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#091A16',
  },
  cardCode: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#40564C',
  },
  statusPillVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillVerifiedText: {
    color: '#065F46',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  statusPillTampered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillTamperedText: {
    color: '#991B1B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  cardPartyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardPartyLabel: {
    fontSize: 11,
    color: '#40564C',
  },
  cardPartySender: {
    fontSize: 11,
    fontWeight: '700',
    color: '#091A16',
  },
  cardPartyArrow: {
    fontSize: 11,
    color: '#40564C',
  },
  cardPartyReceiver: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#40564C',
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(27,70,58,0.06)',
  },
  cardAmount: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'monospace',
    color: '#091A16',
  },
  cardDate: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#40564C',
    marginTop: 1,
  },
  feeBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  feeBadgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  freeRecheckBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  freeRecheckText: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '700',
  },
})
