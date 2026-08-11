import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius, space } from '../theme/tokens'
import { ui } from '../theme/styles'

const KEY = 'deresegn_onboarding_seen'

export default function OnboardingModal({ onTopUp, onVerify }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const seen = await AsyncStorage.getItem(KEY)
        if (mounted && !seen) setOpen(true)
      } catch {
        // ignore
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const close = async () => {
    setOpen(false)
    try {
      await AsyncStorage.setItem(KEY, '1')
    } catch {
      // ignore
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('onboard.title')}</Text>
          <Text style={styles.sub}>{t('onboard.subtitle')}</Text>

          <View style={styles.bonus}>
            <Ionicons name="gift-outline" size={18} color={colors.foilGold} />
            <Text style={styles.bonusText}>{t('onboard.bonus', { amount: 20 })}</Text>
          </View>

          <View style={styles.step}>
            <Text style={styles.num}>1</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{t('onboard.step1Title')}</Text>
              <Text style={styles.stepDesc}>{t('onboard.step1Desc')}</Text>
              <Pressable
                style={[ui.btnSecondary, styles.miniBtn]}
                onPress={() => {
                  close()
                  onTopUp?.()
                }}
              >
                <Text style={ui.btnSecondaryText}>{t('onboard.step1Btn')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.num}>2</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{t('onboard.step2Title')}</Text>
              <Text style={styles.stepDesc}>{t('onboard.step2Desc')}</Text>
              <Pressable
                style={[ui.btnPrimary, styles.miniBtn]}
                onPress={() => {
                  close()
                  onVerify?.()
                }}
              >
                <Text style={ui.btnPrimaryText}>{t('onboard.step2Btn')}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.step}>
            <Text style={styles.num}>3</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{t('onboard.step3Title')}</Text>
              <Text style={styles.stepDesc}>{t('onboard.step3Desc')}</Text>
            </View>
          </View>

          <Pressable style={[ui.btnPrimary, { marginTop: space[4] }]} onPress={close}>
            <Text style={ui.btnPrimaryText}>{t('onboard.gotIt')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 36, 32, 0.5)',
    justifyContent: 'center',
    padding: space[5],
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: space[5],
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  sub: {
    marginTop: space[2],
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bonus: {
    marginTop: space[4],
    marginBottom: space[4],
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: space[3],
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.4)',
    backgroundColor: 'rgba(198, 162, 78, 0.1)',
  },
  bonusText: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
  },
  step: {
    flexDirection: 'row',
    gap: space[3],
    marginBottom: space[4],
  },
  num: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.ink,
    color: colors.parchment,
    textAlign: 'center',
    lineHeight: 28,
    fontWeight: '700',
    overflow: 'hidden',
  },
  stepTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.ink,
  },
  stepDesc: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  miniBtn: {
    marginTop: space[2],
    minHeight: 40,
    alignSelf: 'flex-start',
    paddingHorizontal: space[4],
  },
})
