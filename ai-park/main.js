import App from './App'
import { themeManager } from './utils/theme.js'
import './uni.promisify.adaptor'
// 引入存储监控
import './utils/storage-monitor.js'

// 修改调试工具初始化方式
const initDebugStream = () => {
  try {
    // 在setTimeout中确保window已完全初始化
    setTimeout(() => {
      const debugStream = require('./utils/debugStream').default;
      if (debugStream && typeof debugStream.startMonitoring === 'function') {
        // 保存原始fetch防止被多次包装
        if (!window._originalFetch) {
          window._originalFetch = window.fetch;
        }

        debugStream.startMonitoring();
        console.log('调试环境：流式数据监控已启用');
      }
    }, 1000); // 延长时间确保DOM和环境完全加载
  } catch (err) {
    console.error('初始化调试工具失败:', err);
  }
};

// 在开发环境下自动启用调试工具
if (process.env.NODE_ENV === 'development') {
  if (typeof window !== 'undefined') {
    // 确保在客户端环境运行
    initDebugStream();
  }
}

// 初始化全局数据
const globalData = {
  theme: uni.getStorageSync('theme') || 'light',
  currentModel: null,
  userInfo: uni.getStorageSync('userInfo') || null,
  isLoggedIn: uni.getStorageSync('isLoggedIn') || false,
}

// #ifndef VUE3
import Vue from 'vue'
Vue.config.productionTip = false
App.mpType = 'app'

// 全局数据挂载
Vue.prototype.$store = {
  globalData,
  debug: false,
  state: {
    theme: uni.getStorageSync('theme') || 'light',
    isLoggedIn: uni.getStorageSync('isLoggedIn') || false,
    userInfo: uni.getStorageSync('userInfo') || {}
  }
}

// 全局混入
Vue.mixin({
  computed: {
    $theme() {
      return getApp().globalData.theme
    },
    $isDark() {
      return getApp().globalData.theme === 'dark'
    },
    $isLoggedIn() {
      return uni.getStorageSync('isLoggedIn') || false
    },
    $userInfo() {
      return uni.getStorageSync('userInfo') || {}
    }
  }
})

const app = new Vue({
  ...App
})
app.globalData = globalData
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)

  // 全局数据挂载
  app.config.globalProperties.$store = {
    globalData
  }

  app.globalData = globalData
  return {
    app
  }
}
// #endif

// 初始化主题
themeManager.init()