import { createContext, useContext, useMemo, useState } from 'react'

const DashboardUiContext = createContext(null)

export function DashboardUiProvider({ children }) {
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)

  const value = useMemo(
    () => ({
      verifyOpen,
      setVerifyOpen,
      openVerify: () => setVerifyOpen(true),
      closeVerify: () => setVerifyOpen(false),
      topUpOpen,
      setTopUpOpen,
      openTopUp: () => setTopUpOpen(true),
      closeTopUp: () => setTopUpOpen(false),
    }),
    [verifyOpen, topUpOpen],
  )

  return (
    <DashboardUiContext.Provider value={value}>
      {children}
    </DashboardUiContext.Provider>
  )
}

export function useDashboardUi() {
  const ctx = useContext(DashboardUiContext)
  if (!ctx) throw new Error('useDashboardUi must be used within DashboardUiProvider')
  return ctx
}
