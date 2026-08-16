import { useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import PricingTables from './PricingTables'
import { colors, radius, space } from '../theme/tokens'
import { ui } from '../theme/styles'

export default function BalanceCard({
  balance = 0,
  loading = false,
  onTopUp,
  onAccounts,
  onApi,
}) {
  const { t } = useLocale()
  const [pricingOpen, setPricingOpen] = useState(false)
  const amount = Number(balance || 0).toFixed(2)

  return (
    <>
      <View style={styles.strip} accessibilityLabel={t('balance.title')}>
        <View style={styles.balance}>
          {loading ? (
            <ActivityIndicator color={colors.foilGold} />
          ) : (
            <Text style={styles.amount}>{amount}</Text>
          )}
          <Text style={styles.meta}>{t('balance.available')}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.topup} onPress={onTopUp}>
            <Ionicons name="trending-up" size={16} color={colors.ink} />
            <Text style={styles.topupText}>{t('balance.topUp')}</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => setPricingOpen(true)}>
            <Text style={styles.linkText}>{t('balance.pricingTitle')}</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={onAccounts}>
            <Ionicons name="wallet-outline" size={16} color={colors.ink} />
            <Text style={styles.linkText}>{t('nav.myAccounts')}</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={onApi}>
            <Ionicons name="key-outline" size={16} color={colors.ink} />
            <Text style={styles.linkText}>{t('nav.getApi')}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={pricingOpen} animationType="slide" onRequestClose={() => setPricingOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('balance.pricingTitle')}</Text>
            <Pressable onPress={() => setPricingOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody}>
            <PricingTables />
            <Pressable
              style={[ui.btnPrimary, { marginTop: space[4] }]}
              onPress={() => {
                setPricingOpen(false)
                onApi?.()
              }}
            >
              <Text style={ui.btnPrimaryText}>{t('nav.getApi')}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: colors.bgElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[4],
    gap: space[3],
  },
  balance: { gap: 2 },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
  meta: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.foilGold,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  topupText: { fontWeight: '800', color: colors.ink, fontSize: 13 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    minHeight: 40,
    backgroundColor: colors.bgSubtle,
  },
  linkText: { fontWeight: '700', color: colors.ink, fontSize: 12 },
  modal: { flex: 1, backgroundColor: colors.parchment },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space[5],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  modalBody: { padding: space[4], paddingBottom: space[12] },
})
