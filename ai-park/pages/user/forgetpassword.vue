<template>
  <view class="forget-container">
    <view class="animated-background"></view>
    <view class="forget-card">
      <view class="card-header">
        <text class="title">重置密码</text>
        <text class="subtitle">请输入您的手机号以重置密码</text>
      </view>

      <view class="form-group">
        <text class="label">手机号</text>
        <view class="input-group">
          <input type="number" v-model="form.phone" placeholder="请输入手机号" maxlength="11" @input="handlePhoneInput"
            @blur="validatePhone" />
          <text v-if="errors.phone" class="error-tip">{{ errors.phone }}</text>
        </view>
      </view>

      <view class="form-group">
        <text class="label">验证码</text>
        <view class="input-group verify-code">
          <input type="number" v-model="form.code" placeholder="请输入验证码" maxlength="6" @blur="validateCode" />
          <button class="code-btn" :class="{ 'disabled': !canSendCode || countdown > 0 }"
            :disabled="!canSendCode || countdown > 0" @click="handleSendCode">
            {{ countdown > 0 ? `${countdown}秒后重试` : '获取验证码' }}
          </button>
          <text v-if="errors.code" class="error-tip">{{ errors.code }}</text>
        </view>
      </view>

      <view class="form-group">
        <text class="label">新密码</text>
        <view class="input-group">
          <input :type="showPassword ? 'text' : 'password'" v-model="form.password" placeholder="请输入新密码" maxlength="20"
            @blur="validatePassword" />
          <image class="toggle-password"
            :src="showPassword ? '/static/icons/eye.svg' : '/static/icons/eye-slash-fill.svg'"
            @click="showPassword = !showPassword" mode="aspectFit" />
          <text v-if="errors.password" class="error-tip">{{ errors.password }}</text>
        </view>
      </view>

      <view class="form-group">
        <text class="label">确认密码</text>
        <view class="input-group">
          <input :type="showConfirmPassword ? 'text' : 'password'" v-model.trim="form.confirmPassword"
            placeholder="请再次输入密码" maxlength="20" />
          <image class="toggle-password"
            :src="showConfirmPassword ? '/static/icons/eye.svg' : '/static/icons/eye-slash-fill.svg'"
            @click="showConfirmPassword = !showConfirmPassword" mode="aspectFit" />
        </view>
        <!-- 密码不匹配提示 -->
        <text v-if="showPasswordMismatch" class="error-tip">两次输入的密码不一致</text>
      </view>

      <button class="submit-btn" :disabled="!isFormValid || isLoading" @click="handleSubmit">
        <text v-if="!isLoading">确认重置</text>
        <view v-else class="loading-spinner"></view>
      </button>

      <view class="back-link">
        <text @click="handleBack">返回登录</text>
      </view>
    </view>
  </view>
</template>

<script>
import { userApi } from '@/api/user'  // 添加这行导入语句

