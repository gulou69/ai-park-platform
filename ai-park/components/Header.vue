<template>
  <view class="header" :class="{ 'mobile-header': isMobile }">
    <!-- 移动端布局 -->
    <template v-if="isMobile">
      <button class="menu-btn" @click="toggleMobileMenu">
        <image src="/static/icons/list.svg" mode="aspectFit" />
      </button>
      <text class="mobile-title">AI Park</text>
      <view class="user-avatar" @click="handleAvatarClick">
        <template v-if="isLoggedIn">
          <image :src="userInfo.avatar || '/static/icons/person-circle.svg'" mode="aspectFit" />
        </template>
        <view v-else class="avatar-placeholder">
          <text>登录</text>
        </view>
      </view>

      <!-- 移动端菜单 -->
      <view v-if="showMobileMenu" class="mobile-menu" @click="closeMobileMenu">
        <view class="menu-overlay" @click="closeMobileMenu"></view>
        <view class="menu-content" @click.stop>
          <view v-if="isLoggedIn" class="menu-header">
            <image :src="userInfo.avatar || '/static/icons/person-circle.svg'" mode="aspectFit" />
            <text>{{ userInfo.phone }}</text>
          </view>
          <view v-if="isLoggedIn" class="menu-divider"></view>
          <view class="menu-item" @click="handleMobileThemeToggle">
            <text class="icon">{{ themeIcon }}</text>
            <text>{{ currentTheme === 'dark' ? '浅色模式' : '深色模式' }}</text>
          </view>
          <view class="menu-item" @click="handleMobileHistory">
            <text class="icon">📜</text>
            <text>聊天历史</text>
          </view>
          <view class="menu-item" @click="handleMobileModel">
            <text class="icon">🤖</text>
            <text>选择模型</text>
          </view>
          <template v-if="isLoggedIn">
            <view class="menu-divider"></view>
            <view class="menu-item logout" @click="handleLogout">
              <text class="icon">🚪</text>
              <text>退出登录</text>
            </view>
          </template>
        </view>
      </view>
    </template>

    <!-- 电脑端布局 -->
    <template v-else>
      <view class="header-left">
        <text class="website-title">AI Park</text>
      </view>
      <view class="header-right">
        <button class="header-btn theme-switch" @click="handleThemeToggle">
          <text class="iconfont">{{ themeIcon }}</text>
          <text class="btn-text">主题</text>
        </button>

        <!-- 模型选择下拉菜单 -->
        <view class="model-dropdown">
          <button class="header-btn model" @click="toggleModels">
            <text class="iconfont">🤖</text>
            <text class="btn-text">模型</text>
          </button>
          <view class="dropdown-menu model-menu" v-show="showModels" @mouseleave="hideModels">
            <view v-if="freeModels.length === 0 && paidModels.length === 0" class="no-models-message">
              <text>暂无可用模型</text>
            </view>
            <template v-else>
              <view class="menu-section">
                <text class="section-title">免费模型</text>
                <view v-for="model in freeModels" :key="model.id" class="menu-item"
                  :class="{ active: currentModel === model.id }" @click="selectModel(model)">
                  <text>{{ model.name }}</text>
                  <text v-if="currentModel === model.id" class="check-mark">✓</text>
                </view>
              </view>
              <view class="menu-divider" v-if="paidModels.length > 0"></view>
              <view class="menu-section" v-if="paidModels.length > 0">
                <text class="section-title">付费模型</text>
                <view v-for="model in paidModels" :key="model.id" class="menu-item"
                  :class="{ active: currentModel === model.id }" @click="selectModel(model)">
                  <text>{{ model.name }}</text>
                  <text v-if="currentModel === model.id" class="check-mark">✓</text>
                </view>
              </view>
            </template>
          </view>
        </view>

        <!-- 设置下拉菜单 -->
        <view class="settings-dropdown">
          <button class="header-btn settings" @click="toggleSettings">
            <text class="iconfont">⚙️</text>
            <text class="btn-text">设置</text>
          </button>
          <view class="dropdown-menu" v-show="showSettings" @mouseleave="hideSettings">
            <view class="menu-section">
              <text class="section-title">外观</text>
              <view class="menu-item" @click="handleThemeToggle">
                <text>深色模式</text>
                <text class="toggle-switch" :class="{ 'switch-on': currentTheme === 'dark' }">
                  <text class="switch-handle"></text>
                </text>
              </view>
            </view>
          </view>
        </view>

        <!-- 用户头像下拉菜单 -->
        <view class="avatar-dropdown">
          <view class="user-avatar" @click="toggleAvatarMenu">
            <template v-if="isLoggedIn">
              <image :src="userInfo.avatar || '/static/icons/person-circle.svg'" mode="aspectFit"
                class="avatar-image" />
            </template>
            <view v-else class="avatar-placeholder">
              <text>登录</text>
            </view>
          </view>
          <view v-if="isLoggedIn && showAvatarMenu" class="dropdown-menu avatar-menu" @mouseleave="hideAvatarMenu">
            <view class="menu-section">
              <view class="menu-header">
                <image :src="userInfo.avatar || '/static/icons/person-circle.svg'" mode="aspectFit" />
                <text>{{ userInfo.phone }}</text>
              </view>
              <view class="menu-divider"></view>
              <view class="menu-item" @click="handleLogout">
                <text class="icon">🚪</text>
                <text>退出登录</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </template>

    <!-- 登录弹窗 -->
    <LoginPopUp v-if="showLoginPopup" @close="showLoginPopup = false" />
  </view>
