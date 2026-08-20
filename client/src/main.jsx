import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { initTheme } from './lib/theme.js'
import { initMonitoring } from './lib/initMonitoring.js'
import { LocaleProvider } from './i18n/LocaleContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { setUnauthorizedHandler } from './api/onUnauthorized'
import { sessionExpired } from './features/auth/authSlice'
import './index.css'
import App from './App.jsx'
import store from './app/store'

initTheme()
initMonitoring()

// A 401 from any API call clears the stale session; guarded routes then
// redirect to /login. Registered here to avoid store/axios circular imports.
setUnauthorizedHandler(() => {
  store.dispatch(sessionExpired())
})

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <Provider store={store}>
      <LocaleProvider>
        <ToastProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToastProvider>
      </LocaleProvider>
    </Provider>
  </ErrorBoundary>,
)