export default {
  data() {
    return {
      form: {
        phone: '',
        code: '',
        password: '',
        confirmPassword: ''
      },
      showPassword: false,
      showConfirmPassword: false,
      isLoading: false,
      countdown: 0,
      timer: null,
      errors: {
        phone: '',
        code: '',
        password: ''
      }
    }
  },
  computed: {
    canSendCode() {
      return this.form.phone && /^1[3-9]\d{9}$/.test(this.form.phone);
    },
    showPasswordMismatch() {
      return this.form.confirmPassword &&
        this.form.password !== this.form.confirmPassword;
    },
    isFormValid() {
      return this.canSendCode &&
        this.form.code &&
        this.form.code.length === 6 &&
        this.form.password &&
        this.form.password.length >= 6 &&
        this.form.password === this.form.confirmPassword;
    }
  },
  methods: {
    // 修改handlePhoneInput方法
    handlePhoneInput(e) {
      // 检查e.detail是否存在（兼容不同平台）
      let value = '';
      if (e.detail && e.detail.value !== undefined) {
        value = e.detail.value;
      } else if (e.target && e.target.value !== undefined) {
        value = e.target.value;
      } else {
        value = e || '';
      }

      // 处理输入值
      value = String(value).replace(/\D/g, '');
      if (value.length > 11) {
        value = value.slice(0, 11);
      }
      this.form.phone = value;
      this.validatePhone();
    },
    async handleSendCode() {
      if (!this.canSendCode || this.countdown > 0) return;

      try {
        // 验证码类型3(重置密码)
        const response = await userApi.sendCode(this.form.phone, 3);

        // 检查response.success
        if (response && response.success) {
          // 只有真正成功才开始倒计时
          this.startCountdown();
          uni.showToast({
            title: '验证码已发送',
            icon: 'none'
          });
        } else {
          // 如果success为false但有返回消息
          throw new Error(response.message || '发送验证码失败');
        }
      } catch (error) {
        let errorMessage = error.message;

        // 针对特定错误显示友好提示
        if (error.message === '该手机号未注册') {
          errorMessage = '请检查手机号输入是否正确';
          this.errors.phone = '请检查手机号输入是否正确';
        }

        uni.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        });
      }
    },

    startCountdown() {
      // 开始倒计时前清除可能存在的计时器
      if (this.timer) {
        clearInterval(this.timer);
      }
      this.countdown = 60;
      this.timer = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          clearInterval(this.timer);
          this.timer = null;
        }
      }, 1000);
    },
    async handleSubmit() {
      if (!this.isFormValid || this.isLoading) return;

      this.isLoading = true;
      try {
        const response = await userApi.resetPassword({
          phone: this.form.phone,
          verification_code: this.form.code,
          new_password: this.form.password
        });

        if (response.success) {
          uni.showToast({
            title: '密码重置成功',
            icon: 'success'
          });

          // 先设置标记
          uni.setStorageSync('needShowLogin', true);

          // 延迟跳转到首页并确保登录弹窗显示
          setTimeout(() => {
            uni.reLaunch({
              url: '/pages/index/index',
              success: () => {
                // 确保页面加载完成后再显示登录弹窗
                setTimeout(() => {
                  uni.$emit('showLogin');
                }, 300);
              }
            });
          }, 1000);
        }
      } catch (error) {
        console.error('重置密码失败:', error);
        let errorMessage = '重置失败，请重试';
        
        // 针对特定错误提供更清晰的提示
        if (error.message?.includes('验证码')) {
          errorMessage = '验证码无效或已过期';
          this.errors.code = '验证码无效或已过期';
        }
        
        uni.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        });
      } finally {
        this.isLoading = false;
      }
    },
    handleBack() {
      // 先跳转到首页
      uni.reLaunch({
        url: '/pages/index/index',
        success: () => {
          // 在跳转成功的回调中设置标记并触发登录弹窗
          setTimeout(() => {
            uni.setStorageSync('needShowLogin', true);
            uni.$emit('showLogin');
          }, 300);
        }
      });
    },
    validatePhone() {
      if (!this.form.phone) {
        this.errors.phone = '请输入手机号';
        return false;
      }
      if (!/^1[3-9]\d{9}$/.test(this.form.phone)) {
        this.errors.phone = '请输入正确的手机号';
        return false;
      }
      this.errors.phone = '';
      return true;
    },

    validateCode() {
      if (!this.form.code) {
        this.errors.code = '请输入验证码';
        return false;
      }
      if (this.form.code.length !== 6) {
        this.errors.code = '验证码必须是6位数字';
        return false;
      }
      this.errors.code = '';
      return true;
    },

    validatePassword() {
      if (!this.form.password) {
        this.errors.password = '请输入密码';
        return false;
      }
      if (this.form.password.length < 6) {
        this.errors.password = '密码长度不能少于6位';
        return false;
      }
      this.errors.password = '';
      return true;
    }
  },
  beforeDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
</script>

<style lang="scss" scoped>
.forget-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background: linear-gradient(135deg, #f5f7fa, #edf1f7);
}

.animated-background {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(135deg,
      #ff9a9e 0%,
      #fad0c4 25%,
      #fad0c4 25%,
      #a1c4fd 50%,
      #c2e9fb 75%,
      #fff1eb 100%);
  animation: gradientAnimation 15s ease infinite;
  z-index: -1;
  opacity: 0.5;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    backdrop-filter: blur(100px);
  }
}

