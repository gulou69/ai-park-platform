<template>
  <view class="input-container">
    <view class="input-wrapper"> <!-- 包装层 -->
      <view class="input-area" :class="{ 'input-expanded': isExpanded, 'input-collapsing': isCollapsing, expanded: isExpanded }">
        <textarea id="message-input" ref="textarea" v-model="message" :placeholder="loginRequired ? '请先登录后发送消息...' : '输入消息...'"
          :class="{ 'textarea-expanded': isExpanded }" @focus="handleFocus" @blur="handleBlur" @keydown="handleKeyDown" maxlength="-1"
          :disabled="disabled || loginRequired" />
        <!-- 注释掉上传按钮
        <view class="upload-buttons" v-show="isExpanded">
          <button class="upload-btn file-btn" @click="$emit('upload-file')" data-tooltip="上传文件" :disabled="disabled">
            <image src="/static/icons/file-earmark-arrow-up.svg" mode="aspectFit" />
          </button>
          <button class="upload-btn image-btn" @click="$emit('upload-image')" data-tooltip="上传图片" :disabled="disabled">
            <image src="/static/icons/image.svg" mode="aspectFit" />
          </button>
        </view>
        -->
        <button class="send-btn" @click="sendMessage" :disabled="!canSend">发送</button>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'InputArea',
  props: {
    value: {
      type: String,
      default: ''
    },
    disabled: {
      type: Boolean,
      default: false
    },
    loginRequired: {
      type: Boolean,
      default: false
    }
    /* 注释掉发送键类型设置
    sendKeyType: {
      type: String,
      default: 'enter' // 'enter' 或 'ctrlEnter'
    }
    */
  },
  data() {
    return {
      isExpanded: false, // 控制输入框是否展开
      isCollapsing: false, // 控制收起动画
      message: this.value, // 输入的消息内容
      expandTimer: null, // 展开动画定时器
      collapseTimer: null // 收起动画定时器
    }
  },
  computed: {
    canSend() {
      // 修改发送按钮状态检查
      return this.message.trim() && !this.disabled && !this.loginRequired && uni.getStorageSync('isLoggedIn');
    }
  },
  watch: {
    value(newVal) {
      this.message = newVal;
    }
  },
  beforeDestroy() {
    // 清理定时器
    if (this.expandTimer) clearTimeout(this.expandTimer);
    if (this.collapseTimer) clearTimeout(this.collapseTimer);
  },
  mounted() {
    // 添加此元素已挂载的通知
    this.$nextTick(() => {
      // 触发一个自定义事件，通知父组件输入区域已挂载
      this.$emit('input-area-mounted');
    });
  },
  methods: {
    handleFocus() {
      // 添加登录状态的实时检查
      if (!uni.getStorageSync('isLoggedIn')) {
        this.$emit('login-prompt');
        return;
      }

      if (this.disabled) return;

      // 输入框获得焦点时展开
      if (this.collapseTimer) {
        clearTimeout(this.collapseTimer);
        this.collapseTimer = null;
      }
      this.isCollapsing = false;
      this.isExpanded = true;
      this.$emit('focus');
    },
    handleBlur() {
      // 输入框失去焦点且无内容时收起
      if (!this.message) {
        this.isCollapsing = true;
        // 等待收起动画完成后再真正收起
        this.collapseTimer = setTimeout(() => {
          this.isExpanded = false;
          this.isCollapsing = false;
        }, 300);
      }
      this.$emit('blur');
    },
    async sendMessage() {
      // 添加登录状态的实时检查
      if (!uni.getStorageSync('isLoggedIn')) {
        this.$emit('login-prompt');
        return;
      }

      if (!this.canSend) return;

      try {
        // 获取并保存当前消息
        const messageToSend = this.message.trim();
        console.log('准备发送消息:', messageToSend);

        // 1. 先同步到父组件
        this.$emit('input', messageToSend);
        this.$emit('update:value', messageToSend);

        // 2. 等待父组件更新完成
        await this.$nextTick();

        // 3. 触发发送事件
        this.$emit('send', messageToSend);

        // 4. 等待发送完成
        await this.$nextTick();

        // 5. 最后清空本地输入
        this.message = '';
        console.log('消息发送完成,输入框已清空');

      } catch (err) {
        console.error('发送失败:', err);
        // 保持消息不清空,方便重试
        this.message = messageToSend;
      }
    },

    handleInput(event) {
      const value = event.detail?.value || event.target?.value || '';

      // 更新本地状态
      this.message = value;

      // 同步到父组件 
      this.$emit('input', value);
      this.$emit('update:value', value);

      console.log('输入更新:', value);
    },

    // 提供给父组件的API，用于获取焦点
    focus() {
      // 在uni-app中，使用ref和uni的方法来获取焦点
      this.$nextTick(() => {
        // #ifdef H5
        if (typeof document !== 'undefined') {
          const textarea = document.querySelector('.input-area textarea');
          if (textarea && !this.disabled) {
            textarea.focus();
          }
        }
        // #endif
        
        // #ifdef APP-PLUS || MP
        // 在App端或小程序端，textarea的focus需要用uni-app的方式
        if (this.$refs.textarea) {
          uni.createSelectorQuery().in(this).select('#message-input').context((res) => {
            if (res && res.context) {
              res.context.focus();
            }
          }).exec();
        }
        // #endif
      });
    },

    // 提供给父组件的API，用于直接清空输入框
    clear() {
      this.message = '';
    },

    handleKeyDown(event) {
      // 简化键盘处理逻辑
      if (event.key === 'Enter') {
        if (event.shiftKey) {
          // Shift+Enter: 换行，不做任何处理
          return;
        } else {
          // 单独Enter: 发送消息
          event.preventDefault();
          this.sendMessage();
        }
      }
    }
  }
}
</script>

