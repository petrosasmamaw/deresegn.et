import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { initTheme } from './lib/theme.js'
import { LocaleProvider } from './i18n/LocaleContext.jsx'
import './index.css'
import App from './App.jsx'
import store from './app/store'

initTheme()

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <LocaleProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </LocaleProvider>
  </Provider>,
)