</template>

<script>
import LoginPopUp from './LoginPopUp.vue'
import { modelApi } from '@/api/model'

export default {
  name: 'Header',
  components: {
    LoginPopUp
  },
  props: {
    isMobile: {
      type: Boolean,
      default: false
    },
    isLoggedIn: {
      type: Boolean,
      default: false
    },
    userInfo: {
      type: Object,
      default: () => ({})
    }
  },
  data() {
    return {
      showLoginTip: false,
      showLoginPopup: false,
      currentTheme: 'light',
      showSettings: false,
      showMobileMenu: false,
      showAvatarMenu: false,
      showModels: false,
      currentModel: null,
      freeModels: [],
      paidModels: [],
      modelList: []
    }
  },
  computed: {
    themeIcon() {
      return this.currentTheme === 'dark' ? '🌙' : '☀️'
    }
  },
  created() {
    this.currentTheme = getApp().globalData.theme;
    uni.$on('update-user-info', (userInfo) => {
      // 通过事件通知父组件更新用户信息
      this.$emit('update-login-status', true, userInfo);
    });
    this.initUserInfo();
    this.loadModels();
    const savedModelId = uni.getStorageSync('selected_model');
    if (savedModelId) {
      this.currentModel = savedModelId;
    }
  },
  mounted() {
    // 只在浏览器环境中添加事件监听
    if (typeof document !== 'undefined') {
      document.addEventListener('click', this.handleGlobalClick);
    }
  },
  beforeDestroy() {
    // 只在浏览器环境中移除事件监听
    if (typeof document !== 'undefined') {
      document.removeEventListener('click', this.handleGlobalClick);
    }
    uni.$off('update-user-info');
  },
  methods: {
    // 主题切换
    handleThemeToggle() {
      this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
      this.$emit('toggle-theme');
    },

    // 设置相关
    toggleSettings() {
      this.showSettings = !this.showSettings;
    },
    hideSettings() {
      this.showSettings = false;
    },

    // 移动端菜单
    toggleMobileMenu(event) {
      event.stopPropagation();
      this.showMobileMenu = !this.showMobileMenu;
    },
    
    // 关闭移动端菜单
    closeMobileMenu() {
      this.showMobileMenu = false;
    },
    
    handleMobileThemeToggle() {
      this.handleThemeToggle();
      this.showMobileMenu = false;
    },
    handleMobileHistory() {
      this.showMobileMenu = false;
      this.$emit('show-history');
    },
    handleMobileModel() {
      this.showMobileMenu = false;
      this.$emit('show-models');
    },

    // 用户相关
    handleAvatarClick() {
      if (!this.isLoggedIn) {
        this.showLoginPopup = true
      } else {
        this.$emit('avatar-click')
      }
    },
    initUserInfo() {
      const isLoggedIn = uni.getStorageSync('isLoggedIn');
      const userInfo = uni.getStorageSync('userInfo');
      if (isLoggedIn && userInfo) {
        // 通过事件通知父组件更新状态，而不是直接修改props
        this.$emit('update-login-status', true, {
          ...userInfo,
          avatar: userInfo.avatar || '/static/icons/person-circle.svg'
        });
      }
    },
    toggleAvatarMenu() {
      if (!this.isLoggedIn) {
        this.showLoginPopup = true;
        return;
      }
      this.showAvatarMenu = !this.showAvatarMenu;
    },
    hideAvatarMenu() {
      this.showAvatarMenu = false;
    },
    handleLogout() {
      uni.showModal({
        title: '退出登录',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('userInfo');
            uni.removeStorageSync('isLoggedIn');
            uni.removeStorageSync('selected_model');
            uni.removeStorageSync('chatHistory');

            // 通过事件通知父组件更新状态，而不是直接修改props
            this.$emit('update-login-status', false, {});
            this.showAvatarMenu = false;

            uni.$emit('user-logged-out');

            uni.showToast({
              title: '已退出登录',
              icon: 'success'
            });

            if (this.isMobile) {
              this.showMobileMenu = false;
            }
          }
        }
      });
    },

    // 模型相关
    toggleModels() {
      this.showModels = !this.showModels
      if (this.showModels) {
        this.showSettings = false
      }
    },
    hideModels() {
      this.showModels = false
    },
    async loadModels() {
      try {
        const response = await modelApi.getModels();
        const free_models = response.data?.free_models || [];
        const paid_models = response.data?.paid_models || [];
        
        this.freeModels = free_models;
        this.paidModels = paid_models;
        this.modelList = [...free_models, ...paid_models];
        
        if (this.modelList.length > 0) {
          if (!this.currentModel && free_models.length > 0) {
            this.selectModel(free_models[0]);
          } else if (this.currentModel) {
            const isValidModel = this.modelList.some(m => m.id == this.currentModel);
            if (!isValidModel && this.modelList.length > 0) {
              this.selectModel(this.modelList[0]);
            }
          }
        }
      } catch (error) {
        console.error('加载模型列表失败:', error);
        this.freeModels = [];
        this.paidModels = [];
        this.modelList = [];
      }
    },
    selectModel(model) {
      this.currentModel = model.id;
      uni.setStorageSync('selected_model', model.id);
      uni.$emit('model-changed', model);
      uni.removeStorageSync('currentConversation');
      uni.$emit('create-new-chat');
      this.hideModels();
      uni.showToast({
        title: `已切换到 ${model.name}，开始新对话`,
        icon: 'none',
        duration: 2000
      });
    },

    // 全局点击处理
    handleGlobalClick(event) {
      // 只在浏览器环境中处理
      if (typeof document === 'undefined') {
        return;
      }
      
      const menuContent = document.querySelector('.mobile-menu .menu-content')
      const menuBtn = document.querySelector('.menu-btn')
      const modelBtn = document.querySelector('.model-dropdown')
      const settingsBtn = document.querySelector('.settings-dropdown')

      if (!event.target.closest('.model-dropdown')) {
        this.hideModels()
      }
      if (!event.target.closest('.settings-dropdown')) {
        this.hideSettings()
      }
      if (menuContent && !menuContent.contains(event.target) &&
        menuBtn && !menuBtn.contains(event.target)) {
        this.showMobileMenu = false
      }
    },
  }
}
</script>