<style lang="scss" scoped>
// 输入区域容器：修改为相对定位，而不是固定定位
.input-container {
  position: relative; // 修改为相对定位
  width: 100%; // 使用完整宽度
  box-sizing: border-box;
  z-index: 10;
  background: transparent; /* 确保透明背景 */
}

// 输入区域包装器：调整最大宽度限制
.input-wrapper {
  width: 100%;
  max-width: 800px; // 限制最大宽度
  margin: 0 auto; // 居中显示
  padding: 0; // 移除内边距，由父组件控制
  position: relative;
  background: transparent; /* 确保透明背景 */
}

// 输入框主体样式
.input-area {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  gap: 10px;
  padding: 8px 12px;
  background: var(--input-bg);
  border-radius: 16px;
  box-shadow: 0 2px 12px var(--shadow-color);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom center;
  animation: appearFromBottom 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  &.input-expanded {
    padding: 12px 16px;
    background: var(--input-bg);
    align-items: flex-end; /* 展开时按钮靠底部对齐 */
    animation: expandInput 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    box-shadow: 0 4px 20px var(--shadow-color);
  }

  &.input-collapsing {
    animation: collapseInput 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--input-bg); /* 确保背景一致 */
  }

  // 文本输入框样式
  uni-textarea {
    position: relative;
    flex: 1;
    min-width: 0;
    height: auto;
    min-height: 24px;
    max-height: 200px; /* 设置最大高度 */
    margin: 0;
    padding: 8px 12px;
    border: none;
    border-radius: 12px;
    resize: none;
    outline: none;
    font-size: 14px;
    line-height: 1.5;
    background: transparent;
    color: var(--text-primary);
    box-sizing: border-box;
    overflow-y: auto;
    word-wrap: break-word;
    white-space: pre-wrap; /* 保持换行 */
    transition: all 0.3s ease;

    &::placeholder {
      color: var(--text-secondary);
      line-height: 1.4;
    }

    &.textarea-expanded {
      min-height: 80px;
      max-height: 300px;
      padding: 12px;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.7;
    }

    /* 确保滚动条样式 */
    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 2px;
    }
  }

  // 发送按钮样式
  .send-btn {
    position: relative;
    flex-shrink: 0;
    width: auto;
    height: 36px;
    padding: 0 20px;
    border: none;
    border-radius: 18px;
    background: linear-gradient(135deg, #007AFF, #00C6FF);
    color: #fff;
    font-weight: 500;
    font-size: 14px;
    line-height: 36px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 8px var(--shadow-color);
    align-self: center;
    overflow: hidden;
    white-space: nowrap;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.1);
      transform: translate(-50%, -50%) scale(0);
      border-radius: 50%;
      transition: transform 0.3s ease;
    }

    &:active::before {
      transform: translate(-50%, -50%) scale(2);
    }

    &:hover {
      background: linear-gradient(135deg, #0069D9, #00B3FF);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px var(--shadow-color);
    }

    &:active {
      transform: translateY(0px) scale(0.98);
      box-shadow: 0 2px 6px var(--shadow-color);
    }
  }
}

// 文件上传按钮组
.upload-buttons {
  position: absolute;
  left: 15px;
  bottom: 15px;
  transform: translateY(0);
  display: flex;
  gap: 12px;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  z-index: 1;

  .input-expanded & {
    opacity: 1;
    animation: fadeInButtons 0.2s ease 0.1s forwards;
    transform: translateY(0);
  }

  .input-collapsing & {
    opacity: 0;
    transform: translateY(10px);
  }

  // 单个上传按钮样式
  .upload-btn {
    width: 20px;
    height: 20px;
    min-width: 20px;
    min-height: 20px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    transition: all 0.2s ease;
    opacity: 0.6;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      opacity: 1;
      transform: scale(1.1);

      &::before,
      &::after {
        opacity: 1;
        visibility: visible;
      }
    }

    &:active {
      transform: scale(0.95);
    }

    uni-image {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    &::before {
      content: attr(data-tooltip);
      position: absolute;
      bottom: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 10px;
      font-size: 12px;
      white-space: nowrap;
      color: var(--text-primary);
      background: var(--bg-secondary);
      border-radius: 4px;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
      pointer-events: none;
      z-index: 10;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      border-width: 4px;
      border-style: solid;
      border-color: var(--bg-secondary) transparent transparent transparent;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
      pointer-events: none;
      z-index: 10;
    }

    &:hover {
      opacity: 1;
      transform: scale(1.1);

      &::before,
      &::after {
        opacity: 1;
        visibility: visible;
        transform: translateX(-50%) translateY(-5px);
      }
    }
  }
}

// 隐藏所有滚动条
* {
  &::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }

  scrollbar-width: none;
  -ms-overflow-style: none;
}

// 动画关键帧定义
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes expandInput {
  0% {
    transform: scale(0.98);
  }

  50% {
    transform: scale(1.01);
  }

  100% {
    transform: scale(1);
  }
}

@keyframes collapseInput {
  0% {
    transform: scale(1);
  }

  100% {
    transform: scale(0.98);
  }
}

@keyframes expandTextarea {
  0% {
    opacity: 0.8;
    transform: translateY(0) scale(0.98);
  }

  50% {
    opacity: 0.9;
    transform: translateY(-2px) scale(1.01);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes fadeInButtons {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes appearFromBottom {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

// 移动端适配：调整定位和宽度
@media (max-width: 768px) {
  .input-container {
    width: 100%;
    padding: 0; // 去除额外内边距
  }

  .input-wrapper {
    max-width: 100%; // 移动端下取消最大宽度限制
  }

  .input-area {
    uni-textarea {
      padding-right: 100px; // 为发送按钮预留空间
    }
  }
}
</style>
