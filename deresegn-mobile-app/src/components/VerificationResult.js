import { StyleSheet, Text, View } from 'react-native'
import { useLocale } from '../i18n/LocaleContext'
import { colors, radius, space } from '../theme/tokens'

function issueLabel(t, item) {
  if (item.code) {
    const key = `code.${item.code}`
    const translated = t(key)
    if (translated !== key) return translated
  }
  const fieldMap = {
    senderName: 'field.senderName',
    senderAccount: 'field.senderAccount',
    receiverName: 'field.receiverName',
    receiverAccount: 'field.receiverAccount',
    amount: 'common.amount',
    transactionCode: 'field.paymentId',
    screenshot: 'result.screenshot',
    smsText: 'result.smsMessage',
  }
  if (item.field && fieldMap[item.field]) return t(fieldMap[item.field])
  return item.code?.replace(/_/g, ' ') || t('result.error')
}

function VisualDiff({ item }) {
  const { t } = useLocale()
  const isMyAccount = String(item.code || '').startsWith('MY_ACCOUNT')
  const yourLine = item.yourName
    ? `${item.yourName}${item.yourNumber ? ` · ${item.yourNumber}` : ''}`
    : item.formValue
  const receiverLine = item.receiverName
    ? `${item.receiverName}${item.receiverAccount && item.receiverAccount !== '—' ? ` · ${item.receiverAccount}` : ''}`
    : item.qrValue

  if (isMyAccount && (yourLine || receiverLine)) {
    return (
      <View style={styles.diff}>
        <View style={[styles.diffRow, styles.diffRowMatch]}>
          <Text style={styles.diffLabel}>{t('result.yourNameNumber')}</Text>
          <Text style={styles.diffValue}>{String(yourLine || '—')}</Text>
        </View>
        <View style={[styles.diffRow, styles.diffRowMismatch, styles.diffRowLast]}>
          <Text style={styles.diffLabel}>{t('result.receiverOnPayment')}</Text>
          <Text style={[styles.diffValue, styles.diffMismatch]}>{String(receiverLine || '—')}</Text>
        </View>
      </View>
    )
  }

  const rows = []
  if (item.formValue != null) {
    rows.push({
      label: t('result.youEntered'),
      value: item.formValue,
      mismatch: false,
    })
  }
  if (item.screenshotValue != null) {
    const mismatch = item.formValue != null && item.formValue !== item.screenshotValue
    rows.push({ label: t('result.screenshotShows'), value: item.screenshotValue, mismatch })
  }
  if (item.qrValue != null) {
    const mismatch =
      (item.formValue != null && item.formValue !== item.qrValue) ||
      (item.screenshotValue != null && item.screenshotValue !== item.qrValue)
    rows.push({ label: t('result.officialRecord'), value: item.qrValue, mismatch })
  }
  if (!rows.length) return null

  return (
    <View style={styles.diff}>
      {rows.map((row, idx) => (
        <View
          key={row.label}
          style={[
            styles.diffRow,
            row.mismatch ? styles.diffRowMismatch : styles.diffRowMatch,
            idx === rows.length - 1 && styles.diffRowLast,
          ]}
        >
          <Text style={styles.diffLabel}>{row.label}</Text>
          <Text style={[styles.diffValue, row.mismatch && styles.diffMismatch]}>
            {String(row.value)}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function VerificationFailureList({ issues = [], title, nested = false }) {
  const { t } = useLocale()
  if (!issues.length) return null

  return (
    <View style={[styles.fail, nested && styles.failNested]}>
      {!nested ? <Text style={styles.failTitle}>{title || t('result.couldNotVerify')}</Text> : null}
      {issues.map((item, idx) => (
        <View
          key={`${item.code || 'i'}-${item.field || 'f'}-${idx}`}
          style={[styles.issue, nested && styles.issueNested]}
        >
          <Text style={styles.issueLabel}>{issueLabel(t, item)}</Text>
          {item.message ? <Text style={styles.issueMsg}>{item.message}</Text> : null}
          <VisualDiff item={item} />
        </View>
      ))}
    </View>
  )
}

export function VerificationWarningList({ issues = [] }) {
  const { t } = useLocale()
  const warnings = (issues || []).filter((i) => i.type === 'warning')
  if (!warnings.length) return null

  return (
    <View style={styles.warn}>
      <Text style={styles.warnTitle}>{t('result.notes')}</Text>
      {warnings.map((item, idx) => (
        <Text key={`${item.code || 'w'}-${idx}`} style={styles.warnMsg}>
          {item.message}
        </Text>
      ))}
    </View>
  )
}

export function VerificationSuccessNote({ message }) {
  return (
    <View style={styles.success}>
      <Text style={styles.successText}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fail: {
    backgroundColor: colors.errorMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 42, 51, 0.25)',
    padding: space[4],
  },
  failNested: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    gap: 12,
  },
  failTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.maroon,
    marginBottom: space[3],
  },
  issue: {
    marginBottom: space[3],
  },
  issueNested: {
    marginBottom: 0,
    padding: 12,
    borderRadius: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(124, 42, 51, 0.16)',
  },
  issueLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  issueMsg: {
    marginTop: 0,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 20,
  },
  diff: {
    marginTop: space[2],
    borderWidth: 1,
    borderColor: 'rgba(14, 36, 32, 0.1)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  diffRow: {
    marginBottom: 0,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(14, 36, 32, 0.06)',
  },
  diffRowLast: {
    borderBottomWidth: 0,
  },
  diffRowMatch: {
    backgroundColor: 'rgba(62, 143, 98, 0.06)',
  },
  diffRowMismatch: {
    backgroundColor: 'rgba(160, 48, 48, 0.06)',
  },
  diffLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  diffValue: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '500',
  },
  diffMismatch: {
    color: colors.maroon,
  },
  warn: {
    backgroundColor: 'rgba(198, 162, 78, 0.12)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.35)',
    padding: space[4],
  },
  warnTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b5418',
    marginBottom: space[2],
  },
  warnMsg: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  success: {
    backgroundColor: colors.successMuted,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(62, 143, 98, 0.3)',
    padding: space[4],
  },
  successText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.verified,
  },
})
