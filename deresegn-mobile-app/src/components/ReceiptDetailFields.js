import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocale } from '../i18n/LocaleContext'
import { ui } from '../theme/styles'
import { colors, space } from '../theme/tokens'

export default function ReceiptDetailFields({ form, onChange, txPlaceholder }) {
  const { t } = useLocale()

  return (
    <View>
      <Text style={ui.label}>{t('field.senderName')}</Text>
      <TextInput
        style={ui.input}
        value={form.senderName}
        onChangeText={(v) => onChange('senderName', v)}
        placeholder={t('field.senderNamePh')}
        placeholderTextColor={colors.textTertiary}
      />

      <Text style={ui.label}>{t('field.senderAccount')}</Text>
      <TextInput
        style={ui.input}
        value={form.senderAccount}
        onChangeText={(v) => onChange('senderAccount', v)}
        placeholder={t('field.senderAccountPh')}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
      />

      <Text style={ui.label}>{t('field.receiverName')}</Text>
      <TextInput
        style={ui.input}
        value={form.receiverName}
        onChangeText={(v) => onChange('receiverName', v)}
        placeholder={t('field.receiverNamePh')}
        placeholderTextColor={colors.textTertiary}
      />

      <Text style={ui.label}>{t('field.receiverAccount')}</Text>
      <TextInput
        style={ui.input}
        value={form.receiverAccount}
        onChangeText={(v) => onChange('receiverAccount', v)}
        placeholder={t('field.receiverAccountPh')}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
      />

      <Text style={ui.label}>{t('field.amount')}</Text>
      <TextInput
        style={ui.input}
        value={String(form.amount ?? '')}
        onChangeText={(v) => onChange('amount', v)}
        placeholder="0.00"
        placeholderTextColor={colors.textTertiary}
        keyboardType="decimal-pad"
      />

      <Text style={ui.label}>{t('field.paymentId')}</Text>
      <TextInput
        style={[ui.input, styles.mono]}
        value={form.transactionCode}
        onChangeText={(v) => onChange('transactionCode', v)}
        placeholder={txPlaceholder || t('field.txPh')}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  mono: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
})
