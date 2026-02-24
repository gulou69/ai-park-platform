<template>
  <view>
    <!-- 移动端模型选择弹窗 -->
    <view v-if="showModels" class="mobile-popup-overlay" @click="closeModels">
      <view class="mobile-popup-container" @click.stop>
        <view class="popup-header">
          <text class="popup-title">选择模型</text>
          <button class="close-btn" @click="closeModels">
            <text>×</text>
          </button>
        </view>
        <view class="popup-body">
          <view v-if="loadingModels" class="loading-container">
            <view class="loading-spinner"></view>
            <text class="loading-text">加载中...</text>
          </view>
          <view v-else-if="freeModels.length === 0 && paidModels.length === 0" class="empty-state">
            <text>暂无可用模型</text>
          </view>
          <template v-else>
            <view v-if="freeModels.length > 0" class="model-section">
              <text class="section-title">免费模型</text>
              <view 
                v-for="model in freeModels" 
                :key="model.id" 
                class="model-item"
                :class="{ active: currentModel === model.id }" 
                @click="selectModel(model)"
              >
                <view class="model-icon">
                  <text>🤖</text>
                </view>
                <view class="model-info">
                  <text class="model-name">{{ model.display_name || model.name }}</text>
                  <text class="model-desc">{{ getModelDescription(model) }}</text>
                </view>
                <text v-if="currentModel === model.id" class="check-mark">✓</text>
              </view>
            </view>
            <view v-if="paidModels.length > 0" class="model-section">
              <text class="section-title">付费模型</text>
              <view 
                v-for="model in paidModels" 
                :key="model.id" 
                class="model-item"
                :class="{ active: currentModel === model.id }" 
                @click="selectModel(model)"
              >
                <view class="model-icon">
                  <text>💎</text>
                </view>
                <view class="model-info">
                  <text class="model-name">{{ model.display_name || model.name }}</text>
                  <text class="model-desc">{{ getModelDescription(model) }}</text>
                </view>
                <text v-if="currentModel === model.id" class="check-mark">✓</text>
              </view>
            </view>
          </template>
        </view>
      </view>
    </view>

    <!-- 移动端聊天历史弹窗 -->
    <view v-if="showHistory" class="mobile-popup-overlay" @click="closeHistory">
      <view class="mobile-popup-container" @click.stop>
        <view class="popup-header">
          <text class="popup-title">聊天历史</text>
          <button class="close-btn" @click="closeHistory">
            <text>×</text>
          </button>
        </view>
        <view class="popup-body">
          <view v-if="loadingHistory" class="loading-container">
            <view class="loading-spinner"></view>
            <text class="loading-text">加载中...</text>
          </view>
          <view v-else-if="chatHistory.length === 0" class="empty-state">
            <text>暂无聊天记录</text>
            <view class="empty-tip">{{ isLoggedIn ? '点击"新对话"开始聊天' : '请先登录' }}</view>
          </view>
          <view v-else>
            <!-- 新对话按钮 -->
            <view class="new-chat-button" @click="handleNewChat">
              <text class="icon">➕</text>
              <text>新对话</text>
            </view>
            <!-- 历史会话列表 -->
            <view 
              v-for="chat in chatHistory" 
              :key="chat.id" 
              class="history-item"
              :class="{ active: currentChatId === chat.id }" 
              @click="selectHistory(chat)"
            >
              <view class="history-content">
                <text class="history-title">{{ chat.title || '新对话' }}</text>
                <text class="history-time">{{ formatTime(chat.created_at) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'MobilePopups',
  props: {
    // 显示控制
    showModels: {
      type: Boolean,
      default: false
    },
    showHistory: {
      type: Boolean,
      default: false
    },
    
    // 数据props
    freeModels: {
      type: Array,
      default: () => []
    },
    paidModels: {
      type: Array,
      default: () => []
    },
    chatHistory: {
      type: Array,
      default: () => []
    },
    currentModel: {
      type: String,
      default: ''
    },
    currentChatId: {
      type: String,
      default: ''
    },
    
    // 状态props
    loadingModels: {
      type: Boolean,
      default: false
    },
    loadingHistory: {
      type: Boolean,
      default: false
    },
    isLoggedIn: {
      type: Boolean,
      default: false
    }
  },
  
  methods: {
    // 关闭弹窗方法
    closeModels() {
      this.$emit('close-models');
    },
    
    closeHistory() {
      this.$emit('close-history');
    },
    
    // 模型相关方法
    selectModel(model) {
      this.$emit('select-model', model);
      this.closeModels();
    },
    
    getModelDescription(model) {
      if (model.model_type === 'text') {
        return `文本对话 · ${model.is_free ? '免费' : '付费'}`;
      } else if (model.model_type === 'image') {
        return `图像生成 · ${model.is_free ? '免费' : '付费'}`;
      }
      return model.is_free ? '免费模型' : '付费模型';
    },
    
    // 历史记录相关方法
    selectHistory(chat) {
      this.$emit('select-history', chat);
      this.closeHistory();
    },
    
    handleNewChat() {
      this.$emit('new-chat');
      this.closeHistory();
    },
    
    formatTime(timestamp) {
      try {
        if (!timestamp) return '';
        
        let date;
        
        // 处理不同格式的时间戳
        if (typeof timestamp === 'string') {
          // 如果是字符串，尝试直接解析
          date = new Date(timestamp);
        } else if (typeof timestamp === 'number') {
          // 如果是数字，判断是秒还是毫秒时间戳
          if (timestamp.toString().length === 10) {
            // 10位数字是秒时间戳，转换为毫秒
            date = new Date(timestamp * 1000);
          } else {
            // 13位数字是毫秒时间戳
            date = new Date(timestamp);
          }
        } else {
          return '';
        }

        // 如果是无效日期，返回空字符串
        if (isNaN(date.getTime())) {
          console.warn('无效的时间戳:', timestamp);
          return '';
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        // 日期格式化
        if (dateOnly.getTime() === today.getTime()) {
          // 今天，只显示时间
          return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } else if (date.getFullYear() === now.getFullYear()) {
          // 今年，显示月日和时间
          return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        } else {
          // 其他年份，显示年月日
          return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
        }
      } catch (e) {
        console.error('日期格式化错误', e, 'timestamp:', timestamp);
        return '';
      }
    }
  }
}
</script>

<style lang="scss" scoped>
// 弹窗遮罩层 - 使用 fixed 定位，确保覆盖整个视口
.mobile-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 9999; // 非常高的层级
  display: flex;
  align-items: center;
  justify-content: center;
  padding: env(safe-area-inset-top, 20px) 20px env(safe-area-inset-bottom, 20px);
  box-sizing: border-box;
}

// 弹窗容器 - 严格限制高度
.mobile-popup-container {
  width: 90%;
  max-width: 400px;
  max-height: calc(100vh - env(safe-area-inset-top, 40px) - env(safe-area-inset-bottom, 40px));
  background: var(--bg-secondary);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  animation: popupSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

// 弹窗头部 - 固定不滚动
.popup-header {
  position: relative; // 为关闭按钮提供定位参考
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0; // 防止压缩
  background: var(--bg-secondary);
  
  .popup-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    padding-right: 50px; // 为关闭按钮留出空间
  }
  
  .close-btn {
    position: absolute; // 绝对定位确保位置
    top: 20px;
    right: 20px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bg-tertiary);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0; // 防止按钮被压缩
    z-index: 1; // 确保在最上层
    
    &:hover, &:active {
      background: var(--bg-hover);
      transform: scale(1.1);
    }
    
    uni-text {
      font-size: 20px;
      color: var(--text-secondary);
      line-height: 1;
    }
  }
}

