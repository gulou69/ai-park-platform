<template>
  <view class="login-popup">
    <view class="popup-overlay" @click="$emit('close')" />
    <view class="popup-content">
      <view class="popup-header">
        <text class="title">登录 AI Park</text>
        <text class="subtitle">开启智能对话之旅</text>
        <button class="close-btn" @click="$emit('close')">×</button>
      </view>

      <view class="input-fields">
        <view class="field-group">
          <text class="field-label">手机号</text>
          <input 
            type="number" 
            class="field-input" 
            v-model="phone" 
            placeholder="请输入手机号" 
            maxlength="11"
            @input="onPhoneInput" 
          />
          <text v-if="errors.phone" class="error-message">{{ errors.phone }}</text>
        </view>

        <view class="field-group">
          <text class="field-label">密码</text>
          <view class="password-input">
            <input 
              :type="showPassword ? 'text' : 'password'" 
              class="field-input" 
              v-model="password" 
              placeholder="请输入密码" 
              maxlength="20"
              @input="onPasswordInput" 
            />
            <image 
              class="toggle-password" 
              :src="showPassword ? '/static/icons/eye.svg' : '/static/icons/eye-slash-fill.svg'" 
              @click="togglePasswordVisibility" 
              mode="aspectFit"
            />
          </view>
          <text v-if="errors.password" class="error-message">{{ errors.password }}</text>
        </view>

        <view class="options">
          <view class="remember-wrapper">
            <checkbox-group @change="rememberChanged">
              <label>
                <checkbox :checked="remember" color="#007AFF" />
                <text>记住登录</text>
              </label>
            </checkbox-group>
          </view>
          <text class="forget-password" @click="goToForgetPassword">忘记密码?</text>
        </view>

        <button class="btn-login" :class="{'is-loading': loading}" @click="handlePhoneLogin" :disabled="loading">
          <text v-if="!loading">登录</text>
          <view v-else class="loading-spinner"></view>
        </button>
      </view>

      <view class="register-link">
        还没有账号？<text @click="goToRegister">立即注册</text>
      </view>
    </view>
  </view>
</template>

<script>
import { userApi } from '@/api/user'

export default {
  name: 'LoginPopUp',
  props: {
    initialPhone: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      phone: '',
      password: '',
      remember: false,
      showPassword: false,
      loading: false,
      errors: {
        phone: '',
        password: ''
      }
    }
  },
  created() {
    this.phone = this.initialPhone || '';
    
    // 检查是否有保存的登录信息
    const savedLoginInfo = uni.getStorageSync('savedLoginInfo');
    if (savedLoginInfo) {
      this.phone = savedLoginInfo.phone || '';
      this.remember = true;
    }
  },
  methods: {
    onPhoneInput(e) {
      // 确保只输入数字
      let value = String(this.phone).replace(/\D/g, '');
      if (value.length > 11) {
        value = value.slice(0, 11);
      }
      this.phone = value;
      this.validatePhone();
    },

    onPasswordInput(e) {
      this.validatePassword();
    },

    validatePhone() {
      if (!this.phone) {
        this.errors.phone = '请输入手机号';
        return false;
      }
      if (!/^1[3-9]\d{9}$/.test(this.phone)) {
        this.errors.phone = '请输入正确的手机号';
        return false;
      }
      this.errors.phone = '';
      return true;
    },

    validatePassword() {
      if (!this.password) {
        this.errors.password = '请输入密码';
        return false;
      }
      if (this.password.length < 6) {
        this.errors.password = '密码长度不能少于6位';
        return false;
      }
      this.errors.password = '';
      return true;
    },

    validateInputs() {
      const isPhoneValid = this.validatePhone();
      const isPasswordValid = this.validatePassword();
      
      return isPhoneValid && isPasswordValid;
    },

    async handlePhoneLogin() {
      if (!this.validateInputs() || this.loading) {
        return;
      }
      
      this.loading = true;
      
      try {
        const response = await userApi.login({
          phone: this.phone,
          password: this.password,
          remember: this.remember
        });
        
        if (response.success) {
          this.handleLoginSuccess(response);
        } else {
          uni.showToast({
            title: response.message || '登录失败',
            icon: 'none',
            duration: 2000
          });
        }
      } catch (error) {
        let errorMessage = '登录失败，请稍后再试';
        
        if (error.message === '密码错误') {
          errorMessage = '密码错误';
          this.errors.password = '密码错误';
        } else if (error.message === '用户不存在') {
          errorMessage = '用户不存在';
          this.errors.phone = '用户不存在';
        }
        
        uni.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        });
      } finally {
        this.loading = false;
      }
    },

    // 处理登录成功
    async handleLoginSuccess(response) {
      // 确保登录状态全局同步
      uni.setStorageSync('token', response.data.token);
      uni.setStorageSync('userInfo', response.data.user);
      uni.setStorageSync('isLoggedIn', true);
      
      // 发出全局事件通知
      uni.$emit('user-logged-in', response.data.user);
      uni.$emit('login-success', response.data.user);
      
      // 显示成功提示
      uni.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });
      
      // 关闭弹窗前先确保状态已更新
      setTimeout(() => {
        // 明确告知父组件登录成功并传递用户信息
        this.$emit('login-success', response.data.user);
        this.$emit('close');
      }, 500);
    },

    togglePasswordVisibility() {
      this.showPassword = !this.showPassword;
    },
    
    rememberChanged(e) {
      this.remember = e.detail.value.length > 0;
    },
    
    goToRegister() {
      this.$emit('close');
      uni.navigateTo({
        url: '/pages/user/register'
      });
    },
    
    goToForgetPassword() {
      this.$emit('close');
      uni.navigateTo({
        url: '/pages/user/forgetpassword'
      });
    }
  }
}
</script>

