<template>
  <view class="register-container">
    <view class="animated-background"></view>
    <view class="register-card">
      <view class="card-header">
        <text class="title">注册账号</text>
        <text class="subtitle">加入 AI Park，开启智能对话之旅</text>
      </view>

      <view class="form-group">
        <text class="label">手机号</text>
        <view class="input-group">
          <input type="number" v-model.trim="form.phone" placeholder="请输入手机号" maxlength="11" @input="handlePhoneInput"
            @blur="validatePhone" />
          <text v-if="errors.phone" class="error-tip">{{ errors.phone }}</text>
        </view>
      </view>

      <view class="form-group">
        <text class="label">验证码</text>
        <view class="input-group verify-code">
          <input type="number" v-model.trim="form.code" placeholder="请输入验证码" maxlength="6" @blur="validateCode" />
          <button class="code-btn" :class="{ 'disabled': !canSendCode || countdown > 0 }"
            :disabled="!canSendCode || countdown > 0" @click="handleSendCode">
            {{ countdown > 0 ? `${countdown}秒后重试` : '获取验证码' }}
          </button>
          <text v-if="errors.code" class="error-tip">{{ errors.code }}</text>
        </view>
      </view>

      <view class="form-group">
        <text class="label">设置密码</text>
        <view class="input-group">
          <input :type="showPassword ? 'text' : 'password'" v-model.trim="form.password" placeholder="请设置登录密码"
            maxlength="20" @blur="validatePassword" />
          <image class="toggle-password"
            :src="showPassword ? '/static/icons/eye.svg' : '/static/icons/eye-slash-fill.svg'"
            @click="showPassword = !showPassword" mode="aspectFit" />
          <text v-if="errors.password" class="error-tip">{{ errors.password }}</text>
        </view>
      </view>

      <button class="submit-btn" :disabled="!isFormValid || isLoading" @click="handleRegister">
        <text v-if="!isLoading" class="btn-text">注 册</text>
        <view v-else class="loading-spinner"></view>
      </button>

      <view class="login-link">
        已有账号？<text @click="handleLogin">立即登录</text>
      </view>
    </view>
  </view>
</template>

<script>
import { userApi } from '@/api/user'

