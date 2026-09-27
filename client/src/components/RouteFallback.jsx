import { useLocale } from '../i18n/LocaleContext'

/**
 * Fallback shown while a lazily-loaded route chunk downloads. Kept lightweight
 * and on-brand (parchment + skeleton) so the transition feels instant.
 */
export default function RouteFallback() {
  const { t } = useLocale()
  return (
    <div className="min-h-screen flex items-center justify-center page-parchment" aria-busy="true" aria-live="polite">
      <div className="w-8 h-8 border-3 border-[var(--color-birr-green)] border-t-transparent rounded-full animate-spin" />
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}

