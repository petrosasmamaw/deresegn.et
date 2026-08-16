import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { api } from '../api/http'
import { unwrap } from '../api/unwrap'
import { colors, radius, space } from '../theme/tokens'

const FALLBACK = {
  verifyFees: [
    { range: 'Under 100 ETB', costBirr: 2 },
    { range: '100 – 999 ETB', costBirr: 5 },
    { range: '1,000 – 4,999 ETB', costBirr: 10 },
    { range: '5,000 – 9,999 ETB', costBirr: 15 },
    { range: '10,000+ ETB', costBirr: 20 },
  ],
  apiPackages: [
    { id: 'starter', label: 'Starter', priceBirr: 100, capacityBirr: 150 },
    { id: 'growth', label: 'Growth', priceBirr: 500, capacityBirr: 850 },
    { id: 'pro', label: 'Pro', priceBirr: 1000, capacityBirr: 2000 },
    { id: 'business', label: 'Business', priceBirr: 2000, capacityBirr: 5000 },
    { id: 'enterprise', label: 'Enterprise', priceBirr: 5000, capacityBirr: 15000 },
  ],
}

export default function PricingTables() {
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
          <Text style={styles.headTitle}>In-app verify fees</Text>
          <Text style={styles.headSub}>Charged from wallet per successful check</Text>
        </View>
        {verifyFees.map((row) => (
          <View key={row.range} style={styles.row}>
            <Text style={styles.cell}>{row.range}</Text>
            <Text style={styles.fee}>{row.costBirr} Birr</Text>
          </View>
        ))}
        <Text style={styles.foot}>Re-checks of the same payment ID within 24 hours are free.</Text>
      </View>

      <View style={styles.card}>
        <View style={[styles.head, styles.headApi]}>
          <Text style={styles.headTitle}>Paid API packages</Text>
          <Text style={styles.headSub}>URL + API key for external software</Text>
        </View>
        {apiPackages.map((pkg) => (
          <View key={pkg.id || pkg.label} style={styles.row}>
            <Text style={styles.cell}>{pkg.label}</Text>
            <Text style={styles.mono}>{pkg.priceBirr} Birr</Text>
            <Text style={styles.cap}>{pkg.capacityBirr} Birr</Text>
          </View>
        ))}
        <Text style={styles.foot}>Capacity = sum of verified payment amounts. When empty, renew after topping up.</Text>
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
