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
import { useLocale } from '../i18n/LocaleContext'
import BrandLockup from '../components/BrandLockup'
import LangToggle from '../components/LangToggle'
import { ui } from '../theme/styles'
import { colors, space } from '../theme/tokens'

export default function LoginScreen({ navigation }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const { submitting, error } = useSelector((s) => s.auth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const onSubmit = () => {
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
            {error ? (
              <View style={ui.errorBox}>
                <Text style={ui.errorText}>{displayAuthError(error, t)}</Text>
              </View>
            ) : null}

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

            <Text style={ui.label}>{t('auth.password')}</Text>
            <TextInput
              style={ui.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
            />

            <Text style={styles.forgot} onPress={() => navigation.navigate('ForgotPassword')}>
              {t('auth.forgotLink')}
            </Text>

            <Pressable
              onPress={onSubmit}
              disabled={submitting || !email || !password}
              style={[ui.btnPrimary, (submitting || !email || !password) && ui.btnDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={ui.btnPrimaryText}>{t('auth.signIn')}</Text>
              )}
            </Pressable>
          </View>

          <View style={ui.linkRow}>
            <Text style={ui.linkText}>
              {t('auth.noAccount')}{' '}
              <Text style={ui.linkAccent} onPress={() => navigation.navigate('Register')}>
                {t('auth.createOne')}
              </Text>
            </Text>
          </View>

          <Text style={styles.whyTitle}>{t('home.whyTitle')}</Text>
          <Text style={styles.why}>{t('home.why1')}</Text>
          <Text style={styles.why}>{t('home.why2')}</Text>
          <Text style={styles.why}>{t('home.why3')}</Text>
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
  whyTitle: {
    marginTop: space[6],
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  why: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
