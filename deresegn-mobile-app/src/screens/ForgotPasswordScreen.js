import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { authApi } from '../api/http'
import { getWebBaseUrl } from '../api/apiBase'
import { friendlyErrorMessage } from '../lib/errors'
import { useLocale } from '../i18n/LocaleContext'
import BrandLockup from '../components/BrandLockup'
import LangToggle from '../components/LangToggle'
import { ui } from '../theme/styles'
import { colors, space } from '../theme/tokens'

export default function ForgotPasswordScreen({ navigation }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const canSubmit = email.trim().length > 3 && email.includes('@')

  const onSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      await authApi.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${getWebBaseUrl()}/reset-password`,
      })
      setSent(true)
    } catch (err) {
      setError(friendlyErrorMessage(err, t, t('auth.resetRequestFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={ui.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[ui.heroBand, { paddingTop: Math.max(insets.top, space[8]) }]}>
          <View style={styles.lang}>
            <LangToggle />
          </View>
          <BrandLockup dark />
          <Text style={ui.subtitle}>{t('auth.forgotSubtitle')}</Text>
        </View>

        <View style={ui.formSheet}>
          <Text style={styles.sectionTitle}>{t('auth.forgotTitle')}</Text>
          <View style={ui.card}>
            {sent ? (
              <View style={styles.sentBox}>
                <Text style={styles.sentTitle}>{t('auth.resetSentTitle')}</Text>
                <Text style={styles.sentBody}>
                  {t('auth.resetSentBody', { email: email.trim() })}
                </Text>
                <Text style={styles.sentHint}>{t('auth.resetSentHint')}</Text>
              </View>
            ) : (
              <>
                {error ? (
                  <View style={ui.errorBox}>
                    <Text style={ui.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Text style={styles.help}>{t('auth.forgotHelp')}</Text>

                <Text style={ui.label}>{t('auth.email')}</Text>
                <TextInput
                  style={ui.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="your@email.com"
                  placeholderTextColor={colors.textTertiary}
                />

                <Pressable
                  onPress={onSubmit}
                  disabled={submitting || !canSubmit}
                  style={[ui.btnPrimary, (submitting || !canSubmit) && ui.btnDisabled]}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.ink} />
                  ) : (
                    <Text style={ui.btnPrimaryText}>{t('auth.sendResetLink')}</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>

          <View style={ui.linkRow}>
            <Text style={ui.linkAccent} onPress={() => navigation.navigate('Login')}>
              {t('auth.backToLogin')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  lang: {
    position: 'absolute',
    top: space[3],
    right: space[4],
    zIndex: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.birrGreen,
    textAlign: 'center',
    marginBottom: space[4],
  },
  help: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    marginBottom: space[4],
  },
  sentBox: {
    alignItems: 'center',
    paddingVertical: space[2],
  },
  sentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.birrGreen,
    marginBottom: space[3],
    textAlign: 'center',
  },
  sentBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sentHint: {
    marginTop: space[3],
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
    textAlign: 'center',
  },
})
