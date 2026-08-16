import { useMemo, useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocale } from '../i18n/LocaleContext'
import { buildShareUrl, copyCertLink, shareCertLink } from '../lib/shareCertificate'
import { colors } from '../theme/tokens'

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

export default function VerificationCertificate({ check, compact = false, details = null }) {
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

  if (!check) return null

  const shareUrl = check.shareToken ? buildShareUrl(check.shareToken) : null
  const verifiedAt = check.createdAt || check.verifiedAt
  const methodLabel = methodLabels[check.paymentMethod] || check.paymentMethod || '—'

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
        <View style={{ flex: 1 }}>
          <Text style={styles.paymentTitle}>{t('cert.paymentTitle')}</Text>
          {check.id != null ? (
            <Text style={styles.certId}>{t('cert.certificateId', { id: check.id })}</Text>
          ) : null}
        </View>
        <View style={styles.validStamp}>
          <Text style={styles.validText}>{t('cert.valid')}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.amountHero}>
          {displayValue(check.amount)}
          <Text style={styles.amountUnit}> ETB</Text>
        </Text>
        <Text style={styles.txHero}>{displayValue(check.transactionCode)}</Text>

        <View style={styles.grid}>
          <View style={styles.gridCell}>
            <Text style={styles.dt}>{t('field.sender')}</Text>
            <Text style={styles.dd}>{displayValue(check.senderName)}</Text>
            {details?.senderAccount ? (
              <Text style={styles.sub}>{displayValue(details.senderAccount)}</Text>
            ) : null}
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.dt}>{t('field.receiver')}</Text>
            <Text style={styles.dd}>{displayValue(check.receiverName)}</Text>
            {details?.receiverAccount ? (
              <Text style={styles.sub}>{displayValue(details.receiverAccount)}</Text>
            ) : null}
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.dt}>{t('cert.bankMethod')}</Text>
            <Text style={styles.dd}>{methodLabel}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={styles.dt}>{t('cert.verifiedAt')}</Text>
            <Text style={styles.dd}>{formatDate(verifiedAt)}</Text>
          </View>
        </View>

        <Text style={styles.sign}>{t('cert.verifiedBy')}</Text>
      </View>

      {shareUrl ? (
        <View style={styles.actions}>
          <Pressable style={styles.ghostBtn} onPress={handleCopy}>
            <Ionicons name="link-outline" size={16} color={colors.ink} />
            <Text style={styles.ghostText}>{copied ? t('cert.copied') : t('cert.copy')}</Text>
          </Pressable>
          <Pressable style={styles.inkBtn} onPress={handleShare}>
            <Ionicons name="share-outline" size={16} color="#F4EEDC" />
            <Text style={styles.inkText}>{t('cert.share')}</Text>
          </Pressable>
          <Pressable style={styles.ghostBtn} onPress={handleOpen}>
            <Ionicons name="open-outline" size={16} color={colors.ink} />
            <Text style={styles.ghostText}>{t('cert.openWeb')}</Text>
          </Pressable>
        </View>
      ) : null}

      {shareError ? <Text style={styles.shareError}>{shareError}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#F4EEDC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.4)',
    overflow: 'hidden',
    shadowColor: '#0E2420',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  cardCompact: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 15,
    backgroundColor: '#1B463A',
  },
  paymentTitle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: '#F4EEDC',
    lineHeight: 22,
  },
  certId: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(244, 238, 220, 0.7)',
    fontVariant: ['tabular-nums'],
  },
  validStamp: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: '#3E8F62',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-15deg' }],
  },
  validText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3E8F62',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  amountHero: {
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: colors.ink,
  },
  amountUnit: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  txHero: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    fontWeight: '600',
    color: colors.birrGreen,
  },
  grid: { gap: 15 },
  gridCell: { gap: 3 },
  dt: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  dd: {
    fontSize: 15,
    color: colors.ink,
    lineHeight: 20,
  },
  sub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  sign: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '600',
    color: colors.birrGreen,
  },
  actions: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 8,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 36, 32, 0.2)',
    backgroundColor: 'transparent',
  },
  ghostText: { fontSize: 13, fontWeight: '700', color: colors.ink },
  inkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#0E2420',
  },
  inkText: { fontSize: 13, fontWeight: '700', color: '#F4EEDC' },
  shareError: {
    marginHorizontal: 18,
    marginBottom: 14,
    fontSize: 12,
    color: colors.maroon,
    fontWeight: '600',
  },
})

