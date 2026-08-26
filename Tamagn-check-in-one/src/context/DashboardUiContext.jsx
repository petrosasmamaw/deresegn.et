import { createContext, useContext, useState, useMemo } from 'react'

const DashboardUiContext = createContext(null)

export function DashboardUiProvider({ children }) {
  const [topupOpen, setTopupOpen] = useState(false)
  const [checkerOpen, setCheckerOpen] = useState(false)

  const value = useMemo(
    () => ({
      topupOpen,
      setTopupOpen,
      checkerOpen,
      setCheckerOpen,
      openTopUp: () => setTopupOpen(true),
      openVerify: () => setCheckerOpen(true),
    }),
    [topupOpen, checkerOpen],
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
