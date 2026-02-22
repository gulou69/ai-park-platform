/**
 * 管理后台配置文件
 */

// 获取环境变量
const isDev = import.meta.env.DEV
const isProd = import.meta.env.PROD

export default {
  // API配置
  api: {
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
    timeout: 10000
  },
  
  // 应用配置
  app: {
    name: 'AI Park 管理后台',
    version: '1.0.0',
    isDev,
    isProd
  },
  
  // 存储键名
  storage: {
    tokenKey: 'admin_token',
    userKey: 'admin_info'
  }
}
