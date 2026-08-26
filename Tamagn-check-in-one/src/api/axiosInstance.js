import axios from 'axios'
import { getApiBaseUrl } from '../lib/apiBase'
import { notifyUnauthorized } from './onUnauthorized'

const axiosInstance = axios.create({
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'X-Tamagn-Client': '1',
  },
})

axiosInstance.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = getApiBaseUrl()
  }
  config.headers = config.headers || {}
  config.headers['X-Requested-With'] = 'XMLHttpRequest'
  config.headers['X-Tamagn-Client'] = '1'
  return config
})

// Global session-expiry handling: a 401 on any API call means the cookie is no
// longer valid — clear the stale user so guarded routes bounce to /login.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && !error?.config?.skipAuthExpire) {
      notifyUnauthorized()
    }
    return Promise.reject(error)
  },
)

export default axiosInstance
