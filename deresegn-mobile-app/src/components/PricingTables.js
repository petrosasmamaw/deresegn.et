import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api } from '../api/http'
import { unwrap } from '../api/unwrap'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius, space } from '../theme/tokens'

const FALLBACK = {
  verifyFees: [
    { rangeKey: 'balance.tierUnder100', costBirr: 2 },
    { rangeKey: 'balance.tier100', costBirr: 5 },
    { rangeKey: 'balance.tier1000', costBirr: 10 },
    { rangeKey: 'balance.tier5000', costBirr: 15 },
    { rangeKey: 'balance.tier10000', costBirr: 20 },
  ],
  apiPackages: [
    { id: 'starter', priceBirr: 100, capacityBirr: 150 },
    { id: 'growth', priceBirr: 500, capacityBirr: 850 },
    { id: 'pro', priceBirr: 1000, capacityBirr: 2000 },
    { id: 'business', priceBirr: 2000, capacityBirr: 5000 },
    { id: 'enterprise', priceBirr: 5000, capacityBirr: 15000 },
  ],
}

const FEE_RANGE_BY_COST = {
  2: 'balance.tierUnder100',
  5: 'balance.tier100',
  10: 'balance.tier1000',
  15: 'balance.tier5000',
  20: 'balance.tier10000',
}

function feeRangeLabel(row, t) {
  const key = row.rangeKey || FEE_RANGE_BY_COST[Number(row.costBirr)]
  if (key) return t(key)
  return row.range || ''
}

function packageLabel(pkg, t) {
  const key = `pricing.pkg.${pkg.id}`
  const translated = t(key)
  if (translated && translated !== key) return translated
  return pkg.label || pkg.id
}

export default function PricingTables() {
  const { t } = useLocale()
  const [pricing, setPricing] = useState(FALLBACK)

  useEffect(() => {
    api.get('/developer/pricing')
      .then((res) => {
        if (res.status >= 400) return
        setPricing(unwrap(res) || FALLBACK)
      })
      .catch(() => setPricing(FALLBACK))
  }, [])

  const verifyFees = pricing?.verifyFees || FALLBACK.verifyFees
  const apiPackages = pricing?.apiPackages || FALLBACK.apiPackages

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.headTitle}>{t('pricing.verifyTitle')}</Text>
          <Text style={styles.headSub}>{t('pricing.verifySub')}</Text>
        </View>
        {verifyFees.map((row) => (
          <View key={row.range || row.costBirr} style={styles.row}>
            <Text style={styles.cell}>{feeRangeLabel(row, t)}</Text>
            <Text style={styles.fee}>{t('pricing.feeBirr', { cost: row.costBirr })}</Text>
          </View>
        ))}
        <Text style={styles.foot}>{t('pricing.verifyFoot')}</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.head, styles.headApi]}>
          <Text style={styles.headTitle}>{t('pricing.apiTitle')}</Text>
          <Text style={styles.headSub}>{t('pricing.apiSub')}</Text>
        </View>
        {apiPackages.map((pkg) => (
          <View key={pkg.id || pkg.label} style={styles.row}>
            <Text style={styles.cell}>{packageLabel(pkg, t)}</Text>
            <Text style={styles.mono}>{t('pricing.feeBirr', { cost: pkg.priceBirr })}</Text>
            <Text style={styles.cap}>{t('pricing.feeBirr', { cost: pkg.capacityBirr })}</Text>
          </View>
        ))}
        <Text style={styles.foot}>{t('pricing.apiFoot')}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  card: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  head: {
    backgroundColor: colors.ink,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  headApi: {
    backgroundColor: '#1B463A',
  },
  headTitle: {
    color: colors.foilGold,
    fontWeight: '800',
    fontSize: 14,
  },
  headSub: {
    marginTop: 2,
    color: 'rgba(244,238,220,0.65)',
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space[4],
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cell: { flex: 1, fontSize: 13, color: colors.ink },
  fee: { fontSize: 13, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  mono: { fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] },
  cap: { fontSize: 12, fontWeight: '700', color: colors.birrGreen, fontVariant: ['tabular-nums'] },
  foot: {
    paddingHorizontal: space[4],
    paddingVertical: 8,
    fontSize: 11,
    color: colors.textTertiary,
  },
})
