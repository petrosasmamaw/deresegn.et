import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import { clearError, signup } from '../features/auth/authSlice'
import { getWebBaseUrl } from '../api/apiBase'
import { displayAuthError } from '../lib/errors'
import { alertIfOffline } from '../lib/guardOnline'
import useIsOnline from '../hooks/useIsOnline'
import { useLocale } from '../i18n/LocaleContext'
import BrandLockup from '../components/BrandLockup'
import LangToggle from '../components/LangToggle'
import { ui } from '../theme/styles'
import { colors, space } from '../theme/tokens'

export default function RegisterScreen({ navigation }) {
  const { t } = useLocale()
  const insets = useSafeAreaInsets()
  const dispatch = useDispatch()
  const { submitting, error } = useSelector((s) => s.auth)
  const online = useIsOnline()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const canSubmit = name.trim() && email.trim() && password.length >= 8
  const webBase = getWebBaseUrl()

  const openLegal = (path) => {
    if (!webBase) return
    Linking.openURL(`${webBase}${path}`).catch(() => {})
  }

  const onSubmit = () => {
    if (!alertIfOffline(online, t)) return
    dispatch(clearError())
    dispatch(signup({ name: name.trim(), email: email.trim(), password }))
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
          <Text style={ui.subtitle}>{t('auth.registerSubtitle')}</Text>
          <View style={styles.bonus}>
            <Text style={styles.bonusText}>{t('auth.bonusBanner', { amount: 20 })}</Text>
          </View>
        </View>

        <View style={ui.formSheet}>
          <Text style={styles.sectionTitle}>{t('auth.registerTitle')}</Text>
          <View style={ui.card}>
            {error ? (
              <View style={ui.errorBox}>
                <Text style={ui.errorText}>{displayAuthError(error, t)}</Text>
              </View>
            ) : null}

            <Text style={ui.label}>{t('auth.fullName')}</Text>
            <TextInput
              style={ui.input}
              value={name}
              onChangeText={setName}
              autoComplete="name"
              placeholder={t('auth.namePlaceholder')}
              placeholderTextColor={colors.textTertiary}
            />

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
              autoComplete="new-password"
              placeholder="••••••••"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={ui.helper}>{t('auth.minPassword')}</Text>

            <Pressable
              onPress={onSubmit}
              disabled={submitting || !canSubmit}
              style={[ui.btnPrimary, (submitting || !canSubmit) && ui.btnDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={ui.btnPrimaryText}>{t('auth.createAccount')}</Text>
              )}
            </Pressable>
          </View>

          <View style={ui.linkRow}>
            <Text style={ui.linkText}>
              {t('auth.haveAccount')}{' '}
              <Text style={ui.linkAccent} onPress={() => navigation.navigate('Login')}>
                {t('auth.signIn')}
              </Text>
            </Text>
          </View>

          <View style={styles.legalRow}>
            <Text style={styles.legalLink} onPress={() => openLegal('/privacy')}>
              {t('legal.privacy')}
            </Text>
            <Text style={styles.legalSep}> · </Text>
            <Text style={styles.legalLink} onPress={() => openLegal('/terms')}>
              {t('legal.terms')}
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
  bonus: {
    marginTop: space[4],
    padding: space[3],
    borderWidth: 1,
    borderColor: 'rgba(198, 162, 78, 0.45)',
    backgroundColor: 'rgba(198, 162, 78, 0.12)',
    maxWidth: 340,
  },
  bonusText: {
    color: colors.textOnDark,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'left',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.birrGreen,
    textAlign: 'center',
    marginBottom: space[4],
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: space[6],
    marginBottom: space[4],
  },
  legalLink: {
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalSep: {
    fontSize: 12,
    color: colors.textTertiary,
  },
})
