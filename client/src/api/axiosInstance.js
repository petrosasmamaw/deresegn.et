import axios from 'axios'
import { getApiBaseUrl } from '../lib/apiBase'

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

export default axiosInstance