<style lang="scss" scoped>
// 顶部导航栏基础样式
.header {
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 40px;
  background: var(--header-bg);
  box-shadow: 0 2px 4px var(--shadow-color);
  position: sticky;
  top: 0;
  z-index: 1000;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;

  &:hover {
    background: var(--bg-secondary);
  }

  &.mobile-header {
    padding: 0 16px;
    height: 56px;

    .mobile-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      flex: 1;
      text-align: center;
      margin: 0 16px;
      background: linear-gradient(135deg, #007AFF, #00C6FF);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .menu-btn {
      width: 40px;
      height: 40px;
      padding: 8px;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.2s ease;

      &:active {
        background: var(--hover-bg);
      }

      image {
        width: 100%;
        height: 100%;
        filter: var(--icon-filter);
      }
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--input-bg);
      display: flex;
      align-items: center;
      justify-content: center;

      .avatar-placeholder {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: var(--text-secondary);
        background: var(--input-bg);
        transition: all 0.3s ease;

        &:hover {
          background: var(--hover-bg);
        }

        text {
          color: var(--text-secondary);
        }
      }
    }
  }
}

// 桌面端右侧按钮组
.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

// 导航栏按钮基础样式
.header-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 2px;
    background: #007AFF;
    transition: all 0.3s ease;
    transform: translateX(-50%);
  }

  &:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
  }

  &:hover::after {
    width: 100%;
  }

  .iconfont {
    font-size: 18px;
  }

  .btn-text {
    font-size: 14px;
  }
}

