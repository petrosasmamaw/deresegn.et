/** Visible SEO copy on public auth pages — helps Google index target search phrases. */
import { useLocale } from '../i18n/LocaleContext'

export default function AuthSeoBlurb() {
  const { t } = useLocale()
  return (
    <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 max-w-md mx-auto leading-relaxed px-4">
      {t('auth.seo')}
    </p>
  )
}
