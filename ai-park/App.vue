<script>
import { onNetworkStatusChange } from './utils/network';
import { themeManager } from './utils/theme';
import config from './config';

export default {
  onLaunch: function() {
    console.log('App Launch');
    
    // 初始化主题
    themeManager.init();
    
    // 监听网络状态变化
    onNetworkStatusChange((res) => {
      if (!res.isConnected) {
        uni.showToast({
          title: '网络连接已断开',
          icon: 'none'
        });
      }
    });
    
    // 检查登录状态
    this.checkLoginStatus();
    
    // 监听登录事件
    uni.$on('login-success', (userData) => {
      console.log('用户登录成功:', userData);
      
      // 更新全局状态
      const token = uni.getStorageSync('token');
      if (token && userData) {
        this.globalData.isLoggedIn = true;
        this.globalData.userInfo = userData;
        uni.setStorageSync('isLoggedIn', true);
      }
    });
    
    // 监听登出事件
    uni.$on('logout', () => {
      this.globalData.isLoggedIn = false;
      this.globalData.userInfo = null;
      
      // 清除存储的用户信息
      uni.removeStorageSync('token');
      uni.removeStorageSync('userInfo');
      uni.removeStorageSync('isLoggedIn');
    });
  },
  
  onShow: function() {
    console.log('App Show', config.appName, config.version);
  },
  
  onHide: function() {
    console.log('App Hide');
  },
  
  methods: {
    checkLoginStatus() {
      // 检查是否有有效token
      const token = uni.getStorageSync('token');
      const userInfo = uni.getStorageSync('userInfo');
      
      if (token && userInfo) {
        this.globalData.isLoggedIn = true;
        this.globalData.userInfo = userInfo;
      } else {
        this.globalData.isLoggedIn = false;
        this.globalData.userInfo = null;
        
        // 清除可能存在的无效信息
        uni.removeStorageSync('isLoggedIn');
      }
    }
  }
};
</script>

<style>
/* 全局样式 */
page {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  min-height: 100vh;
  width: 100vw;
}

/* 基础样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

/* 输入框聚焦时去掉默认边框 */
input:focus,
textarea:focus {
  outline: none;
}

/* 禁用文字选择 */
.no-select {
  user-select: none;
  -webkit-user-select: none;
}

/* 允许文字选择 */
.selectable {
  user-select: text;
  -webkit-user-select: text;
}

/* 超出隐藏和省略号 */
.ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 多行省略号 */
.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 通用过渡效果 */
.transition {
  transition: all 0.3s ease;
}

/* 通用动画 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* 禁用滚动条但保留滚动功能 */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
.hide-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* 渐变文字 */
.gradient-text {
  background: linear-gradient(135deg, #007AFF, #00C6FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* 全局加载动画 */
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(0, 122, 255, 0.3);
  border-top-color: #007AFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 通用按钮样式 */
.btn {
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-primary {
  background: linear-gradient(135deg, #007AFF, #00C6FF);
  color: white;
}

.btn-secondary {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

/* 弹性布局工具类 */
.flex {
  display: flex;
}

.flex-column {
  flex-direction: column;
}

.justify-center {
  justify-content: center;
}

.justify-between {
  justify-content: space-between;
}

.items-center {
  align-items: center;
}

.gap-2 {
  gap: 8px;
}

.gap-4 {
  gap: 16px;
}
</style>