<style lang="scss" scoped>
// 弹窗基础容器
.login-popup {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  box-sizing: border-box;
  /* 桌面端默认设置 */
  padding: 20px;
  /* 确保在所有情况下都能正确居中 */
  overflow: hidden;
}

// 弹窗遮罩层
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  animation: fadeIn 0.3s ease;
  z-index: -1;
}

// 弹窗内容区域
.popup-content {
  position: relative;
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 32px 40px;
  box-shadow: 0 8px 32px var(--shadow-color);
  animation: slideUpFade 0.3s ease;
  box-sizing: border-box;
  overflow-y: auto;
  /* 确保内容不会被遮挡 */
  z-index: 1;
  
  /* 桌面端默认设置 - 固定尺寸确保一致性 */
  width: 460px;
  max-width: 460px;
  min-width: 460px;
  max-height: min(550px, calc(100vh - 120px)) !important;
  /* 确保弹窗不会超出视窗 */
  margin: auto;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: linear-gradient(90deg, #007AFF, #00C6FF);
  }
}

.popup-header {
  text-align: center;
  margin-bottom: 32px;
  position: relative;

  .title {
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 8px;
    display: block;
  }

  .subtitle {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .close-btn {
    position: absolute;
    top: -16px;
    right: -16px;
    width: 32px;
    height: 32px;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    .close-icon {
      font-size: 24px;
      color: var(--text-secondary);
      transition: all 0.2s ease;
    }

    &:hover .close-icon {
      color: var(--text-primary);
      transform: rotate(90deg);
    }
  }
}

// 表单字段容器
.input-fields {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 100%;
  box-sizing: border-box;
}

// 输入框样式
.field-group {
  margin-bottom: 24px;
  position: relative;

  .field-label {
    display: block;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 8px;
  }

  .field-input {
    width: 100%;
    height: 48px;
    padding: 0 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 15px;
    color: var(--text-primary);
    background: var(--input-bg);
    transition: all 0.3s ease;
    box-sizing: border-box;

    &:focus {
      border-color: #007AFF;
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    &::placeholder {
      color: var(--text-placeholder);
      font-size: 14px;
    }

    &[type="number"] {
      -moz-appearance: textfield;

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }

  .error-message {
    position: absolute;
    left: 0;
    top: 100%;
    font-size: 12px;
    color: #ff4d4f;
    margin-top: 4px;
    animation: fadeIn 0.3s;
  }

  .password-wrapper {
    position: relative;

    .toggle-password {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      width: 24px;
      height: 24px;
      opacity: 0.6;
      cursor: pointer;
      transition: opacity 0.2s;

      &:hover {
        opacity: 1;
      }
    }

    .field-input {
      padding-right: 44px;
    }
  }
}

// 输入框组样式
.input-group {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16px;

  .input-label {
    display: block;
    font-size: 14px;
    color: var(--text-secondary);
    margin-bottom: 8px;
    margin-left: 2px;
  }

  .input {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 15px;
    color: var(--text-primary);
    background: var(--input-bg);
    transition: all 0.3s ease;
    display: block;
    -webkit-appearance: none;
    line-height: normal;
    box-sizing: border-box;
    max-width: 100%;

    &:focus {
      border-color: #007AFF;
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    &::placeholder {
      color: var(--text-secondary);
      font-size: 13px;
    }

    &[type="number"] {
      -moz-appearance: textfield;

      &::-webkit-outer-spin-button,
      &::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
    }
  }

  .error-tip {
    color: #ff4d4f;
    font-size: 12px;
    margin-top: 4px;
    display: block;
    transition: all 0.3s ease;
    animation: fadeIn 0.3s ease;
  }
}

// 密码输入框特殊样式
.password-input {
  width: 100%;
  display: flex;
  align-items: center;
  position: relative;

  .input {
    flex: 1;
    padding-right: 40px;
    box-sizing: border-box;
  }

  .toggle-password {
    width: 24px;
    height: 24px;
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    cursor: pointer;
    opacity: 0.6;
    padding: 2px;
    transition: all 0.2s ease;
    filter: var(--icon-filter);

    &:hover {
      opacity: 1;
      transform: translateY(-50%) scale(1.1);
    }

    &:active {
      transform: translateY(-50%) scale(0.95);
    }
  }
}

// 记住登录和忘记密码选项
.options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 0 24px;
  width: 100%;

  .remember-wrapper {
    .remember {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;

      checkbox {
        transform: scale(0.9);
      }

      text {
        font-size: 14px;
        color: var(--text-secondary);
      }
    }
  }

  .forget-password {
    font-size: 14px;
    color: #007AFF;
    cursor: pointer;
    transition: all 0.2s ease;
    margin-left: auto;

    &:hover {
      color: #0056b3;
      text-decoration: underline;
    }
  }
}

.btn-login {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #007AFF, #00C6FF);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  &.is-loading {
    pointer-events: none;
    opacity: 0.8;

    .btn-text {
      opacity: 0;
    }

    .loading-spinner {
      position: absolute;
    }
  }

  &:active {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: var(--border-color);
  }
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 登录按钮样式
.login-btn {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #007AFF, #00C6FF);
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  text {
    color: #fff;
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  &.loading {
    cursor: wait;
  }
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}

// 分隔线样式
.divider {
  margin: 24px 0;

  text {
    padding: 0 12px;
    font-size: 14px;
  }
}

.social-login {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
}

.social-btn {
  flex: 1;
  height: 44px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  image {
    width: 20px;
    height: 20px;
  }

  text {
    font-size: 14px;
    color: var(--text-primary);
  }

  &:hover {
    background: var(--hover-bg);
    border-color: var(--text-secondary);
  }
}

// 注册链接样式
.register-link {
  text-align: center;
  font-size: 14px;
  color: var(--text-secondary);

  text {
    color: #007AFF;
    cursor: pointer;
    margin-left: 4px;

    &:hover {
      text-decoration: underline;
    }
  }
}

// 动画效果
@keyframes fadeIn {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 响应式适配
@media (max-width: 768px) {
  .login-popup {
    /* 移动端重新设置padding和安全区域 */
    padding: 16px;
    /* 移动端添加安全区域支持 */
    padding-top: max(16px, constant(safe-area-inset-top));
    padding-top: max(16px, env(safe-area-inset-top));
    padding-bottom: max(16px, constant(safe-area-inset-bottom));
    padding-bottom: max(16px, env(safe-area-inset-bottom));
    padding-left: max(16px, constant(safe-area-inset-left));
    padding-left: max(16px, env(safe-area-inset-left));
    padding-right: max(16px, constant(safe-area-inset-right));
    padding-right: max(16px, env(safe-area-inset-right));
    /* 移动端使用flex布局确保居中 */
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
  }

  .popup-content {
    /* 移动端重新设置尺寸 */
    width: 100%;
    min-width: 280px;
    max-width: 400px;
    max-height: calc(100vh - 32px - constant(safe-area-inset-top) - constant(safe-area-inset-bottom));
    max-height: calc(100vh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    padding: 24px 20px;
    margin: 0;
    /* 确保弹窗在小屏幕上可滚动 */
    overflow-y: auto;
    /* 移动端使用更小的圆角 */
    border-radius: 12px;
  }

  .popup-header {
    margin-bottom: 24px;
    
    .title {
      font-size: 20px;
    }
    
    .subtitle {
      font-size: 13px;
    }
  }

  .field-group {
    margin-bottom: 20px;
    
    .field-input {
      height: 44px;
      font-size: 16px; /* 防止iOS放大输入框 */
    }
  }
}

/* 针对非常小的高度屏幕（如横屏手机）的额外适配 */
@media (max-height: 600px) {
  .login-popup {
    padding: 10px;
    align-items: flex-start;
    padding-top: 20px;
  }

  .popup-content {
    max-height: calc(100vh - 20px);
    padding: 20px 16px;
    
    .popup-header {
      margin-bottom: 16px;
      
      .title {
        font-size: 18px;
        margin-bottom: 4px;
      }
      
      .subtitle {
        font-size: 12px;
      }
    }
    
    .field-group {
      margin-bottom: 16px;
      
      .field-input {
        height: 40px;
      }
    }
    
    .options {
      margin: 12px 0 16px;
    }
  }
}

.wechat-btn {
  width: 100%;
  height: 44px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #07C160;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  image {
    width: 24px;
    height: 24px;
    filter: brightness(0) invert(1);
  }

  &:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}

/* 桌面端专用样式优化 - 确保正确定位 */
@media screen and (min-width: 769px) {
  .login-popup {
    /* 强制桌面端正确的视窗单位和定位 */
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 1000 !important;
    padding: 40px !important;
    overflow: hidden !important;
    box-sizing: border-box !important;
    
    /* 清除移动端的安全区域设置 */
    padding-top: 40px !important;
    padding-bottom: 40px !important;
    padding-left: 40px !important;
    padding-right: 40px !important;
  }

  .popup-overlay {
    /* 确保遮罩层完全覆盖屏幕 */
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: -1 !important;
  }

  .popup-content {
    /* 桌面端固定弹窗尺寸和居中 */
    position: relative !important;
    width: 460px !important;
    max-width: 460px !important;
    min-width: 460px !important;
    max-height: min(550px, calc(100vh - 120px)) !important;
    margin: 0 !important;
    z-index: 1 !important;
    
    /* 电脑端禁用滚动，内容应该完全适配 */
    overflow: hidden !important;
    
    /* 保持桌面端特定的样式 */
    padding: 32px 40px !important;
    border-radius: 16px !important;
    box-sizing: border-box !important;
  }

  /* 电脑端内容布局优化 */
  .popup-header {
    margin-bottom: 20px !important;
  }

  .field-group {
    margin-bottom: 18px !important;
  }

  .options {
    margin: 14px 0 18px !important;
  }

  .btn-login {
    margin-bottom: 14px !important;
  }

  .register-link {
    margin-bottom: 0 !important;
    font-size: 13px !important;
  }
}

/* 大屏幕额外优化 */
@media screen and (min-width: 1200px) {
  .login-popup {
    padding: 60px !important;
  }
  
  .popup-content {
    max-height: min(570px, calc(100vh - 120px)) !important;
  }
}
</style>
