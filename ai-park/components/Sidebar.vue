<template>
  <view class="model-sidebar" :class="{ 'sidebar-collapsed': isCollapsed }">
    <view class="sidebar-header">
      <image class="sidebar-logo" :src="isCollapsed ? '/static/logo-collapse.png' : '/static/logo.png'"
        mode="heightFix" />
    </view>

    <!-- 操作按钮 -->
    <view v-if="!isCollapsed" class="action-buttons">
      <button class="new-chat-btn" @click="handleNewChat">
        <view class="btn-icon">+</view>
        <text>新对话</text>
      </button>
    </view>

    <!-- 消息历史列表 -->
    <view class="chat-history" v-show="!isCollapsed">
      <view v-if="loading" class="loading-history">
        <view class="loading-spinner"></view>
        <text>加载中...</text>
      </view>
      <template v-else>
        <view v-for="chat in chatHistory" :key="chat.id" class="history-item"
          :class="{ 'active': currentChatId === chat.id }" @click="selectChat(chat)">
          <view class="chat-content">
            <text class="chat-title">{{ chat.title || '新对话' }}</text>
            <text class="chat-message" v-if="chat.last_message">{{ chat.last_message.content }}</text>
            <text class="chat-time">{{ formatTime(chat.created_at) }}</text>
          </view>

          <view class="history-actions">
            <!-- 删除编辑按钮，只保留删除按钮 -->
            <button class="action-btn delete-btn" @click.stop="deleteChat(chat)">
              <image src="/static/icons/trash.svg" mode="aspectFit" style="width: 16px; height: 16px;" />
            </button>
          </view>
        </view>
        <view v-if="chatHistory.length === 0" class="empty-history">
          暂无聊天记录
        </view>
      </template>
    </view>

    <!-- 底部操作区 -->
    <view class="sidebar-footer" v-if="!isCollapsed">
      <button class="clear-history" @click="confirmClearHistory">
        <image src="/static/icons/trash.svg" mode="aspectFit" style="width: 16px; height: 16px;" />
        <text>清空历史记录</text>
      </button>
    </view>

    <!-- 删除编辑对话标题弹窗 -->
  </view>
</template>

<script>
import { chatApi } from '@/api/chat';