// 用户头像样式
.user-avatar {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
  background: var(--input-bg);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:has(.avatar-placeholder) {
    width: 50px;
    height: 50px;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-secondary);
    font-size: 14px;
    transition: all 0.3s ease;

    &:hover {
      background: var(--hover-bg);
    }
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    background-color: var(--bg-secondary);
    display: block;
  }
}

// 网站标题样式
.website-title {
  margin-left: 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  background: linear-gradient(135deg, #007AFF, #00C6FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

// 设置下拉菜单样式
.settings-dropdown {
  position: relative;
}

// 下拉菜单基础样式
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 4px 20px var(--shadow-color);
  padding: 8px 0;
  animation: dropdownAppear 0.2s ease;
  z-index: 1000;

  &::before {
    content: '';
    position: absolute;
    top: -4px;
    right: 24px;
    width: 8px;
    height: 8px;
    background: var(--bg-secondary);
    transform: rotate(45deg);
  }
}

// 菜单分组样式
.menu-section {
  padding: 8px 0;

  .section-title {
    padding: 0 16px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }
}

// 菜单项样式
.menu-item {
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--hover-bg);
  }

  &.active {
    color: #007AFF;
  }

  .check-mark {
    color: #007AFF;
    font-weight: bold;
  }
}

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 4px 0;
}

.toggle-switch {
  position: relative;
  width: 36px;
  height: 20px;
  background: var(--input-bg);
  border-radius: 10px;
  transition: all 0.3s ease;

  .switch-handle {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--text-secondary);
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  &.switch-on {
    background: #007AFF;

    .switch-handle {
      left: 18px;
      background: white;
    }
  }
}

@keyframes dropdownAppear {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 移动端菜单样式
.mobile-menu {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  display: flex;
  
  .menu-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    animation: fadeIn 0.2s ease;
    z-index: 1;
  }

  .menu-content {
    position: absolute;
    top: 56px;
    left: 16px;
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 8px 0;
    min-width: 160px;
    max-width: calc(100vw - 32px);
    box-shadow: 0 4px 20px var(--shadow-color);
    animation: slideDown 0.2s ease;
    z-index: 2;
    
    .menu-header {
      padding: 16px;
      display: flex;
      align-items: center;
      gap: 12px;

      image {
        width: 32px;
        height: 32px;
        border-radius: 50%;
      }

      text {
        color: var(--text-primary);
        font-size: 14px;
        font-weight: 500;
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .menu-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
      cursor: pointer;
      transition: all 0.2s ease;

      .icon {
        font-size: 20px;
      }

      text {
        color: var(--text-primary);
        font-size: 15px;
      }

      &:active {
        background: var(--hover-bg);
      }

      &.logout {
        color: #ff4d4f;

        text {
          color: #ff4d4f;
        }
      }
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 头像下拉菜单样式
.avatar-dropdown {
  position: relative;
}

.avatar-menu {
  min-width: 180px;
  right: 0;

  .menu-header {
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;

    image {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      object-fit: cover;
      display: block;
    }

    text {
      color: var(--text-primary);
      font-size: 14px;
      font-weight: 500;
    }
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #ff4d4f;

    .icon {
      font-size: 16px;
    }
  }
}

// 模型下拉菜单样式
.model-dropdown {
  position: relative;

  .model-menu {
    min-width: 180px;

    .menu-section {
      .section-title {
        font-size: 12px;
        color: var(--text-secondary);
        padding: 8px 16px;
      }

      .menu-item {
        padding: 8px 16px;

        &.active {
          color: #007AFF;
          background: var(--hover-bg);
        }
      }
    }
  }
}

// 响应式适配
@media (max-width: 768px) {
  .user-avatar {
    width: 38px;
    height: 38px;
  }
}

@media screen and (max-width: 768px) {
  .header {
    &.mobile-header {
      .user-avatar {
        &:has(.avatar-placeholder) {
          width: 40px !important;
          height: 40px !important;
        }

        .avatar-placeholder {
          font-size: 13px;
        }
      }
    }
  }
}
</style> 