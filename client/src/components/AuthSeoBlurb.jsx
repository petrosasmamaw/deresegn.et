/** Visible SEO copy on public auth pages — helps Google index target search phrases. */
import { useLocale } from '../i18n/LocaleContext'

export default function AuthSeoBlurb() {
  const { t } = useLocale()
  return (
    <p
      className="text-center max-w-md mx-auto leading-relaxed px-3 mt-8"
      style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--color-text-tertiary)',
      }}
    >
      {t('auth.seo')}
    </p>
  )
}
