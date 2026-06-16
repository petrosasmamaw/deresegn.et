import axios from 'axios'
import { getApiBaseUrl } from '../lib/apiBase'

const axiosInstance = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
})

export default axiosInstance
