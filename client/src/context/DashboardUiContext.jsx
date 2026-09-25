import { createContext, useContext, useState, useMemo } from 'react'

const DashboardUiContext = createContext(null)

export function DashboardUiProvider({ children }) {
  const [topupOpen, setTopupOpen] = useState(false)
  const [checkerOpen, setCheckerOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState('home')

  const value = useMemo(
    () => ({
      topupOpen,
      setTopupOpen,
      checkerOpen,
      setCheckerOpen,
      mobileTab,
      setMobileTab,
      openTopUp: () => setTopupOpen(true),
      openVerify: () => setCheckerOpen(true),
    }),
    [topupOpen, checkerOpen, mobileTab],
  )

  return (
    <DashboardUiContext.Provider value={value}>
      {children}
    </DashboardUiContext.Provider>
  )
}

export function useDashboardUi() {
  const ctx = useContext(DashboardUiContext)
  if (!ctx) {
    throw new Error('useDashboardUi must be used within DashboardUiProvider')
  }
  return ctx
}

export function useDashboardUiOptional() {
  return useContext(DashboardUiContext)
}
