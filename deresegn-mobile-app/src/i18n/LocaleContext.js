import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { en } from './en'
import { am } from './am'

const catalogs = { en, am }
const STORAGE_KEY = 'deresegn_locale'
const LocaleContext = createContext(null)

function interpolate(template, vars = {}) {
  if (!vars || typeof template !== 'string') return template
  return template.replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] == null ? `{${key}}` : String(vars[key])
  ))
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('en')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY)
        if (mounted && (v === 'am' || v === 'en')) {
          setLocaleState(v)
        }
      } catch {
        // ignore
      } finally {
        if (mounted) setReady(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const setLocale = useCallback((next) => {
    const value = next === 'am' ? 'am' : 'en'
    setLocaleState(value)
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {})
  }, [])

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => {
      const value = prev === 'am' ? 'en' : 'am'
      AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {})
      return value
    })
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
    ready,
  }), [locale, setLocale, toggleLocale, t, ready])

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
