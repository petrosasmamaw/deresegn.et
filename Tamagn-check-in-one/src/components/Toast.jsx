import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

const ToastContext = createContext(null)

let idSeq = 0

/**
 * Minimal, dependency-free toast system for transient success/error feedback.
 * Usage: const toast = useToast(); toast.error('message') / toast.success(...).
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback((message, type = 'info', duration = 5000) => {
    if (!message) return null
    const id = ++idSeq
    setToasts((list) => [...list, { id, message: String(message), type }])
    const timer = setTimeout(() => dismiss(id), duration)
    timers.current.set(id, timer)
    return id
  }, [dismiss])

  const api = useMemo(() => ({
    push,
    dismiss,
    info: (m, d) => push(m, 'info', d),
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d ?? 7000),
  }), [push, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" role="region" aria-label="Notifications">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast--${t.type}`}
            role={t.type === 'error' ? 'alert' : 'status'}
          >
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  // Safe no-op fallback if a component renders outside the provider.
  return ctx || { push: () => {}, dismiss: () => {}, info: () => {}, success: () => {}, error: () => {} }
}