// 弹窗内容区域 - 可滚动
.popup-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px 20px;
  min-height: 0; // 重要：允许 flex 子项缩小
  
  // 自定义滚动条
  &::-webkit-scrollbar {
    width: 4px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 2px;
    
    &:hover {
      background: var(--text-tertiary);
    }
  }
}

// 加载状态
.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  
  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--primary-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  .loading-text {
    margin-left: 12px;
    color: var(--text-secondary);
    font-size: 14px;
  }
}

// 空状态
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  
  .empty-tip {
    margin-top: 8px;
    font-size: 14px;
    opacity: 0.8;
  }
}

// 模型相关样式
.model-section {
  margin-bottom: 20px;
  
  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 16px 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
}

.model-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 8px;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--bg-hover);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &.active {
    background: var(--primary-bg);
    border: 1px solid var(--primary-color);
  }
  
  .model-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    
    uni-text {
      font-size: 20px;
    }
  }
  
  .model-info {
    flex: 1;
    min-width: 0;
    
    .model-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      display: block;
      margin-bottom: 4px;
    }
    
    .model-desc {
      font-size: 14px;
      color: var(--text-secondary);
      display: block;
    }
  }
  
  .check-mark {
    color: var(--primary-color);
    font-size: 18px;
    font-weight: bold;
  }
}

// 历史记录相关样式
.new-chat-button {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin: 16px 0;
  background: linear-gradient(135deg, var(--primary-color), #00C6FF);
  border-radius: 12px;
  color: white;
  cursor: pointer;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 122, 255, 0.3);
  transition: all 0.2s ease;
  
  &:active {
    transform: scale(0.98);
  }
  
  .icon {
    font-size: 18px;
  }
}

.history-item {
  display: flex;
  align-items: center;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 8px;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: var(--bg-hover);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: scale(0.98);
  }
  
  &.active {
    background: var(--primary-bg);
    border-left: 4px solid var(--primary-color);
  }
  
  .history-content {
    flex: 1;
    min-width: 0;
    
    .history-title {
      font-size: 16px;
      font-weight: 500;
      color: var(--text-primary);
      display: block;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .history-time {
      font-size: 13px;
      color: var(--text-secondary);
      display: block;
    }
  }
}

// 动画
@keyframes popupSlideIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// 响应式调整
@media (max-height: 600px) {
  .mobile-popup-container {
    max-height: calc(100vh - 20px);
  }
  
  .popup-header {
    padding: 16px 20px;
  }
  
  .popup-body {
    padding: 0 20px 16px;
  }
}
</style> 