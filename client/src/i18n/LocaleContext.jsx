import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { en } from './en'
import { am } from './am'

const catalogs = { en, am }
const STORAGE_KEY = 'deresegn_locale'
const LocaleContext = createContext(null)

function readStoredLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'am' || v === 'en') return v
  } catch {
    // ignore
  }
  return 'en'
}

function interpolate(template, vars = {}) {
  if (!vars || typeof template !== 'string') return template
  return template.replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] == null ? `{${key}}` : String(vars[key])
  ))
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => (
    typeof window === 'undefined' ? 'en' : readStoredLocale()
  ))

  useEffect(() => {
    document.documentElement.lang = locale === 'am' ? 'am' : 'en'
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // ignore
    }
  }, [locale])

  const setLocale = useCallback((next) => {
    setLocaleState(next === 'am' ? 'am' : 'en')
  }, [])

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === 'am' ? 'en' : 'am'))
  }, [])

  const t = useCallback((key, vars) => {
    const table = catalogs[locale] || en
    const raw = table[key] ?? en[key] ?? key
    return interpolate(raw, vars)
  }, [locale])

  const value = useMemo(() => ({
    locale,
    isAm: locale === 'am',
    setLocale,
    toggleLocale,
    t,
  }), [locale, setLocale, toggleLocale, t])

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider')
  }
  return ctx
}

/** Optional: safe outside provider during tests — falls back to English. */
export function useOptionalLocale() {
  return useContext(LocaleContext)
}
