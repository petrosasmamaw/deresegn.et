import { useMemo, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import BankStamp from './BankStamp'
import StatusStamp from './StatusStamp'
import { buildShareUrl, copyCertLink, shareCertLink } from '../lib/shareCertificate'
import { colors, radius, space } from '../theme/tokens'
import { ui } from '../theme/styles'

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayValue(value) {
  if (value == null || value === '') return '—'
  return String(value).trim() || '—'
}

export default function VerificationCertificate({ check, compact = false }) {
  const { t } = useLocale()
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState(null)

  const methodLabels = useMemo(
    () => ({
      telebirr: t('method.telebirr'),
      cbe: t('method.cbe'),
      boa: t('method.boa'),
      dashen: t('method.dashen'),
    }),
    [t],
  )

  const tierLabels = useMemo(
    () => ({
      verified: t('common.verified'),
      likely_valid: t('history.likelyValid'),
      suspicious: t('history.suspicious'),
    }),
    [t],
  )

  if (!check) return null

  const shareUrl = check.shareToken ? buildShareUrl(check.shareToken) : null
  const verifiedAt = check.createdAt || check.verifiedAt
  const tierKey = check.confidenceTier || 'verified'
  const methodLabel = methodLabels[check.paymentMethod] || check.paymentMethod || '—'
  const tierLabel = tierLabels[tierKey] || t('common.verified')

  const handleCopy = async () => {
    if (!check.shareToken) return
    try {
      setShareError(null)
      await copyCertLink(check.shareToken)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShareError(t('cert.shareFailed'))
    }
  }

  const handleShare = async () => {
    if (!check.shareToken) return
    try {
      setShareError(null)
      await shareCertLink(check.shareToken, t('cert.publicTitle'))
    } catch {
      setShareError(t('cert.shareFailed'))
    }
  }

  const handleOpen = async () => {
    if (!shareUrl) return
    try {
      await Linking.openURL(shareUrl)
    } catch {
      setShareError(t('cert.shareFailed'))
    }
  }

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Ionicons name="shield-checkmark" size={18} color={colors.foilGold} />
          <Text style={styles.brand}>{t('cert.verifiedBy')}</Text>
        </View>
        <View style={styles.validStamp}>
          <Text style={styles.validText}>{t('cert.valid')}</Text>
        </View>
      </View>

      {check.id != null ? (
        <Text style={styles.certId}>{t('cert.certificateId', { id: check.id })}</Text>
      ) : null}
      <Text style={styles.paymentTitle}>{t('cert.paymentTitle')}</Text>

      <View style={styles.stamps}>
        <BankStamp method={check.paymentMethod} />
        <StatusStamp tier={tierKey} />
      </View>

      <Row label={t('field.paymentId')} value={displayValue(check.transactionCode)} mono />
      <Row
        label={t('field.amountShort')}
        value={check.amount != null && check.amount !== '' ? `${check.amount} ETB` : '—'}
      />
      <Row label={t('field.sender')} value={displayValue(check.senderName)} />
      <Row label={t('field.receiver')} value={displayValue(check.receiverName)} />
      <Row label={t('cert.bankMethod')} value={methodLabel} />
      <Row label={t('cert.confidence')} value={tierLabel} />
      <Row label={t('cert.verifiedAt')} value={formatDate(verifiedAt)} />

      {shareUrl ? (
        <View style={styles.actions}>
          <Pressable style={[ui.btnSecondary, styles.actionBtn]} onPress={handleCopy}>
            <Ionicons name="link-outline" size={16} color={colors.ink} />
            <Text style={ui.btnSecondaryText}>
              {copied ? t('cert.copied') : t('cert.copy')}
            </Text>
          </Pressable>
          <Pressable style={[ui.btnPrimary, styles.actionBtn]} onPress={handleShare}>
            <Ionicons name="share-outline" size={16} color={colors.ink} />
            <Text style={ui.btnPrimaryText}>{t('cert.share')}</Text>
          </Pressable>
          <Pressable style={[ui.btnSecondary, styles.actionBtnFull]} onPress={handleOpen}>
            <Ionicons name="open-outline" size={16} color={colors.ink} />
            <Text style={ui.btnSecondaryText}>{t('cert.openWeb')}</Text>
          </Pressable>
        </View>
      ) : null}

      {shareError ? <Text style={styles.shareError}>{shareError}</Text> : null}
    </View>
  )
}

function Row({ label, value, mono }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderAccent,
    padding: space[4],
  },
  cardCompact: {
    padding: space[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[3],
    gap: space[2],
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  brand: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    flexShrink: 1,
  },
  validStamp: {
    borderWidth: 1.5,
    borderColor: colors.verified,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  validText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.verified,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  certId: {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 4,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: space[3],
  },
  stamps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: space[3],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
    flex: 1.3,
    textAlign: 'right',
  },
  mono: {
    fontVariant: ['tabular-nums'],
  },
  actions: {
    marginTop: space[4],
    gap: space[2],
  },
  actionBtn: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  actionBtnFull: {
    flexDirection: 'row',
    gap: 8,
    minHeight: 44,
  },
  shareError: {
    marginTop: space[2],
    fontSize: 12,
    color: colors.maroon,
    fontWeight: '600',
  },
})