export default {
  data() {
    return {
      form: {
        phone: '',
        code: '',
        password: ''
      },
      showPassword: false,
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
    isFormValid() {
      return this.canSendCode &&
        this.form.code &&
        this.form.code.length === 6 &&
        this.form.password &&
        this.form.password.length >= 6;
    }
  },
  methods: {
    handlePhoneInput(e) {
      let value = e.target.value.replace(/\D/g, '');
      if (value.length > 11) {
        value = value.slice(0, 11);
      }
      this.form.phone = value;
      this.validatePhone();
    },
    async handleSendCode() {
      if (!this.canSendCode || this.countdown > 0) return;

      try {
        const response = await userApi.sendCode(this.form.phone);

        // 验证码发送成功
        if (response.success) {
          this.startCountdown();
          uni.showToast({
            title: response.message || '验证码已发送',
            icon: 'none',
            duration: 2000
          });
        }
      } catch (error) {
        // 处理具体的错误情况
        let errorMessage = '发送验证码失败，请稍后重试';

        // 针对特定错误提供友好提示
        if (error.message === '该手机号已注册') {
          errorMessage = '该手机号已注册，请直接登录';
          // 更新表单错误提示
          this.errors.phone = '该手机号已注册';
        }

        uni.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        });

        console.error('发送验证码失败:', error);
      }
    },

    startCountdown() {
      this.countdown = 60;
      if (this.timer) clearInterval(this.timer);

      this.timer = setInterval(() => {
        if (this.countdown > 0) {
          this.countdown--;
        } else {
          clearInterval(this.timer);
          this.timer = null;
        }
      }, 1000);
    },

    async handleRegister() {
      // 表单验证
      const isPhoneValid = this.validatePhone();
      const isCodeValid = this.validateCode();
      const isPasswordValid = this.validatePassword();

      if (!isPhoneValid || !isCodeValid || !isPasswordValid) {
        return;
      }

      if (!this.isFormValid || this.isLoading) return;

      this.isLoading = true;
      try {
        const res = await userApi.register(this.form);
        const registeredPhone = this.form.phone; // 保存手机号

        uni.showToast({
          title: res.message || '注册成功',
          icon: 'success',
          duration: 1500
        });

        // 简化跳转逻辑
        setTimeout(() => {
          uni.navigateBack({
            delta: 1,
            success: () => {
              // 使用setTimeout确保页面已完全返回
              setTimeout(() => {
                uni.$emit('showLoginWithPhone', registeredPhone);
              }, 300);
            }
          });
        }, 1500);
      } catch (error) {
        console.error('注册失败:', error);
      } finally {
        this.isLoading = false;
      }
    },
    handleLogin() {
      // 跳转到首页
      uni.navigateBack({
        delta: 1,
        success: () => {
          // 使用setTimeout确保页面已完全返回
          setTimeout(() => {
            // 触发显示登录弹窗事件，不传手机号参数
            uni.$emit('showLoginWithPhone', '');
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
.register-container {
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

.register-card {
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

.form-group {
  margin-bottom: 32px;

  .label {
    display: block;
    font-size: 16px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }
}

.input-group {
  position: relative;
  width: 100%;
  margin-bottom: 16px;
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
  }

  .error-tip {
    position: absolute;
    left: 0;
    bottom: -20px;
    font-size: 12px;
    color: #ff4d4f;
    transition: all 0.3s ease;
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

      &:disabled {
        background: var(--border-color);
        cursor: not-allowed;
        opacity: 0.7;
      }

      &:not(:disabled):hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
      }

      &:not(:disabled):active {
        transform: translateY(0);
      }
    }

    .error-tip {
      bottom: -20px;
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
  display: flex;
  align-items: center;
  justify-content: center;

  .btn-text {
    color: white !important;
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: var(--border-color);
  }

  &:not(:disabled) {
    background: linear-gradient(135deg, #007AFF, #00C6FF);

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(0, 122, 255, 0.2);
    }
  }
}

.login-link {
  text-align: center;
  margin-top: 32px;
  font-size: 16px;
  color: var(--text-secondary);

  text {
    color: #007AFF;
    cursor: pointer;
    margin-left: 4px;
    font-weight: 500;

    &:hover {
      text-decoration: underline;
      opacity: 0.9;
    }
  }
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  box-sizing: border-box;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

@media (max-width: 768px) {
  .register-card {
    width: calc(100% - 32px);
    padding: 32px 24px;
    margin: 0 16px;
  }

  .card-header {
    .title {
      font-size: 28px;
    }
  }

  .input-group {
    input {
      height: 48px;
    }

    &.verify-code {
      .code-btn {
        height: 48px;
        width: 120px;
      }
    }
  }
}

@media screen and (max-width: 768px) {

  .register-container,
  .forget-container {
    padding: 0;
    background: var(--bg-secondary);

    .animated-background {
      opacity: 0.3;
    }
  }

  .register-card,
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

    .login-link,
    .back-link {
      margin-bottom: 20px;
      font-size: 13px;
    }
  }
}

// 针对更小屏幕的优化
@media screen and (max-width: 320px) {

  .register-card,
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

  .register-card,
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

@media screen and (max-width: 768px) {

  .register-container,
  .forget-container {
    padding: 0;
    background: var(--bg-secondary);

    .animated-background {
      opacity: 0.3;
    }
  }

  .register-card,
  .forget-card {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 24px 16px;
    border-radius: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;

    .card-header {
      margin-bottom: 32px;
      padding-top: 40px;

      .title {
        font-size: 28px;
      }

      .subtitle {
        font-size: 14px;
        opacity: 0.8;
      }
    }

    .form-group {
      margin-bottom: 24px;

      .label {
        font-size: 15px;
        margin-bottom: 8px;
      }

      .input-group {
        input {
          height: 48px;
          font-size: 15px;
        }

        &.verify-code {
          gap: 10px;

          .code-btn {
            width: 110px;
            height: 48px;
            font-size: 14px;
          }
        }

        .toggle-password {
          width: 24px;
          height: 24px;
          right: 12px;
        }
      }
    }

    .submit-btn {
      height: 48px;
      font-size: 16px;
      margin-top: auto;
      margin-bottom: 32px;
    }

    .login-link,
    .back-link {
      margin-bottom: 24px;
      font-size: 14px;
    }
  }
}

// iPhone 安全区适配
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  @media screen and (max-width: 768px) {

    .register-card,
    .forget-card {
      padding-bottom: calc(24px + env(safe-area-inset-bottom));
    }
  }
}

// 横屏适配
@media screen and (max-width: 768px) and (orientation: landscape) {

  .register-card,
  .forget-card {
    min-height: auto;
    padding: 24px;
    margin: 0;
    border-radius: 0;

    .card-header {
      padding-top: 20px;
      margin-bottom: 24px;
    }

    .submit-btn {
      margin: 32px 0;
    }
  }
}

.code-btn {

  &.disabled {
    background: var(--border-color) !important;
    cursor: not-allowed !important;
    opacity: 0.7 !important;
    transform: none !important;
    box-shadow: none !important;

    &:hover {
      transform: none !important;
      box-shadow: none !important;
    }
  }
}
</style>
