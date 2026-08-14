import { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { api } from '../api/http'
import { unwrap } from '../api/unwrap'
import { useLocale } from '../i18n/LocaleContext'
import { ui } from '../theme/styles'
import { colors, radius, space } from '../theme/tokens'

const METHODS = [
  { id: 'telebirr', icon: 'phone-portrait-outline', hintKey: 'accounts.telebirrHint', placeholder: '09XXXXXXXX' },
  { id: 'cbe', icon: 'business-outline', hintKey: 'accounts.cbeHint', placeholder: '1000333687112' },
  { id: 'boa', icon: 'business-outline', hintKey: 'accounts.boaHint', placeholder: '246302723' },
  { id: 'dashen', icon: 'business-outline', hintKey: 'accounts.dashenHint', placeholder: '0131XXXXXXXX' },
]

export default function MyAccountsScreen() {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const [forms, setForms] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await api.get('/me/accounts')
      if (res.status >= 400) throw new Error(res.data?.message || t('accounts.loadFailed'))
      const list = unwrap(res).accounts || []
      const next = {}
      list.forEach((row) => {
        next[row.method] = {
          accountName: row.accountName || '',
          accountNumber: row.accountNumber || '',
          saved: Boolean(row.id || (row.accountName && row.accountNumber)),
        }
      })
      METHODS.forEach((m) => {
        if (!next[m.id]) next[m.id] = { accountName: '', accountNumber: '', saved: false }
      })
      setForms(next)
    } catch (err) {
      setError(err.message || t('accounts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useFocusEffect(
    useCallback(() => {
      setLoading(true)
      load()
    }, [load]),
  )

  const handleChange = (method, field, value) => {
    setForms((prev) => ({ ...prev, [method]: { ...prev[method], [field]: value } }))
  }

  const handleSave = async (method) => {
    try {
      setSaving(method)
      setError(null)
      const payload = forms[method]
      const res = await api.put(`/me/accounts/${method}`, {
        accountName: payload.accountName,
        accountNumber: payload.accountNumber,
      })
      if (res.status >= 400) throw new Error(res.data?.message || t('accounts.saveFailed'))
      const updated = unwrap(res).account
      setForms((prev) => ({
        ...prev,
        [method]: {
          accountName: updated.accountName,
          accountNumber: updated.accountNumber,
          saved: true,
        },
      }))
    } catch (err) {
      setError(err.message || t('accounts.saveFailed'))
    } finally {
      setSaving(null)
    }
  }

  const handleRemove = async (method) => {
    Alert.alert(t('accounts.remove'), t(`method.${method}`), [
      { text: t('common.close'), style: 'cancel' },
      {
        text: t('accounts.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(method)
            const res = await api.delete(`/me/accounts/${method}`)
            if (res.status >= 400) throw new Error(res.data?.message || t('accounts.saveFailed'))
            setForms((prev) => ({
              ...prev,
              [method]: { accountName: '', accountNumber: '', saved: false },
            }))
          } catch (err) {
            setError(err.message || t('accounts.saveFailed'))
          } finally {
            setSaving(null)
          }
        },
      },
    ])
  }

  const cards = useMemo(() => METHODS, [])

  return (
    <View style={[ui.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel={t('common.back')}>
          <Ionicons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('accounts.title')}</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.subtitle}>{t('accounts.subtitle')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading ? (
          <ActivityIndicator color={colors.foilGold} style={{ marginTop: space[6] }} />
        ) : (
          cards.map((meta) => {
            const form = forms[meta.id] || { accountName: '', accountNumber: '' }
            return (
              <View key={meta.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Ionicons name={meta.icon} size={18} color={colors.birrGreen} />
                  <Text style={styles.cardTitle}>{t(`method.${meta.id}`)}</Text>
                </View>
                <Text style={ui.helper}>{t(meta.hintKey)}</Text>
                <Text style={ui.label}>{t('accounts.name')}</Text>
                <TextInput
                  style={ui.input}
                  value={form.accountName}
                  onChangeText={(v) => handleChange(meta.id, 'accountName', v)}
                  placeholder={t('accounts.namePlaceholder')}
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={ui.label}>{t('accounts.number')}</Text>
                <TextInput
                  style={ui.input}
                  value={form.accountNumber}
                  onChangeText={(v) => handleChange(meta.id, 'accountNumber', v)}
                  placeholder={meta.placeholder}
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={[ui.btnPrimary, saving === meta.id && ui.btnDisabled]}
                  disabled={saving === meta.id}
                  onPress={() => handleSave(meta.id)}
                >
                  {saving === meta.id ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <Text style={ui.btnPrimaryText}>{t('accounts.save')}</Text>
                  )}
                </Pressable>
                {form.saved ? (
                  <Pressable
                    style={[ui.btnSecondary, { marginTop: space[2] }]}
                    disabled={saving === meta.id}
                    onPress={() => handleRemove(meta.id)}
                  >
                    <Text style={ui.btnSecondaryText}>{t('accounts.remove')}</Text>
                  </Pressable>
                ) : null}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  body: {
    padding: space[4],
    paddingBottom: space[10],
    gap: space[4],
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.maroon,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg || 12,
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.28)',
    padding: space[4],
    gap: space[2],
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
})