.forget-card {
  width: calc(100% - 40px);
  max-width: 480px;
  padding: 40px;
  margin: 0 20px;
  background: rgba(var(--bg-secondary-rgb), 0.8);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  box-shadow: 0 8px 32px var(--shadow-color);
  animation: slideUpFade 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  box-sizing: border-box;

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

.card-header {
  text-align: center;
  margin-bottom: 40px;

  .title {
    font-size: 32px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 16px;
    display: block;
    background: linear-gradient(135deg, #007AFF, #00C6FF);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 16px;
    color: var(--text-secondary);
  }
}

// 复用 register.vue 的表单样式
.form-group {
  margin-bottom: 28px;

  .label {
    display: block;
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .error-tip {
    font-size: 14px;
    color: #ff4d4f;
    margin-top: 8px;
    padding-left: 2px;
    display: block;
    animation: fadeIn 0.3s ease;
  }
}

.input-group {
  position: relative;
  width: 100%;
  box-sizing: border-box;

  input {
    width: 100%;
    height: 52px;
    padding: 0 20px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    font-size: 16px;
    color: var(--text-primary);
    background: var(--input-bg);
    transition: all 0.3s ease;
    box-sizing: border-box;

    &:focus {
      border-color: #007AFF;
      box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    &::placeholder {
      color: var(--text-secondary);
      font-size: 15px;
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

  &.verify-code {
    display: flex;
    gap: 16px;

    input {
      flex: 1;
      min-width: 0;
    }

    .code-btn {
      width: 140px;
      flex-shrink: 0;
      height: 52px;
      border: none;
      border-radius: 8px;
      background: linear-gradient(135deg, #007AFF, #00C6FF);
      color: white;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      padding: 0;

      &:disabled,
      &.disabled {
        background: var(--border-color) !important;
        color: var(--text-secondary) !important;
        opacity: 0.7 !important;
        cursor: not-allowed !important;
        transform: none !important;
        box-shadow: none !important;

        &:hover {
          transform: none !important;
          box-shadow: none !important;
        }
      }

      &:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
      }

      &:not(:disabled):active {
        transform: translateY(0);
      }
    }
  }

  .toggle-password {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    cursor: pointer;
    opacity: 0.6;
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

.submit-btn {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #007AFF, #00C6FF);
  color: white;
  font-size: 18px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-top: 40px;

  text {
    color: white !important;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: var(--border-color);
  }

  &:not(:disabled):hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
  }

  &:not(:disabled):active {
    transform: translateY(0);
    box-shadow: 0 2px 6px rgba(0, 122, 255, 0.2);
  }
}

.back-link {
  text-align: center;
  margin-top: 32px;
  font-size: 16px;
  color: var(--text-secondary);

  text {
    color: #007AFF;
    cursor: pointer;
    font-weight: 500;
    margin-left: 4px;

    &:hover {
      text-decoration: underline;
      opacity: 0.9;
    }
  }
}

.error-tip {
  font-size: 14px;
  color: #ff4d4f;
  margin-top: 8px;
  margin-left: 2px;
  animation: fadeIn 0.3s ease;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border-width: 3px;
}

@keyframes gradientAnimation {
  0% {
    transform: rotate(0deg);
  }

  50% {
    transform: rotate(180deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

@keyframes slideUpFade {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
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

@media (max-width: 768px) {
  .forget-card {
    width: calc(100% - 32px);
    padding: 24px 20px;
    margin: 0 16px;
    border-radius: 12px;
  }

  .card-header {
    margin-bottom: 24px;

    .title {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .subtitle {
      font-size: 14px;
    }
  }

  .form-group {
    margin-bottom: 20px;

    .label {
      font-size: 14px;
      margin-bottom: 8px;
    }
  }

  .input-group {
    input {
      height: 46px;
      font-size: 15px;
      padding: 0 16px;

      &::placeholder {
        font-size: 14px;
      }
    }

    &.verify-code {
      gap: 10px;

      .code-btn {
        width: 110px;
        height: 46px;
        font-size: 14px;
      }
    }

    .toggle-password {
      width: 24px;
      height: 24px;
      right: 12px;
    }
  }

  .submit-btn {
    height: 46px;
    font-size: 16px;
    margin-top: 32px;
  }

  .back-link {
    margin-top: 24px;
    font-size: 14px;
  }

  .error-tip {
    font-size: 13px;
    margin-top: 6px;
  }
}

// 针对更小屏幕的优化
@media (max-width: 360px) {
  .forget-card {
    padding: 20px 16px;
  }

  .input-group {
    &.verify-code {
      .code-btn {
        width: 100px;
        font-size: 13px;
      }
    }
  }
}

// 添加安全区域适配
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  .forget-container {
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }
}

// 优化横屏显示
@media (max-height: 500px) {
  .forget-container {
    align-items: flex-start;
    padding-top: 40px;
  }

  .forget-card {
    margin-top: 0;
  }
}

// 移动端适配
@media screen and (max-width: 768px) {

  .forget-container,
  .forget-container {
    padding: 0;
    background: var(--bg-secondary);

    .animated-background {
      opacity: 0.3;
    }
  }

  .forget-card {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 20px 16px;
    border-radius: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;

    .card-header {
      margin-bottom: 24px;
      padding-top: 32px;

      .title {
        font-size: 24px;
      }

      .subtitle {
        font-size: 13px;
      }
    }

    .form-group {
      margin-bottom: 20px;

      .label {
        font-size: 14px;
        margin-bottom: 6px;
      }

      .input-group {
        input {
          height: 44px;
          font-size: 14px;
          padding: 0 14px;
        }

        &.verify-code {
          gap: 8px;

          .code-btn {
            width: 100px;
            height: 44px;
            font-size: 13px;
          }
        }

        .toggle-password {
          width: 22px;
          height: 22px;
          right: 10px;
        }
      }
    }

    .submit-btn {
      height: 44px;
      font-size: 15px;
      margin-top: auto;
      margin-bottom: 24px;
    }

    .back-link {
      margin-bottom: 20px;
      font-size: 13px;
    }
  }
}

// 针对更小屏幕的优化
@media screen and (max-width: 320px) {
  .forget-card {
    padding: 16px 12px;

    .card-header {
      .title {
        font-size: 22px;
      }
    }

    .input-group {
      &.verify-code {
        .code-btn {
          width: 90px;
          font-size: 12px;
        }
      }
    }
  }
}

// 优化横屏显示
@media screen and (max-width: 768px) and (orientation: landscape) {
  .forget-card {
    min-height: auto;
    margin: 10px 0;

    .card-header {
      padding-top: 16px;
      margin-bottom: 20px;
    }

    .submit-btn {
      margin: 24px 0;
    }
  }
}

// iPhone 安全区适配
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  @media screen and (max-width: 768px) {
    .forget-card {
      padding-bottom: calc(24px + env(safe-area-inset-bottom));
    }
  }
}
</style>
