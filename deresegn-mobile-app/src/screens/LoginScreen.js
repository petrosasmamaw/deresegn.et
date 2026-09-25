import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { clearError, login } from '../features/auth/authSlice'
import { displayAuthError } from '../lib/errors'
import { alertIfOffline } from '../lib/guardOnline'
import useIsOnline from '../hooks/useIsOnline'
import { useLocale } from '../i18n/LocaleContext'
import BrandLockup from '../components/BrandLockup'
import LangToggle from '../components/LangToggle'
import { ui } from '../theme/styles'
import { colors, space } from '../theme/tokens'

export default function LoginScreen({ navigation }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const { initializing, submitting, error, sessionNetworkError } = useSelector((s) => s.auth)
  const online = useIsOnline()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const isAuthenticating = initializing || submitting

  const onSubmit = () => {
    if (isAuthenticating) return
    if (!alertIfOffline(online, t)) return
    dispatch(clearError())
    dispatch(login({ email: email.trim(), password }))
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
          <Text style={ui.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>

        <View style={ui.formSheet}>
          <View style={ui.card}>
            {sessionNetworkError ? (
              <View style={[ui.errorBox, { marginBottom: space[3] }]}>
                <Text style={ui.errorText}>{t('offline.body')}</Text>
                <Pressable
                  onPress={() => dispatch(fetchSession())}
                  style={[ui.btnSecondary, { marginTop: space[2], paddingVertical: 6 }]}
                >
                  <Text style={ui.btnSecondaryText}>{t('sessionOpen.retry') || 'Retry'}</Text>
                </Pressable>
              </View>
            ) : null}

            {!initializing && error ? (
              <View style={ui.errorBox}>
                <Text style={ui.errorText}>{displayAuthError(error, t)}</Text>
              </View>
            ) : null}

            <Text style={ui.label}>{t('auth.email')}</Text>
            <TextInput
              style={[ui.input, isAuthenticating && styles.inputDisabled]}
              value={initializing ? '••••••••' : email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="your@email.com"
              placeholderTextColor={colors.textTertiary}
              editable={!isAuthenticating}
            />

            <Text style={ui.label}>{t('auth.password')}</Text>
            <TextInput
              style={[ui.input, isAuthenticating && styles.inputDisabled]}
              value={initializing ? '••••••••' : password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
              editable={!isAuthenticating}
            />

            <Text
              style={[styles.forgot, isAuthenticating && { opacity: 0.5 }]}
              onPress={() => {
                if (!isAuthenticating) navigation.navigate('ForgotPassword')
              }}
            >
              {t('auth.forgotLink')}
            </Text>

            <Pressable
              onPress={onSubmit}
              disabled={isAuthenticating || (!initializing && (!email || !password))}
              style={[
                ui.btnPrimary,
                (isAuthenticating || !email || !password) && ui.btnDisabled,
                styles.submitBtn,
              ]}
            >
              {isAuthenticating ? (
                <View style={styles.loggingInRow}>
                  <ActivityIndicator size="small" color={colors.ink} />
                  <Text style={[ui.btnPrimaryText, styles.loggingInText]}>
                    {t('auth.loggingIn')}
                  </Text>
                </View>
              ) : (
                <Text style={ui.btnPrimaryText}>{t('auth.signIn')}</Text>
              )}
            </Pressable>
          </View>

          <View style={ui.linkRow}>
            <Text style={ui.linkText}>
              {t('auth.noAccount')}{' '}
              <Text
                style={[ui.linkAccent, isAuthenticating && { opacity: 0.5 }]}
                onPress={() => {
                  if (!isAuthenticating) navigation.navigate('Register')
                }}
              >
                {t('auth.createOne')}
              </Text>
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
  forgot: {
    alignSelf: 'flex-end',
    marginTop: space[2],
    marginBottom: space[1],
    fontSize: 13,
    fontWeight: '600',
    color: colors.birrGreen,
  },
  inputDisabled: {
    opacity: 0.65,
    backgroundColor: 'rgba(14, 36, 32, 0.04)',
  },
  submitBtn: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loggingInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  loggingInText: {
    fontWeight: '700',
  },
})
