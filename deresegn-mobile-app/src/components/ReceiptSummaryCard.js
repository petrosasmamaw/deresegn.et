import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius, space } from '../theme/tokens'

export default function ReceiptSummaryCard({ details = {}, title }) {
  const { t } = useLocale()
  const heading = title ?? t('field.transactionDetails')
  const rows = [
    {
      label: t('field.from'),
      primary: details.senderName,
      secondary: details.senderAccount,
    },
    {
      label: t('field.to'),
      primary: details.receiverName,
      secondary: details.receiverAccount,
    },
    {
      label: t('field.amountShort'),
      primary: details.amount != null && details.amount !== '' ? `${details.amount} ETB` : '—',
    },
    {
      label: t('field.paymentId'),
      primary: details.transactionCode,
    },
  ]

  return (
    <View style={styles.card}>
      <Text style={styles.header}>{heading}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.primary || '—'}</Text>
          {row.secondary ? (
            <Text style={styles.secondary}>{row.secondary}</Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    backgroundColor: colors.bgSubtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: {
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  secondary: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
})
