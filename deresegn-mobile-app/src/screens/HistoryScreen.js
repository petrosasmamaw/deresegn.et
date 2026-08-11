import { useCallback, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { fetchCheckHistory } from '../features/checks/checksSlice'
import { useLocale } from '../i18n/LocaleContext'
import BankStamp from '../components/BankStamp'
import StatusStamp from '../components/StatusStamp'
import CheckDetailModal from '../components/CheckDetailModal'
import { friendlyErrorMessage } from '../lib/errors'
import { colors, radius, space } from '../theme/tokens'

const BANKS = [
  { id: 'all', labelKey: 'history.allBanks' },
  { id: 'telebirr', labelKey: 'method.telebirr' },
  { id: 'cbe', labelKey: 'method.cbe' },
  { id: 'dashen', labelKey: 'method.dashen' },
  { id: 'boa', labelKey: 'method.boa' },
]

function shortMethodLabel(method, t) {
  const key = String(method || '').toLowerCase()
  if (key === 'telebirr') return t('method.telebirr')
  if (key === 'cbe') return 'CBE'
  if (key === 'dashen') return t('method.dashen')
  if (key === 'boa') return t('method.boa')
  return method || '—'
}

export default function HistoryScreen() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const { list, loading, error } = useSelector((s) => s.checks)
  const [query, setQuery] = useState('')
  const [bank, setBank] = useState('all')
  const [selected, setSelected] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      dispatch(fetchCheckHistory(50))
    }, [dispatch]),
  )

  const onRefresh = async () => {
    setRefreshing(true)
    await dispatch(fetchCheckHistory(50))
    setRefreshing(false)
  }

  const filtered = (list || []).filter((item) => {
    const method = String(item.paymentMethod || '').toLowerCase()
    if (bank !== 'all' && method !== bank) return false
    const q = query.trim().toLowerCase()
    if (!q) return true
    const hay = [
      item.transactionCode,
      item.senderName,
      item.receiverName,
      item.paymentMethod,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('dash.mobileHistory')}</Text>
        <Text style={styles.sub}>{t('dash.mobileHistorySub')}</Text>
      </View>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={t('history.search')}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.filters}>
        {BANKS.map((b) => {
          const active = bank === b.id
          return (
            <Pressable
              key={b.id}
              onPress={() => setBank(b.id)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                {b.id === 'cbe' ? 'CBE' : t(b.labelKey)}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {loading && !list?.length ? (
        <ActivityIndicator color={colors.foilGold} style={{ marginTop: space[8] }} />
      ) : error && !list?.length ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {typeof error === 'string'
              ? error
              : friendlyErrorMessage(error, t, t('common.networkError'))}
          </Text>
          <Pressable onPress={() => dispatch(fetchCheckHistory(50))}>
            <Text style={styles.retry}>{t('common.tryAgain')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id || item.transactionCode || Math.random())}
          contentContainerStyle={
            filtered.length ? styles.list : styles.emptyList
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.foilGold}
              colors={[colors.foilGold]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {query || bank !== 'all' ? t('history.noMatch') : t('history.empty')}
              </Text>
              <Text style={styles.emptyHint}>
                {query || bank !== 'all' ? null : t('history.emptyHint')}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const date = item.createdAt
              ? new Date(item.createdAt).toLocaleString()
              : '—'
            const cost =
              item.balanceDeducted != null
                ? Number(item.balanceDeducted) === 0
                  ? t('history.free')
                  : `−${item.balanceDeducted}`
                : '—'

            return (
              <Pressable style={styles.row} onPress={() => setSelected(item)}>
                <View style={styles.rowTop}>
                  <BankStamp method={item.paymentMethod} />
                  <StatusStamp tier={item.confidenceTier || item.status} />
                </View>
                <Text style={styles.tx} numberOfLines={1}>
                  {item.transactionCode || '—'}
                </Text>
                <View style={styles.rowMeta}>
                  <Text style={styles.meta}>{date}</Text>
                  <Text style={styles.meta}>{shortMethodLabel(item.paymentMethod, t)}</Text>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.amount}>
                    {item.amount != null ? `${item.amount} ETB` : '—'}
                  </Text>
                  <Text style={styles.cost}>{cost}</Text>
                </View>
              </Pressable>
            )
          }}
        />
      )}

      <CheckDetailModal
        check={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.parchment,
  },
  header: {
    paddingHorizontal: space[5],
    paddingTop: space[4],
    paddingBottom: space[3],
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  sub: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  search: {
    marginHorizontal: space[5],
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: space[4],
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
    marginBottom: space[3],
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: space[5],
    marginBottom: space[3],
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bgElevated,
    maxWidth: '48%',
  },
  chipActive: {
    borderColor: colors.ink,
    backgroundColor: colors.ink,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: colors.parchment,
  },
  list: {
    paddingHorizontal: space[5],
    paddingBottom: space[10],
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: space[5],
  },
  row: {
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
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  rowMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    gap: 8,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  amount: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  cost: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.maroon,
  },
  empty: {
    alignItems: 'center',
    paddingTop: space[12],
    paddingHorizontal: space[4],
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: space[2],
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  retry: {
    marginTop: space[3],
    color: colors.birrGreen,
    fontWeight: '700',
  },
})
