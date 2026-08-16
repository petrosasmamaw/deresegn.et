import { createContext, useContext, useMemo, useState } from 'react'

const DashboardUiContext = createContext(null)

export function DashboardUiProvider({ children }) {
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [topUpOpen, setTopUpOpen] = useState(false)
  const [deskTick, setDeskTick] = useState(0)
  const [verifyHandlers, setVerifyHandlers] = useState(null)

  const value = useMemo(
    () => ({
      verifyOpen,
      setVerifyOpen,
      openVerify: () => setDeskTick((n) => n + 1),
      closeVerify: () => setVerifyOpen(false),
      deskTick,
      topUpOpen,
      setTopUpOpen,
      openTopUp: () => setTopUpOpen(true),
      closeTopUp: () => setTopUpOpen(false),
      verifyHandlers,
      setVerifyHandlers,
    }),
    [verifyOpen, topUpOpen, deskTick, verifyHandlers],
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