export default {
  name: 'Sidebar',
  props: {
    isCollapsed: {
      type: Boolean,
      default: false
    },
    currentChatId: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      chatHistory: [],
      loading: false,
      // 删除编辑对话相关的数据属性
      page: 1,
      hasMoreData: true
    }
  },
  created() {
    // 只在登录状态下获取聊天历史
    this.checkLoginAndFetch();

    // 监听事件
    uni.$on('refresh-chat-history', this.fetchChatHistory);
    
    // 监听登录状态变化
    uni.$on('user-logged-in', this.fetchChatHistory);
    uni.$on('user-logged-out', this.clearChatHistory);
  },
  beforeDestroy() {
    // 移除事件监听
    uni.$off('refresh-chat-history', this.fetchChatHistory);
    uni.$off('user-logged-in', this.fetchChatHistory);
    uni.$off('user-logged-out', this.clearChatHistory);
  },
  methods: {
    async fetchChatHistory(reset = false) {
      try {
        // 检查登录状态，未登录时直接返回
        const isLoggedIn = uni.getStorageSync('isLoggedIn');
        if (!isLoggedIn) {
          console.log('用户未登录，跳过获取聊天历史');
          this.chatHistory = [];
          return;
        }

        this.loading = true;
        const response = await chatApi.getConversations();
        if (response.success) {
          // 确保返回的数据是数组并保存到正确的数据属性
          this.chatHistory = Array.isArray(response.data) ? response.data : [];

          // 如果有分页数据，保存它
          if (response.pagination) {
            this.hasMoreData = response.pagination.has_more;
          }
        } else {
          this.chatHistory = []; // 如果请求失败，设置为空数组
        }
      } catch (error) {
        console.error('获取聊天历史失败:', error);
        this.chatHistory = []; // 出错时设置为空数组
        
        // 只在不是认证错误时显示提示
        if (!error.message?.includes('请先登录') && !error.message?.includes('认证失败')) {
          uni.showToast({
            title: '获取聊天历史失败',
            icon: 'none'
          });
        }
      } finally {
        this.loading = false;
      }
    },

    // 创建新对话
    handleNewChat() {
      // 检查是否登录
      const isLoggedIn = uni.getStorageSync('isLoggedIn');
      if (!isLoggedIn) {
        uni.$emit('showLogin');
        return;
      }

      // 通知父组件创建新对话
      this.$emit('history-cleared'); // 简单实现，先清空当前消息

      // 打开模型选择（由主页面处理）
      uni.$emit('show-model-select');
    },

    // 选择对话
    selectChat(chat) {
      console.log('选择对话:', chat.id);
      // 只触发事件通知父组件加载此对话的消息
      this.$emit('select-chat', chat);
    },

    // 删除对话
    async deleteChat(chat) {
      try {
        // 使用Promise包装uni.showModal以正确处理Promise
        const confirmResult = await new Promise((resolve) => {
          uni.showModal({
            title: '确认删除',
            content: '确定要删除此对话吗？',
            confirmText: '删除',
            confirmColor: '#ff4d4f',
            success: (res) => {
              resolve(res);
            },
            fail: () => {
              resolve({ confirm: false });
            }
          });
        });

        if (confirmResult.confirm) {
          const response = await chatApi.deleteConversation(chat.id);

          if (response.success) {
            // 从列表中移除
            this.chatHistory = this.chatHistory.filter(c => c.id !== chat.id);

            // 如果删除的是当前选中的对话，清空当前对话
            if (chat.id === this.currentChatId) {
              this.$emit('history-cleared');
            }

            uni.showToast({
              title: '删除成功',
              icon: 'success'
            });
          } else {
            uni.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      } catch (error) {
        console.error('删除对话失败:', error);
        uni.showToast({
          title: '删除失败',
          icon: 'none'
        });
      }
    },

    // 确认清空历史
    async confirmClearHistory() {
      try {
        // 同样使用Promise包装uni.showModal
        const confirmResult = await new Promise((resolve) => {
          uni.showModal({
            title: '确认清空',
            content: '是否确认清空所有聊天记录？此操作不可恢复。',
            confirmText: '清空',
            confirmColor: '#ff4d4f',
            success: (res) => {
              resolve(res);
            },
            fail: () => {
              resolve({ confirm: false });
            }
          });
        });

        if (confirmResult.confirm) {
          // TODO: 调用清空所有历史记录的API
          // 实际应用中应当有一个API来清除所有记录

          this.chatHistory = [];
          this.$emit('history-cleared');

          uni.showToast({
            title: '已清空历史记录',
            icon: 'success'
          });
        }
      } catch (error) {
        console.error('清空历史记录失败:', error);
      }
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
    },

    // 检查登录状态并获取聊天历史
    async checkLoginAndFetch() {
      const isLoggedIn = uni.getStorageSync('isLoggedIn');
      if (isLoggedIn) {
        await this.fetchChatHistory();
      }
    },

    // 清除聊天历史
    clearChatHistory() {
      this.chatHistory = [];
      this.$emit('history-cleared');
    }
  }
}
</script>

<style lang="scss" scoped>
.model-sidebar {
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
  background: var(--bg-secondary);
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-color);
  transform: translateX(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  height: 100%;

  // 侧边栏收起状态样式
  &.sidebar-collapsed {
    width: 60px;
    min-width: 60px;

    .sidebar-header {
      justify-content: center;
      padding: 12px;
    }

    .sidebar-logo {
      width: 32px;
      height: 32px;
    }

    .chat-history,
    .sidebar-footer,
    .action-buttons {
      display: none;
    }
  }

  .sidebar-header {
    padding: 16px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
    min-height: 64px;
    overflow: hidden;

    .sidebar-logo {
      height: 32px;
      width: auto;
      transition: all 0.3s ease;
    }
  }

  // 操作按钮区域样式
  .action-buttons {
    padding: 16px;
    border-bottom: 1px solid var(--border-color);

    .new-chat-btn {
      width: 100%;
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      background: #007AFF;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: #0066cc;
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }

      .btn-icon {
        font-size: 18px;
        font-weight: bold;
      }
    }
  }

  .chat-history {
    flex: 1;
    overflow-y: auto;
    padding: 8px;

    // 加载中状态
    .loading-history {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 0;
      gap: 16px;

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid rgba(0, 122, 255, 0.3);
        border-top-color: #007AFF;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      uni-text {
        color: var(--text-secondary);
        font-size: 14px;
      }
    }

    .history-item {
      padding: 12px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 8px;
      transition: all 0.2s ease;
      position: relative;

      &:hover {
        background: var(--hover-bg);

        .history-actions {
          opacity: 1;
        }
      }

      &.active {
        background: var(--hover-bg);
        border-left: 3px solid #007AFF;
      }

      .chat-content {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding-right: 24px; // 为按钮留出空间

        .chat-title {
          font-size: 14px;
          color: var(--text-primary);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .chat-message {
          font-size: 12px;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 4px;
          max-height: 32px;
        }

        .chat-time {
          font-size: 12px;
          color: var(--text-secondary);
        }
      }

      .history-actions {
        position: absolute;
        right: 8px;
        top: 8px;
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.2s ease;

        .action-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          border-radius: 4px;
          padding: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;

          uni-image {
            width: 16px;
            height: 16px;
            filter: var(--icon-filter);
            opacity: 0.6;
          }

          &:hover {
            background: var(--hover-bg);

            uni-image {
              opacity: 1;
            }
          }

          &.delete-btn:hover {
            background: rgba(255, 77, 79, 0.1);

            uni-image {
              filter: invert(35%) sepia(73%) saturate(7471%) hue-rotate(346deg) brightness(98%) contrast(109%);
            }
          }
        }
      }
    }

    .empty-history {
      text-align: center;
      padding: 40px 16px;
      color: var(--text-secondary);
      font-size: 14px;
    }

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--scroll-thumb);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }
  }

  // 底部操作区域
  .sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
    flex-shrink: 0;

    .clear-history {
      width: 100%;
      height: 40px;
      max-height: 40px;
      padding: 0 12px;
      border: none;
      background: transparent;
      border-radius: 8px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: var(--text-secondary);
      font-size: 14px;
      line-height: 40px;
      cursor: pointer;
      transition: all 0.2s ease;
      overflow: hidden;
      box-sizing: border-box;

      &::after {
        display: none; // 移除 uni-app button 默认边框
      }

      uni-image {
        width: 16px !important;
        height: 16px !important;
        max-width: 16px;
        max-height: 16px;
        min-width: 16px;
        min-height: 16px;
        flex-shrink: 0;
        filter: var(--icon-filter);
        opacity: 0.6;
      }

      uni-text {
        font-size: 14px;
        line-height: 1;
        white-space: nowrap;
      }

      &:hover {
        background: var(--hover-bg);
        color: var(--text-primary);

        uni-image {
          opacity: 1;
        }
      }
    }
  }
}

// 删除编辑对话标题弹窗相关样式
// 只保留动画效果和移动端适配的通用样式

// 动画效果
@keyframes spin {
  to {
    transform: rotate(360deg);
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

// 移动端适配
@media (max-width: 768px) {
  .model-sidebar {
    position: fixed;
    left: 0;
    top: 60px;
    height: calc(100vh - 60px);
    z-index: 100;
    width: 260px;
    transform: translateX(-100%);
    box-shadow: none;

    &.active {
      transform: translateX(0);
      box-shadow: 0 0 20px var(--shadow-color);
    }

    .chat-history {
      max-height: calc(100% - 130px);
    }

    .history-item {
      .history-actions {
        opacity: 1; // 在移动端总是显示操作按钮
      }
    }

    .action-buttons {
      padding: 10px;
    }

    .sidebar-footer {
      padding: 10px;
    }
  }

  .edit-title-dialog {
    .dialog-content {
      width: 95%;
    }
  }
}
</style>
