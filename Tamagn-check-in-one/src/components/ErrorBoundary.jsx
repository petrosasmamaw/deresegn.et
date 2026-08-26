import { Component } from 'react'
import { logger } from '../lib/logger'

/**
 * App-wide crash guard. A render/runtime error anywhere below this boundary
 * shows a recovery screen instead of a blank white page, and reports the error
 * through the logger (which forwards to Sentry when configured).
 *
 * Kept dependency-light and provider-independent on purpose: it sits ABOVE the
 * redux/router/i18n providers, so it must not rely on their context (they may
 * be the very thing that crashed). Copy is shown bilingually for that reason.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
    this.handleReload = this.handleReload.bind(this)
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    logger.error('React render error', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    })
  }

  handleReload() {
    // Full reload gives the app a clean state to recover from.
    window.location.assign('/')
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
          color: '#e2e8f0',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'rgba(15, 23, 42, 0.6)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 20px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              fontSize: '28px',
            }}
            aria-hidden="true"
          >
            !
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '13px', opacity: 0.7, margin: '0 0 20px' }}>
            የሆነ ስህተት ተከስቷል። እባክዎ ገጹን ዳግም ይጫኑ።
          </p>
          <p style={{ fontSize: '14px', opacity: 0.85, lineHeight: 1.6, margin: '0 0 24px' }}>
            The page hit an unexpected error. Reloading usually fixes it — your
            data is safe.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '15px',
              fontWeight: 600,
              color: '#ffffff',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            }}
          >
            Reload app · ዳግም ጫን
          </button>
        </div>
      </div>
    )
  }
}
