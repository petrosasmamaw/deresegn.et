import axios from 'axios'
import { getApiBaseUrl } from '../lib/apiBase'

const axiosInstance = axios.create({
  withCredentials: true,
})

axiosInstance.interceptors.request.use((config) => {
  if (!config.baseURL) {
    config.baseURL = getApiBaseUrl()
  }
  return config
})

export default axiosInstance
