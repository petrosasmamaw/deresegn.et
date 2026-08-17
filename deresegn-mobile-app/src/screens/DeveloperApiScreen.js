import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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
import * as Clipboard from 'expo-clipboard'
import { api } from '../api/http'
import { unwrap } from '../api/unwrap'
import { getApiBaseUrl } from '../api/apiBase'
import { fetchBalance } from '../features/balance/balanceSlice'
import { useDashboardUi } from '../context/DashboardUiContext'
import { useLocale } from '../i18n/LocaleContext'
import { ui } from '../theme/styles'
import { colors, radius, space } from '../theme/tokens'

const PACKAGE_ACCENTS = {
  starter: '#1B463A',
  growth: '#C6A24E',
  pro: '#0E2420',
  business: '#1B463A',
  enterprise: '#0E2420',
}

function maskKey(prefix) {
  const base = prefix || 'dk_live_'
  return `${base}${'•'.repeat(Math.max(8, 28 - base.length))}`
}

export default function DeveloperApiScreen() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const balance = useSelector((s) => s.balance.current)
  const { openTopUp } = useDashboardUi()

  const [pricing, setPricing] = useState(null)
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [selectedPackage, setSelectedPackage] = useState('pro')
  const [freshSecret, setFreshSecret] = useState(null)
  const [copied, setCopied] = useState('')
  const [renewForId, setRenewForId] = useState(null)
  const [revealedKeys, setRevealedKeys] = useState({})
  const [visibleKeyIds, setVisibleKeyIds] = useState({})
  const [revealBusyId, setRevealBusyId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const apiBase = useMemo(() => getApiBaseUrl(), [])
  const verifyUrl = `${apiBase}/v1/verify/reference`
  const packages = pricing?.apiPackages || []

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.get('/developer/keys')
      if (res.status >= 400) {
        throw new Error(res.data?.message || t('dev.loadFailed'))
      }
      const data = unwrap(res)
      setKeys(data.keys || [])
      setPricing(data.pricing || null)
    } catch (err) {
      setError(err.message || t('dev.loadFailed'))
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      let active = true
      ;(async () => {
        setLoading(true)
        dispatch(fetchBalance())
        await load()
        if (active) setLoading(false)
      })()
      return () => {
        active = false
      }
    }, [dispatch, load]),
  )

  const onRefresh = async () => {
    setRefreshing(true)
    dispatch(fetchBalance())
    await load()
    setRefreshing(false)
  }

  const copyText = async (text, id) => {
    try {
      await Clipboard.setStringAsync(text)
      setCopied(id)
      setTimeout(() => setCopied(''), 1800)
    } catch {
      setError(t('dev.copyFailed'))
    }
  }

  const buyOrRenew = async ({ renewKeyId } = {}) => {
    setBusy(true)
    setError(null)
    setFreshSecret(null)
    try {
      const res = renewKeyId
        ? await api.post(`/developer/keys/${renewKeyId}/renew`, {
            packageId: selectedPackage,
          })
        : await api.post('/developer/keys', { packageId: selectedPackage })

      if (res.status >= 400) {
        const msg = res.data?.message || t('dev.purchaseFailed')
        setError(msg)
        return
      }
      const data = unwrap(res)
      if (data.key?.apiKey) {
        setFreshSecret(data.key.apiKey)
        if (data.key.id) {
          setRevealedKeys((prev) => ({ ...prev, [data.key.id]: data.key.apiKey }))
        }
      }
      if (typeof data.newBalance === 'number') dispatch(fetchBalance())
      setRenewForId(null)
      await load()
    } catch (err) {
      setError(err.message || t('dev.purchaseFailed'))
    } finally {
      setBusy(false)
    }
  }

  const revoke = (id) => {
    Alert.alert(
      t('dev.revokeTitle'),
      t('dev.revokeBody'),
      [
        { text: t('common.close'), style: 'cancel' },
        {
          text: t('dev.revoke'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            try {
              const res = await api.post(`/developer/keys/${id}/revoke`)
              if (res.status >= 400) throw new Error(res.data?.message || t('dev.revokeFailed'))
              setRevealedKeys((prev) => {
                const next = { ...prev }
                delete next[id]
                return next
              })
              setVisibleKeyIds((prev) => {
                const next = { ...prev }
                delete next[id]
                return next
              })
              await load()
            } catch (err) {
              setError(err.message || t('dev.revokeFailed'))
            } finally {
              setBusy(false)
            }
          },
        },
      ],
    )
  }

  const toggleRevealKey = async (k) => {
    const id = k.id
    if (visibleKeyIds[id]) {
      setVisibleKeyIds((prev) => ({ ...prev, [id]: false }))
      return
    }
    if (revealedKeys[id]) {
      setVisibleKeyIds((prev) => ({ ...prev, [id]: true }))
      return
    }
    if (freshSecret && k.keyPrefix && freshSecret.startsWith(k.keyPrefix)) {
      setRevealedKeys((prev) => ({ ...prev, [id]: freshSecret }))
      setVisibleKeyIds((prev) => ({ ...prev, [id]: true }))
      return
    }
    if (!k.canReveal) {
      setError(t('dev.cannotRecover'))
      return
    }

    setRevealBusyId(id)
    setError(null)
    try {
      const res = await api.post(`/developer/keys/${id}/reveal`)
      if (res.status >= 400) throw new Error(res.data?.message || t('dev.revealFailed'))
      const data = unwrap(res)
      if (!data?.apiKey) throw new Error(t('dev.noKeyReturned'))
      setRevealedKeys((prev) => ({ ...prev, [id]: data.apiKey }))
      setVisibleKeyIds((prev) => ({ ...prev, [id]: true }))
    } catch (err) {
      setError(err.message || t('dev.revealFailed'))
    } finally {
      setRevealBusyId(null)
    }
  }

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="arrow-back" size={20} color={colors.ink} />
        </Pressable>
        <Text style={styles.navTitle}>{t('dev.title')}</Text>
        <View style={{ width: 40 }} />
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
        <Text style={styles.lead}>{t('dev.lead')}</Text>

        <View style={styles.wallet}>
          <Text style={styles.walletLabel}>{t('dev.wallet')}</Text>
          <Text style={styles.walletAmount}>{Number(balance || 0).toFixed(2)}</Text>
          <Text style={styles.walletMeta}>{t('balance.available')}</Text>
          <Pressable style={[ui.btnSecondary, { marginTop: space[3] }]} onPress={openTopUp}>
            <Text style={ui.btnSecondaryText}>{t('balance.topUp')}</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={ui.errorBox}>
            <Text style={ui.errorText}>{error}</Text>
            {/top up|insufficient|በቂ|ሙላ/i.test(error) ? (
              <Pressable style={[ui.btnPrimary, { marginTop: space[3] }]} onPress={openTopUp}>
                <Text style={ui.btnPrimaryText}>{t('balance.topUp')}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {freshSecret ? (
          <View style={styles.secretBox}>
            <Text style={styles.secretTitle}>{t('dev.newKeyTitle')}</Text>
            <Text style={styles.secretHint}>{t('dev.newKeyHint')}</Text>
            <View style={styles.secretRow}>
              <Text style={styles.secretKey} selectable>
                {freshSecret}
              </Text>
              <Pressable onPress={() => copyText(freshSecret, 'secret')} hitSlop={8}>
                <Ionicons
                  name={copied === 'secret' ? 'checkmark' : 'copy-outline'}
                  size={18}
                  color={colors.parchment}
                />
              </Pressable>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>
          {renewForId ? t('dev.chooseRenew') : t('dev.choosePackage')}
        </Text>
        <Text style={styles.sectionSub}>{t('dev.packageHint')}</Text>

        <View style={styles.pkgGrid}>
          {packages.map((pkg) => {
            const active = selectedPackage === pkg.id
            const accent = PACKAGE_ACCENTS[pkg.id] || colors.foilGold
            return (
              <Pressable
                key={pkg.id}
                onPress={() => setSelectedPackage(pkg.id)}
                style={[
                  styles.pkgCard,
                  active && {
                    borderColor: accent,
                    borderWidth: 2,
                    backgroundColor: 'rgba(198, 162, 78, 0.12)',
                  },
                ]}
              >
                <Text style={[styles.pkgLabel, { color: accent }]}>
                  {t(`pricing.pkg.${pkg.id}`) !== `pricing.pkg.${pkg.id}`
                    ? t(`pricing.pkg.${pkg.id}`)
                    : pkg.label}
                </Text>
                <Text style={styles.pkgPrice}>{pkg.priceBirr}</Text>
                <Text style={styles.pkgUnit}>{t('common.birr')}</Text>
                <Text style={[styles.pkgCap, { color: accent }]}>
                  {t('dev.pkgCap', { amount: pkg.capacityBirr })}
                </Text>
                {pkg.note ? <Text style={styles.pkgNote}>{pkg.note}</Text> : null}
              </Pressable>
            )
          })}
        </View>

        <Pressable
          style={[ui.btnPrimary, (busy || !packages.length) && ui.btnDisabled]}
          disabled={busy || !packages.length}
          onPress={() => buyOrRenew({ renewKeyId: renewForId || undefined })}
        >
          {busy ? (
            <ActivityIndicator color={colors.ink} />
          ) : (
            <Text style={ui.btnPrimaryText}>
              {renewForId ? t('dev.renewWithPackage') : t('dev.buy')}
            </Text>
          )}
        </Pressable>
        {renewForId ? (
          <Pressable
            style={[ui.btnSecondary, { marginTop: space[2] }]}
            onPress={() => setRenewForId(null)}
          >
            <Text style={ui.btnSecondaryText}>{t('dev.cancelRenew')}</Text>
          </Pressable>
        ) : null}

        <View style={styles.connectBox}>
          <Text style={styles.sectionTitle}>{t('dev.connect')}</Text>
          <Text style={styles.sectionSub}>{t('dev.connectHint')}</Text>
          <View style={styles.urlRow}>
            <Text style={styles.url} selectable>
              {verifyUrl}
            </Text>
            <Pressable onPress={() => copyText(verifyUrl, 'url')} hitSlop={8}>
              <Ionicons
                name={copied === 'url' ? 'checkmark' : 'copy-outline'}
                size={18}
                color={colors.ink}
              />
            </Pressable>
          </View>
          <Text style={styles.curlHint}>{t('dev.headerHint')}</Text>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: space[6] }]}>{t('dev.yourKeys')}</Text>
        {loading ? (
          <ActivityIndicator color={colors.foilGold} style={{ marginTop: space[4] }} />
        ) : keys.length === 0 ? (
          <Text style={styles.empty}>{t('dev.empty')}</Text>
        ) : (
          keys.map((k) => {
            const used = Number(k.usedAmount || 0)
            const cap = Number(k.capacityAmount || 0)
            const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0
            const shown = visibleKeyIds[k.id]
              ? revealedKeys[k.id] || maskKey(k.keyPrefix)
              : maskKey(k.keyPrefix)
            const statusColor =
              k.status === 'active'
                ? colors.verified
                : k.status === 'revoked'
                  ? colors.maroon
                  : colors.textSecondary

            return (
              <View key={k.id} style={styles.keyCard}>
                <View style={styles.keyTop}>
                  <Text style={styles.keyName}>{k.name || t('dev.keyFallback')}</Text>
                  <Text style={[styles.keyStatus, { color: statusColor }]}>
                    {String(k.status || 'active').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.secretRowLight}>
                  <Text style={styles.keyMono} numberOfLines={2} selectable={!!visibleKeyIds[k.id]}>
                    {shown}
                  </Text>
                  <Pressable
                    onPress={() => toggleRevealKey(k)}
                    disabled={revealBusyId === k.id || k.status === 'revoked'}
                    hitSlop={8}
                  >
                    {revealBusyId === k.id ? (
                      <ActivityIndicator size="small" color={colors.ink} />
                    ) : (
                      <Ionicons
                        name={visibleKeyIds[k.id] ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.ink}
                      />
                    )}
                  </Pressable>
                  {visibleKeyIds[k.id] && revealedKeys[k.id] ? (
                    <Pressable onPress={() => copyText(revealedKeys[k.id], k.id)} hitSlop={8}>
                      <Ionicons
                        name={copied === k.id ? 'checkmark' : 'copy-outline'}
                        size={18}
                        color={colors.ink}
                      />
                    </Pressable>
                  ) : null}
                </View>

                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.meterMeta}>
                  {t('dev.capacityMeta', {
                    used: used.toFixed(0),
                    cap: cap.toFixed(0),
                    remaining: Number(k.remainingAmount ?? cap - used).toFixed(0),
                  })}
                </Text>

                {k.status === 'active' ? (
                  <View style={styles.keyActions}>
                    <Pressable
                      style={[ui.btnSecondary, styles.keyActionBtn]}
                      onPress={() => setRenewForId(k.id)}
                      disabled={busy}
                    >
                      <Text style={ui.btnSecondaryText}>{t('dev.renew')}</Text>
                    </Pressable>
                    <Pressable
                      style={[ui.btnSecondary, styles.keyActionBtn]}
                      onPress={() => revoke(k.id)}
                      disabled={busy}
                    >
                      <Text style={[ui.btnSecondaryText, { color: colors.maroon }]}>
                        {t('dev.revoke')}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  scroll: {
    padding: space[5],
    paddingBottom: space[12],
  },
  lead: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    marginBottom: space[5],
  },
  wallet: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    marginBottom: space[5],
  },
  walletLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  walletAmount: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  walletMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  secretBox: {
    borderWidth: 2,
    borderColor: colors.foilGold,
    backgroundColor: 'rgba(198, 162, 78, 0.1)',
    borderRadius: radius.md,
    padding: space[4],
    marginBottom: space[5],
  },
  secretTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  secretHint: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: space[3],
  },
  secretRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: radius.sm,
    padding: space[3],
  },
  secretKey: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.parchment,
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
    marginBottom: space[3],
    lineHeight: 18,
  },
  pkgGrid: {
    gap: space[3],
    marginBottom: space[4],
  },
  pkgCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  pkgLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pkgPrice: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  pkgUnit: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  pkgCap: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  pkgNote: {
    marginTop: 6,
    fontSize: 11,
    color: colors.textTertiary,
    lineHeight: 15,
  },
  connectBox: {
    marginTop: space[6],
    padding: space[4],
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    padding: space[3],
    borderWidth: 1,
    borderColor: colors.border,
  },
  url: {
    flex: 1,
    fontSize: 12,
    color: colors.ink,
    fontFamily: 'monospace',
  },
  curlHint: {
    marginTop: space[2],
    fontSize: 12,
    color: colors.textSecondary,
  },
  empty: {
    marginTop: space[3],
    fontSize: 14,
    color: colors.textSecondary,
  },
  keyCard: {
    marginTop: space[3],
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
  },
  keyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[2],
  },
  keyName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  keyStatus: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  secretRowLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: space[3],
  },
  keyMono: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: colors.ink,
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgSubtle,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    backgroundColor: colors.foilGold,
  },
  meterMeta: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
  keyActions: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[3],
  },
  keyActionBtn: {
    flex: 1,
    minHeight: 42,
  },
})
