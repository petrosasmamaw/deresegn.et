import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius, space } from '../theme/tokens'
import { ui } from '../theme/styles'
import VerificationCertificate from './VerificationCertificate'

export default function CheckDetailModal({ check, visible, onClose }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  if (!check) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space[4]) + space[4] }]}>
          <Text style={styles.title}>{t('dash.historyTitle')}</Text>
          <ScrollView style={{ maxHeight: 480 }} showsVerticalScrollIndicator={false}>
            <VerificationCertificate check={check} compact />
          </ScrollView>
          <Pressable style={[ui.btnPrimary, { marginTop: space[4] }]} onPress={onClose}>
            <Text style={ui.btnPrimaryText}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(14, 36, 32, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.parchment,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: space[5],
    maxHeight: '92%',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space[4],
  },
})
