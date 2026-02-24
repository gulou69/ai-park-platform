import App from './App'
import { themeManager } from './utils/theme.js'
import './uni.promisify.adaptor'

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