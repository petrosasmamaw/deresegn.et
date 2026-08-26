import { useLocale } from '../i18n/LocaleContext'

/** Compact Eng / አማ toggle — solid chip so both labels stay visible on dark nav & light auth. */
export default function LangToggle({ className = '' }) {
  const { locale, setLocale, t } = useLocale()

  return (
    <div
      className={`lang-toggle ${className}`.trim()}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        className={`lang-toggle-btn${locale === 'en' ? ' is-active' : ''}`}
        aria-pressed={locale === 'en'}
        title={t('lang.switchToEn')}
        onClick={() => setLocale('en')}
      >
        {t('lang.en')}
      </button>
      <button
        type="button"
        className={`lang-toggle-btn${locale === 'am' ? ' is-active' : ''}`}
        aria-pressed={locale === 'am'}
        title={t('lang.switchToAm')}
        onClick={() => setLocale('am')}
      >
        {t('lang.am')}
      </button>
    </div>
  )
}
