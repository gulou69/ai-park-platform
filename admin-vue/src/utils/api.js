import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'
import config from '@/config'

// 创建axios实例
const api = axios.create({
  baseURL: config.api.baseURL,
  timeout: config.api.timeout,
  withCredentials: true // 支持跨域携带cookie
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    console.log('API请求:', config.method?.toUpperCase(), config.url)
    return config
  },
  error => {
    console.error('请求拦截器错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    console.log('API响应:', response.config?.method?.toUpperCase(), response.config?.url, response.status)
    return response.data
  },
  error => {
    console.error('API错误:', error)
    const { response } = error
    
    if (response?.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_info')
      router.push('/login')
    } else if (response?.status === 403) {
      ElMessage.error('权限不足，无法执行此操作')
    } else if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
      ElMessage.error('网络连接失败，请检查后端服务是否正常运行')
    } else {
      ElMessage.error(response?.data?.message || error.message || '请求失败')
    }
    
    return Promise.reject(error)
  }
)

export default api 