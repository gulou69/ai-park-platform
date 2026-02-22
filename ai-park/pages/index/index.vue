<template>
  <view class="container" :class="`theme-${currentTheme}`">
    <!-- 状态栏占位 -->
    <view class="status-bar-placeholder"></view>
    
    <Header :is-mobile="isMobile" :is-logged-in="isLoggedIn" :user-info="userInfo" @toggle-theme="toggleTheme"
      @show-models="showMobileModels = true" @show-history="showMobileHistory = true" 
      @update-login-status="handleUpdateLoginStatus" />
    
    <!-- 主要内容区 -->
    <view class="main-content">
      <Sidebar :is-collapsed="isSidebarCollapsed" :current-chat-id="currentChatId" @select-chat="handleSelectChat"
        @history-cleared="handleHistoryCleared" />

      <sidebar-toggle :is-collapsed="isSidebarCollapsed" @toggle="toggleSidebar"
        :style="{ left: isSidebarCollapsed ? '60px' : '280px' }" />

      <ChatArea :messages="messages" :is-expanded="isSidebarCollapsed" :is-input-expanded="isInputExpanded"
        :loading-message-id="loadingMessageId" :debug-mode="debugMode" @use-prompt="useQuickPrompt"
        @copy-message="copyMessage" @regenerate-message="regenerateMessage" @like-message="likeMessage"
        @dislike-message="dislikeMessage" @get-avatar="getMessageAvatar">
        <template #input-area>
          <InputArea :value.sync="inputMessage" v-model="inputMessage" :disabled="isWaitingResponse"
            :login-required="!isLoggedIn" @send="sendMessage" 
            @focus="handleInputFocus" @blur="handleInputBlur"
            @login-prompt="handleLoginPrompt" ref="inputArea" />
        </template>
      </ChatArea>
    </view>

    <!-- 移动端弹窗组件 -->
    <MobilePopups 
      v-if="isMobile"
      :show-models="showMobileModels"
      :show-history="showMobileHistory" 
      :free-models="freeModels"
      :paid-models="paidModels"
      :chat-history="conversations"
      :current-model="currentModel"
      :current-chat-id="currentChatId"
      :loading-models="loadingModels"
      :loading-history="false"
      :is-logged-in="isLoggedIn"
      @close-models="showMobileModels = false"
      @close-history="showMobileHistory = false"
      @select-model="handleMobileModelSelect"
      @select-history="handleSelectChat"
      @new-chat="handleCreateNewChat"
    />

    <!-- 登录弹窗 -->
    <LoginPopUp v-if="showLoginPopup" :initial-phone="loginInitialPhone" @close="handleLoginPopupClose"
      @login-success="handleLoginSuccess" />

    <!-- 模型选择弹窗 -->
    <view v-if="showModelSelect" class="model-select-popup">
      <!-- ... existing model select popup code ... -->
    </view>
  </view>
</template>

<script>
import Header from '@/components/Header.vue'
import Sidebar from '@/components/Sidebar.vue'
import SidebarToggle from '@/components/SidebarToggle.vue'
import InputArea from '@/components/InputArea.vue'
import ChatArea from '@/components/ChatArea.vue'
import LoginPopUp from '@/components/LoginPopUp.vue'
import MobilePopups from '@/components/MobilePopups.vue'
import { themeManager } from '@/utils/theme.js'
import { chatApi } from '@/api/chat'
import { modelApi } from '@/api/model'
import config from '@/config'
import statusBarManager, { getStatusBarHeight, setStatusBarStyle } from '@/utils/statusBar.js'

const REQUEST_TIMEOUT = config.requestTimeout; // 使用配置中的超时时间
// 获取基础URL (从配置文件中读取)
const BASE_URL = config.apiBaseUrl;

export default {
  components: {
    Header,
    Sidebar,
    SidebarToggle,
    InputArea,
    ChatArea,
    LoginPopUp,
    MobilePopups
  },
  data() {
    return {
      isLoggedIn: false,
      isMobile: false,
      isSidebarCollapsed: false,
      sortType: 'count',
      inputMessage: '',
      userInfo: {},
      messages: [],
      currentChatId: '',
      currentChat: null,
      isInputExpanded: false,
      showLoginPopup: false,
      loginInitialPhone: '',
      loadingMessageId: null,
      conversations: [],
      showModelSelect: false,
      currentModel: '',
      freeModels: [],
      paidModels: [],
      loadingModels: false,
      activeEventSource: null,
      requestTimers: {},
      isWaitingResponse: false,
      debugMode: true, // 调试模式开关
      currentTheme: 'light', // 添加主题变量
      currentConversation: null,
      messagesLoading: false,
      hasMoreMessages: false,
      messagePagination: {
        firstId: null,
        limit: 20
      },
      showMobileModels: false,
      showMobileHistory: false
    }
  },
  created() {
    // 检测设备类型
    this.checkDevice();
    // 检查登录状态
    this.checkLoginStatus();
    // 获取初始数据
    this.initData();
    // 直接获取模型列表（确保无论如何都会加载）
    this.fetchModels();
    // 从本地存储恢复侧边栏状态
    const savedState = uni.getStorageSync('sidebarState');
    if (savedState !== '') {
      this.isSidebarCollapsed = savedState;
    }

    // 初始化状态栏
    this.initStatusBar();

    // 同时监听两个事件
    uni.$on('showLoginWithPhone', this.handleShowLogin);
    uni.$on('showLogin', () => this.handleShowLogin(''));

    // 监听模型变更事件
    uni.$on('model-changed', this.handleModelChanged);

    // 监听登录成功事件
    uni.$on('user-logged-in', this.handleUserLoggedIn);

    // 监听刷新页面事件
    uni.$on('refresh-page', this.refreshData);

    // 添加登出事件监听
    uni.$on('user-logged-out', this.handleLogout);

    // 确保同步主题
    this.currentTheme = uni.getStorageSync('theme') || 'light';

    // 监听主题变化
    uni.$on('theme-changed', (themeName) => {
      this.currentTheme = themeName;
      // 根据主题更新状态栏样式
      this.updateStatusBarStyle();
    });

    // 添加登录状态持续监听
    uni.$on('storage-changed', (key) => {
      if (key === 'isLoggedIn' || key === 'userInfo') {
        this.checkLoginStatus();
      }
    });

    // 初始化时立即检查一次
    this.checkLoginStatus();

    // 监听全局事件
    uni.$on('refresh-chat-history', () => {
      // 刷新聊天历史时，通知Sidebar组件
      if (this.$refs.sidebar) {
        this.$refs.sidebar.fetchChatHistory();
      }
    });
    
    // 添加创建新对话的事件监听
    uni.$on('create-new-chat', this.handleCreateNewChat);
  },
  beforeDestroy() {
    // 移除事件监听
    uni.$off('showLoginWithPhone', this.handleShowLogin);
    uni.$off('showLogin');
    uni.$off('model-changed', this.handleModelChanged);
    uni.$off('user-logged-in', this.handleUserLoggedIn);
    uni.$off('refresh-page', this.refreshData);
    
    // 只在浏览器环境中移除window事件监听
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize');
    }

    // 关闭可能存在的流式响应连接
    if (this.activeEventSource) {
      this.activeEventSource.close();
    }

    // 移除键盘事件监听
    if (typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.handleKeyDown);
    }

    // 移除登出事件监听
    uni.$off('user-logged-out', this.handleLogout);

    uni.$off('refresh-chat-history');
    
    // 移除新增的事件监听
    uni.$off('create-new-chat', this.handleCreateNewChat);
  },
  mounted() {
    // 添加键盘事件监听
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this.handleKeyDown);
    }
    
    // 强制重新检查移动端状态
    this.$nextTick(() => {
      this.checkDevice();
      console.log('mounted后设备状态:', {
        isMobile: this.isMobile,
        screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'N/A',
        screenHeight: typeof window !== 'undefined' ? window.innerHeight : 'N/A',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 50) : 'N/A'
      });
      
      // 强制更新视图
      this.$forceUpdate();
    });
  },
  methods: {
    /**
     * 初始化状态栏
     */
    initStatusBar() {
      // 设置初始状态栏样式
      this.updateStatusBarStyle();
      
      // 获取状态栏高度并设置
      const statusBarHeight = getStatusBarHeight();
      console.log('状态栏高度:', statusBarHeight);
    },

    /**
     * 更新状态栏样式
     */
    updateStatusBarStyle() {
      const isDark = this.currentTheme === 'dark';
      setStatusBarStyle(isDark ? 'light' : 'dark');
    },

    checkDevice() {
      // 检查是否为移动设备
      const isMobile = () => {
        // 首先检查uni-app环境
        // #ifdef APP-PLUS || MP
        return true;
        // #endif
        
        // H5环境下的检测
        // #ifdef H5
        const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
        const mobile = /phone|pad|pod|iphone|ipod|ios|ipad|android|mobile|blackberry|iemobile|mqqbrowser|juc|fennec|wosbrowser|browserng|webos|symbian|windows phone/i;
        
        // 检查用户代理
        const isMobileUA = mobile.test(userAgent);
        
        // 检查屏幕宽度
        const isSmallScreen = typeof window !== 'undefined' ? window.innerWidth <= 768 : false;
        
        // 检查触摸支持
        const isTouchDevice = typeof window !== 'undefined' ? ('ontouchstart' in window || navigator.maxTouchPoints > 0) : false;
        
        // 检查设备像素比（高DPI设备通常是移动设备）
        const isHighDPI = typeof window !== 'undefined' ? window.devicePixelRatio > 1.5 : false;
        
        console.log('移动端检测:', {
          userAgent: userAgent.substring(0, 50),
          isMobileUA,
          isSmallScreen,
          isTouchDevice,
          isHighDPI,
          screenWidth: typeof window !== 'undefined' ? window.innerWidth : 'N/A',
          devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 'N/A'
        });
        
        // 综合判断
        return isMobileUA || (isSmallScreen && isTouchDevice);
        // #endif
      };

      // 初始检测
      this.isMobile = isMobile();
      console.log('设备类型:', this.isMobile ? '移动端' : '桌面端');

      // 监听窗口大小变化（仅H5）
      // #ifdef H5
      if (typeof window !== 'undefined') {
        window.addEventListener('resize', () => {
          const newIsMobile = isMobile();
          if (this.isMobile !== newIsMobile) {
            this.isMobile = newIsMobile;
            console.log('设备类型切换:', this.isMobile ? '移动端' : '桌面端');
          }
        });
      }
      // #endif
    },

    checkLoginStatus() {
      const isLoggedIn = uni.getStorageSync('isLoggedIn');
      const userInfo = uni.getStorageSync('userInfo');

      console.log('检查登录状态:', { isLoggedIn, userInfo });

      if (isLoggedIn && userInfo && userInfo.id) {
        this.isLoggedIn = true;
        this.userInfo = userInfo;
        console.log('已确认登录状态有效');
      } else {
        // 状态不一致，清理
        if (isLoggedIn && (!userInfo || !userInfo.id)) {
          console.warn('登录状态异常: 标记为已登录但用户信息不完整');
          uni.removeStorageSync('isLoggedIn');
          this.isLoggedIn = false;
        }
      }
    },

    initData() {
      // 获取模型列表（无论是否登录都需要）
      this.fetchModels();
      
      // 如果已登录，获取会话列表
      if (this.isLoggedIn) {
        this.fetchUserConversations();
      }
    },

    // 刷新数据
    refreshData() {
      if (this.isLoggedIn) {
        this.fetchUserConversations();
        this.fetchModels();
      }
    },

    // 获取用户对话列表
    async fetchUserConversations() {
      try {
        // 检查登录状态，未登录时直接返回
        const isLoggedIn = uni.getStorageSync('isLoggedIn');
        const userInfo = uni.getStorageSync('userInfo');
        
        if (!isLoggedIn || !userInfo || !userInfo.id) {
          console.log('用户未登录或用户信息不完整，跳过获取对话列表');
          this.conversations = [];
          return;
        }

        const response = await chatApi.getConversations();
        if (response.success) {
          this.conversations = response.data || [];
        } else {
          this.conversations = [];
        }
      } catch (error) {
        console.error('获取对话列表失败:', error);
        this.conversations = [];
        
        // 只在不是认证相关错误时显示提示
        if (!error.message?.includes('请先登录') && 
            !error.message?.includes('认证失败') && 
            !error.message?.includes('未提供认证令牌')) {
          uni.showToast({
            title: '获取对话列表失败',
            icon: 'none'
          });
        }
      }
    },

    // 获取可用模型列表
    async fetchModels() {
      try {
        this.loadingModels = true;
        console.log('开始获取模型列表...');
        const response = await modelApi.getModels();
        
        console.log('模型API响应:', response);
        
        // 无论成功与否，都设置模型列表(可能为空数组)
        this.freeModels = response.data?.free_models || [];
        this.paidModels = response.data?.paid_models || [];
        
        console.log('设置模型数据:', {
          freeModels: this.freeModels,
          paidModels: this.paidModels,
          freeCount: this.freeModels.length,
          paidCount: this.paidModels.length
        });
        
        // 判断是否有任何可用模型
        const hasModels = this.freeModels.length > 0 || this.paidModels.length > 0;
        
        // 只在有模型的情况下设置默认模型
        if (hasModels) {
          // 如果有免费模型且当前没有选择模型，自动选择第一个
          if (this.freeModels.length > 0 && !this.currentModel) {
            this.currentModel = String(this.freeModels[0].id);
            // 保存选择到本地存储
            uni.setStorageSync('selected_model', this.currentModel);
            console.log('自动选择模型:', this.freeModels[0].display_name || this.freeModels[0].name);
          }
        } else {
          console.warn('未获取到任何模型');
          // 清除当前选择的模型
          this.currentModel = '';
          uni.removeStorageSync('selected_model');
        }
        
        // 发出事件通知其他组件模型列表已更新
        uni.$emit('models-updated', {
          free: this.freeModels,
          paid: this.paidModels,
          hasModels: hasModels
        });
        
        // 如果未获取到模型，显示提示
        if (!hasModels) {
          uni.showToast({
            title: '暂无可用模型',
            icon: 'none',
            duration: 2000
          });
        }
        
        // 如果API调用失败，显示错误提示
        if (!response.success) {
          console.error('获取模型列表失败:', response.message);
        }
      } catch (error) {
        console.error('获取模型列表失败:', error);
        // 修改错误提示，不再提及使用默认模型
        uni.showToast({
          title: '获取模型列表失败',
          icon: 'none'
        });
        
        // 清空模型列表
        this.freeModels = [];
        this.paidModels = [];
      } finally {
        this.loadingModels = false;
        console.log('模型加载完成，最终状态:', {
          freeModels: this.freeModels.length,
          paidModels: this.paidModels.length,
          loadingModels: this.loadingModels
        });
      }
    },

    toggleSidebar() {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
      // 保存状态到本地存储
      uni.setStorageSync('sidebarState', this.isSidebarCollapsed);
      console.log('Sidebar toggled:', this.isSidebarCollapsed); // 添加调试日志
    },

    toggleTheme() {
      themeManager.toggleTheme();
    },

    handleAvatarClick() {
      if (!this.isLoggedIn) {
        this.showLoginPopup = true;
      }
    },

    // 处理登录成功
    handleLoginSuccess(userInfo) {
      console.log('登录成功，更新状态:', userInfo);

      // 强制更新状态
      this.isLoggedIn = true;
      this.userInfo = userInfo || uni.getStorageSync('userInfo');

      // 确保userInfo有id
      if (this.userInfo && !this.userInfo.id && userInfo.id) {
        this.userInfo.id = userInfo.id;
        // 重新保存到存储
        uni.setStorageSync('userInfo', this.userInfo);
      }

      // 延迟获取数据，确保状态已更新
      setTimeout(() => {
        this.fetchUserConversations();
        this.fetchModels();
        // 强制更新视图
        this.$forceUpdate();
      }, 300);
    },

    // 处理用户登录事件
    handleUserLoggedIn(userInfo) {
      this.isLoggedIn = true;
      this.userInfo = userInfo;
      // 获取数据
      this.fetchUserConversations();
      this.fetchModels();
    },

    // 获取模型描述
    getModelDescription(model) {
      if (model.model_type === 'text') {
        return `文本对话 · ${model.is_free ? '免费' : '付费'}`;
      } else if (model.model_type === 'image') {
        return `图像生成 · ${model.is_free ? '免费' : '付费'}`;
      }
      return model.is_free ? '免费模型' : '付费模型';
    },

    // 选择模型
    selectModel(model) {
      // 检查是否切换到了不同的模型
      const previousModel = this.currentModel;
      const newModelId = String(model.id);
      
      // 更新当前模型
      this.currentModel = newModelId;
      
      uni.showToast({
        title: `已选择${model.display_name}`,
        icon: 'none'
      });
      this.showModelSelect = false;
      
      // 如果切换到了不同的模型，自动开始新对话
      if (previousModel !== newModelId) {
        console.log('桌面端模型已切换，开始新对话');
        this.handleCreateNewChat();
        
        // 显示额外提示
        setTimeout(() => {
          uni.showToast({
            title: '已开始新对话',
            icon: 'none',
            duration: 1500
          });
        }, 1200); // 稍微延迟，避免与模型选择提示重叠
      }
    },

    // 处理模型变更事件
    handleModelChanged(model) {
      this.currentModel = String(model.id);
    },

    async handleSelectChat(chat) {
      try {
        console.log('选择聊天:', chat.id, chat);

        // 显示加载状态
        this.loadingMessageId = 'loading';
        this.currentChatId = chat.id;
        this.currentChat = chat;
        this.messages = []; // 清空现有消息

        // 自动切换到对应的模型
        if (chat.model_id && chat.model_id !== this.currentModel) {
          console.log('自动切换模型从', this.currentModel, '到', chat.model_id);
          this.currentModel = String(chat.model_id);
          
          // 保存到本地存储
          uni.setStorageSync('selected_model', chat.model_id);
          
          // 查找模型信息用于显示友好名称
          const allModels = [...this.freeModels, ...this.paidModels];
          const selectedModel = allModels.find(m => m.id == chat.model_id);
          const modelName = selectedModel ? (selectedModel.display_name || selectedModel.name) : '模型';
          
          // 显示切换提示
          uni.showToast({
            title: `已切换到 ${modelName}`,
            icon: 'none',
            duration: 2000
          });
          
          // 发出事件通知其他组件
          if (selectedModel) {
            uni.$emit('model-changed', selectedModel);
          }
        }

        // 显示加载消息
        uni.showLoading({
          title: '加载聊天记录中...',
          mask: true
        });

        // 请求消息历史 - limit设置为100（Dify API最大限制）
        const response = await chatApi.getMessages(chat.id, 100);

        uni.hideLoading();

        if (response.success) {
          console.log('获取消息成功, 总消息数:', response.data?.length || 0);

          // 检查是否有消息返回
          if (response.data && Array.isArray(response.data)) {
            if (response.data.length === 0) {
              console.warn('收到空消息数组');
              uni.showToast({
                title: '此对话没有消息记录',
                icon: 'none'
              });
              return;
            }

            // 确保消息按时间顺序排列 - 从旧到新
            const sortedMessages = [...response.data].sort((a, b) => {
              return (a.created_at || 0) - (b.created_at || 0);
            });

            console.log('排序后消息数量:', sortedMessages.length);

            // 构建清晰的用户/AI交替消息结构
            const formattedMessages = [];

            for (const msg of sortedMessages) {
              console.log('处理消息:', msg.id, '类型判断:', {
                hasQuery: !!msg.query,
                hasAnswer: !!msg.answer
              });

              // 修改处理逻辑: 一条API返回消息需要拆分成用户问题和AI回答两条消息

              // 1. 添加用户消息 - 如果存在查询内容
              if (msg.query && msg.query.trim()) {
                const userMessage = {
                  id: `${msg.id}-user`,
                  type: 'user',
                  content: msg.query,
                  created_at: msg.created_at,
                  files: msg.message_files || []
                };

                formattedMessages.push(userMessage);
              }

              // 2. 添加AI回复消息 - 如果存在回答内容
              if (msg.answer && msg.answer.trim()) {
                // 处理 AI 回答中可能存在的<think>标签
                let aiContent = msg.answer;
                if (aiContent.includes('<think>') && aiContent.includes('</think>')) {
                  aiContent = aiContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
                }

                const aiMessage = {
                  id: `${msg.id}-ai`,
                  type: 'ai',
                  content: aiContent,
                  created_at: msg.created_at ? msg.created_at + 1 : msg.created_at, // 确保AI消息在用户消息之后
                  files: [] // AI回复通常没有附件，或者从其他字段获取
                };

                formattedMessages.push(aiMessage);
              }
            }

            // 将格式化后的消息设置到数组中
            this.messages = formattedMessages;
            console.log('最终消息数组长度:', this.messages.length);
            console.log('消息类型统计:', {
              user: this.messages.filter(m => m.type === 'user').length,
              ai: this.messages.filter(m => m.type === 'ai').length
            });

            // ...existing code...
          } else {
            // ...existing code...
          }

          // ...existing code...
        } else {
          // ...existing code...
        }
      } catch (error) {
        // ...existing code...
      } finally {
        // ...existing code...
      }
    },

    handleHistoryCleared() {
      this.messages = [];
      this.currentChatId = '';
      this.currentChat = null;
    },

    // 修改发送消息方法
    async sendMessage(message) {
      // 重要修改：直接使用流式消息方法替代旧方法
      return this.sendStreamMessage(message);
    },

    // 使用流式组件发送消息方法
    async sendStreamMessage(message) {
      if (!this.isLoggedIn) {
        this.showLoginPopup = true;
        return;
      }

      try {
        const messageContent = message || this.inputMessage;
        if (!messageContent.trim()) return;

        // 添加用户消息到界面
        const userMessage = {
          id: `temp_user_${Date.now()}`,
          type: 'user',
          content: messageContent.trim(),
          created_at: new Date().toISOString()
        };
        this.messages.push(userMessage);
        this.scrollToBottom();

        // 创建临时AI消息（用于显示打字机效果）
        const tempAiMessageId = `temp_ai_${Date.now()}`;
        const tempAiMessage = {
          id: tempAiMessageId,
          type: 'ai',
          content: '',
          created_at: new Date().toISOString(),
          isLoading: true,
          isStreaming: true
        };
        this.messages.push(tempAiMessage);
        this.scrollToBottom();

        // 设置状态
        this.isWaitingResponse = true;
        this.loadingMessageId = tempAiMessageId;

        // 清空输入框
        this.inputMessage = '';

        console.log('准备发送流式请求，使用原生fetch实现更细粒度的控制和调试');

        // 获取令牌和请求URL
        const token = uni.getStorageSync('token') || '';
        const requestUrl = `${config.apiBaseUrl}/api/chat/send`;

        // 判断是否需要创建新会话 - 如果当前没有选中会话
        let shouldCreateNewConversation = !this.currentChatId && !this.currentConversation;

        // 准备请求数据
        const requestData = {
          message: messageContent.trim(),
          model_id: this.currentModel.id || this.currentModel, // 支持对象或ID两种格式
          stream: true,
          user: this.userInfo.id // 确保添加用户ID
        };

        // 只有在有会话ID时才添加会话ID参数
        if (this.currentChatId) {
          requestData.conversation_id = this.currentChatId;
        }

        console.log('流式请求数据:', requestData);

        // 添加内容接收跟踪标志和超时处理
        let hasReceivedContent = false;
        let timeoutWarningShown = false;
        let timeoutId = setTimeout(() => {
          console.warn('请求等待较长时间，显示警告');

          // 检查是否已经收到内容
          if (!hasReceivedContent) {
            timeoutWarningShown = true;
            // 更改为警告而非错误，继续等待响应
            if (this.loadingMessageId === tempAiMessageId) {
              // 更新加载消息，但不移除加载状态
              const index = this.messages.findIndex(m => m.id === tempAiMessageId);
              if (index !== -1) {
                this.$set(this.messages[index], 'waitingMessage', '正在等待AI回复，请稍候...\n(可能需要较长时间)');
              }
            }
          }
        }, 10000);

        // 定义一个变量来存储可能返回的会话ID
        let receivedConversationId = null;

        // 根据平台选择请求方式
        // #ifdef H5
        if (typeof window !== 'undefined' && window.fetch) {
          // H5端使用fetch API支持流式响应
          window.fetch(requestUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify(requestData)
          }).then(response => {
            console.log('收到流式响应:', response.status, response.headers.get('Content-Type'));

            // 检查响应状态
            if (!response.ok) {
              throw new Error(`HTTP错误! 状态: ${response.status}`);
            }

            // 获取Reader并处理流
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = '';

            // 读取数据流函数
            const readStream = async () => {
              try {
                while (true) {
                  const { done, value } = await reader.read();

                  if (done) {
                    console.log('流读取完成');

                    // 处理可能遗留在缓冲区的不完整消息
                    if (buffer.trim()) {
                      console.log('处理缓冲区剩余数据:', buffer);
                      const conversationId = this.processMessageV2(buffer, tempAiMessageId);
                      if (conversationId && shouldCreateNewConversation) {
                        receivedConversationId = conversationId;
                      }
                    }

                    // 如果从未收到任何内容，提供反馈
                    if (!hasReceivedContent) {
                      const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                      if (index !== -1) {
                        this.$set(this.messages[index], 'content', '抱歉，未能获取到AI的回复。');
                        this.$set(this.messages[index], 'isError', true);
                      }
                    }

                    // 完成处理
                    const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                    if (index !== -1) {
                      this.$set(this.messages[index], 'isStreaming', false);
                      this.$set(this.messages[index], 'isLoading', false);
                      // 清除等待消息
                      if (this.messages[index].waitingMessage) {
                        this.$set(this.messages[index], 'waitingMessage', null);
                      }
                    }

                    // 如果需要创建新会话并且获得了会话ID
                    if (shouldCreateNewConversation && receivedConversationId) {
                      console.log('创建新会话，Dify会话ID:', receivedConversationId);
                      this.createNewConversation(receivedConversationId, messageContent);
                    }

                    this.isWaitingResponse = false;
                    this.loadingMessageId = null;

                    clearTimeout(timeoutId);
                    break;
                  }

                  // 解码数据
                  const chunk = decoder.decode(value, { stream: true });
                  console.log('收到数据块[原始]:', chunk);

                  // 如果收到内容而且显示了超时警告，则移除警告
                  if (chunk.trim() && timeoutWarningShown) {
                    const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                    if (index !== -1 && this.messages[index].waitingMessage) {
                      this.$set(this.messages[index], 'waitingMessage', null);
                    }
                  }

                  // 合并到缓冲区并查找完整消息
                  buffer += chunk;

                  // 检查是否为JSON格式分块
                  try {
                    const data = JSON.parse(buffer);
                    console.log('解析为单个JSON对象:', data);

                    // 忽略ping事件
                    if (data.event === 'ping') {
                      console.log('收到ping事件，忽略');
                      buffer = '';
                      continue;
                    }

                    // 检查并保存会话ID
                    if (data.conversation_id && shouldCreateNewConversation) {
                      receivedConversationId = data.conversation_id;
                      console.log('从单JSON响应中提取会话ID:', receivedConversationId);
                    }

                    // 处理单一JSON对象
                    if (data.event === 'message' || data.event === 'agent_message') {
                      hasReceivedContent = true;
                      const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                      if (index !== -1) {
                        const content = data.answer || data.content || '';
                        this.$set(this.messages[index], 'content',
                          this.messages[index].content + content);
                        this.$set(this.messages[index], 'isLoading', false);
                        // 清除等待消息
                        if (this.messages[index].waitingMessage) {
                          this.$set(this.messages[index], 'waitingMessage', null);
                        }
                      }
                    }

                    // 清空缓冲区
                    buffer = '';
                    continue;
                  } catch (e) {
                    // 非单个JSON对象，尝试SSE格式解析
                  }

                  // 查找SSE消息分隔符
                  const messages = buffer.split('\n\n');

                  // 处理所有完整的消息
                  for (let i = 0; i < messages.length - 1; i++) {
                    if (messages[i].trim()) {
                      const conversationId = this.processMessageV2(messages[i], tempAiMessageId);
                      if (conversationId && shouldCreateNewConversation) {
                        receivedConversationId = conversationId;
                        console.log('从SSE格式响应中提取会话ID:', receivedConversationId);
                      }

                      if (messages[i].includes('"event":"message"') ||
                        messages[i].includes('"event":"agent_message"') ||
                        messages[i].includes('"answer":')) {
                        hasReceivedContent = true;
                      }
                    }
                  }

                  // 保留最后可能不完整的消息
                  buffer = messages[messages.length - 1];
                }
              } catch (error) {
                console.error('流读取错误:', error);

                // 清除超时
                clearTimeout(timeoutId);

                // 更新消息为错误状态
                const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                if (index !== -1) {
                  this.$set(this.messages[index], 'isError', true);
                  this.$set(this.messages[index], 'isLoading', false);
                  this.$set(this.messages[index], 'content', '消息接收出错: ' + error.message);
                  // 清除等待消息
                  if (this.messages[index].waitingMessage) {
                    this.$set(this.messages[index], 'waitingMessage', null);
                  }
                }

                this.isWaitingResponse = false;
                this.loadingMessageId = null;
              }
            };

            // 开始读取流
            readStream();

          }).catch(error => {
            console.error('流式请求失败:', error);

            // 清除超时
            clearTimeout(timeoutId);

            // 更新消息为错误状态
            const index = this.messages.findIndex(m => m.id === tempAiMessageId);
            if (index !== -1) {
              this.$set(this.messages[index], 'isError', true);
              this.$set(this.messages[index], 'isLoading', false);
              this.$set(this.messages[index], 'content', '发送请求失败: ' + error.message);
              // 清除等待消息
              if (this.messages[index].waitingMessage) {
                this.$set(this.messages[index], 'waitingMessage', null);
              }
            }

            this.isWaitingResponse = false;
            this.loadingMessageId = null;
          });
        } else {
        // #endif
          // APP端或其他环境，使用uni.request（非流式）
          uni.request({
            url: requestUrl,
            method: 'POST',
            header: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            data: requestData,
            success: (res) => {
              console.log('收到响应:', res.statusCode, res.data);
              
              // 清除超时
              clearTimeout(timeoutId);
              
              if (res.statusCode === 200 && res.data) {
                try {
                  let responseData = res.data;
                  let fullAiContent = '';
                  
                  // 如果收到的是字符串（SSE格式），需要解析
                  if (typeof responseData === 'string') {
                    console.log('解析SSE格式数据...');
                    
                    // 分割SSE数据块
                    const dataBlocks = responseData.split('\n\n');
                    
                    for (const block of dataBlocks) {
                      if (block.trim() && block.includes('data:')) {
                        try {
                          // 提取JSON部分
                          const jsonMatch = block.match(/data:\s*(.+)/);
                          if (jsonMatch && jsonMatch[1]) {
                            const data = JSON.parse(jsonMatch[1]);
                            
                            // 忽略ping事件和结束事件
                            if (data.event === 'ping' || data.event === 'message_end') {
                              continue;
                            }
                            
                            // 提取并累积内容
                            if (data.answer) {
                              fullAiContent += data.answer;
                            }
                            
                            // 保存会话ID（如果需要创建新会话）
                            if (data.conversation_id && shouldCreateNewConversation) {
                              receivedConversationId = data.conversation_id;
                            }
                          }
                        } catch (parseError) {
                          console.warn('解析数据块失败:', parseError, block.substring(0, 100));
                        }
                      }
                    }
                    
                    console.log('提取的AI内容:', fullAiContent);
                  } else if (typeof responseData === 'object') {
                    // 如果收到的是对象格式
                    fullAiContent = responseData.answer || responseData.message || responseData.content || '';
                    
                    if (responseData.conversation_id && shouldCreateNewConversation) {
                      receivedConversationId = responseData.conversation_id;
                    }
                  }
                  
                  // 实现APP端流式打字机效果
                  hasReceivedContent = true;
                  const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                  if (index !== -1 && fullAiContent.trim()) {
                    // 清除等待消息和加载状态
                    this.$set(this.messages[index], 'isLoading', false);
                    this.$set(this.messages[index], 'waitingMessage', null);
                    
                    // 实现打字机效果
                    this.simulateStreamingEffect(index, fullAiContent, tempAiMessageId);
                    
                    console.log('APP端开始流式显示，内容长度:', fullAiContent.length);
                  } else {
                    // 没有内容或找不到消息
                    if (index !== -1) {
                      this.$set(this.messages[index], 'content', '收到回复但解析失败');
                      this.$set(this.messages[index], 'isLoading', false);
                      this.$set(this.messages[index], 'isStreaming', false);
                    }
                  }
                  
                  // 处理会话ID
                  if (receivedConversationId && shouldCreateNewConversation) {
                    console.log('APP端创建新会话，会话ID:', receivedConversationId);
                    // 延迟创建会话，等流式效果完成
                    setTimeout(() => {
                      this.createNewConversation(receivedConversationId, messageContent);
                    }, fullAiContent.length * 20 + 1000); // 根据内容长度计算延迟
                  }
                  
                } catch (processError) {
                  console.error('处理响应数据失败:', processError);
                  
                  // 更新为错误状态
                  const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                  if (index !== -1) {
                    this.$set(this.messages[index], 'isError', true);
                    this.$set(this.messages[index], 'isLoading', false);
                    this.$set(this.messages[index], 'content', '响应解析失败: ' + processError.message);
                  }
                }
              } else {
                // 错误处理
                const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                if (index !== -1) {
                  this.$set(this.messages[index], 'isError', true);
                  this.$set(this.messages[index], 'isLoading', false);
                  this.$set(this.messages[index], 'content', `请求失败: ${res.statusCode}`);
                }
              }
              
              // 注意：不在这里设置 isWaitingResponse = false，因为流式效果还在进行
              // 状态将在 simulateStreamingEffect 完成后设置
            },
            fail: (error) => {
              console.error('请求失败:', error);
              
              // 清除超时
              clearTimeout(timeoutId);
              
              // 更新消息为错误状态
              const index = this.messages.findIndex(m => m.id === tempAiMessageId);
              if (index !== -1) {
                this.$set(this.messages[index], 'isError', true);
                this.$set(this.messages[index], 'isLoading', false);
                this.$set(this.messages[index], 'content', '发送请求失败: ' + (error.errMsg || '网络错误'));
                
                // 清除等待消息
                if (this.messages[index].waitingMessage) {
                  this.$set(this.messages[index], 'waitingMessage', null);
                }
              }
              
              this.isWaitingResponse = false;
              this.loadingMessageId = null;
            }
          });
        // #ifdef H5
        }
        // #endif

      } catch (error) {
        console.error('发送流式消息失败:', error);
        this.isWaitingResponse = false;
        this.loadingMessageId = null;

        uni.showToast({
          title: '发送失败: ' + (error.message || '未知错误'),
          icon: 'none',
          duration: 2000
        });
      }
    },

    // 新增方法：增强的SSE消息处理
    processMessageV2(message, tempAiMessageId) {
      try {
        console.log('处理SSE消息:', message);

        // 忽略ping事件
        if (message.includes('event: ping') || message.includes('"event":"ping"')) {
          console.log('忽略ping事件');
          return null;
        }

        // 存储可能找到的会话ID
        let conversationId = null;

        // 检查是否为SSE格式
        if (message.startsWith('data:')) {
          const jsonText = message.slice(5).trim();
          console.log('提取的JSON文本:', jsonText);

          try {
            const data = JSON.parse(jsonText);
            console.log('解析的JSON数据:', data);

            // 忽略ping事件
            if (data.event === 'ping') {
              console.log('忽略ping事件');
              return null;
            }

            // 提取会话ID
            if (data.conversation_id) {
              conversationId = data.conversation_id;
              console.log('提取会话ID:', conversationId);
            }

            // 跳过结束事件
            if (data.event === 'message_end') {
              console.log('收到结束事件');
              return conversationId;
            }

            // 提取内容
            let content = '';
            if (data.event === 'message' || data.event === 'agent_message') {
              content = data.answer || data.content || '';
            } else if (data.answer) {
              content = data.answer;
            } else if (data.content) {
              content = data.content;
            } else {
              console.log('未找到可显示的内容:', data);
              return conversationId;
            }

            console.log('提取的内容:', content);

            // 更新UI消息
            const index = this.messages.findIndex(m => m.id === tempAiMessageId);
            if (index !== -1) {
              console.log('发现目标消息，更新内容');

              // 清除等待消息
              if (this.messages[index].waitingMessage) {
                this.$set(this.messages[index], 'waitingMessage', null);
              }

              // 追加内容
              this.$set(this.messages[index], 'content',
                this.messages[index].content + content);
              this.$set(this.messages[index], 'isLoading', false);

              // 强制更新视图和滚动
              this.$forceUpdate();
              this.scrollToBottom();
            } else {
              console.warn('未找到对应的消息:', tempAiMessageId);
            }
          } catch (e) {
            console.error('JSON解析失败:', e, '原始文本:', jsonText);
            try {
              // 尝试直接提取和显示文本
              const textMatch = message.match(/data:\s*"(.*)"/);
              if (textMatch && textMatch[1]) {
                console.log('直接提取文本:', textMatch[1]);

                const index = this.messages.findIndex(m => m.id === tempAiMessageId);
                if (index !== -1) {
                  this.$set(this.messages[index], 'content',
                    this.messages[index].content + textMatch[1]);
                  this.$set(this.messages[index], 'isLoading', false);
                  // 清除等待消息
                  if (this.messages[index].waitingMessage) {
                    this.$set(this.messages[index], 'waitingMessage', null);
                  }
                }
              }
            } catch (textErr) {
              console.error('直接文本提取失败:', textErr);
            }
          }
        } else {
          console.warn('收到非SSE格式消息:', message);
          // 尝试直接解析
          try {
            const data = JSON.parse(message);
            console.log('直接解析JSON:', data);

            // 忽略ping事件
            if (data.event === 'ping') {
              console.log('忽略ping事件');
              return null;
            }

            const content = data.answer || data.content || data.text;
            if (content) {
              const index = this.messages.findIndex(m => m.id === tempAiMessageId);
              if (index !== -1) {
                this.$set(this.messages[index], 'content',
                  this.messages[index].content + content);
                this.$set(this.messages[index], 'isLoading', false);
                // 清除等待消息
                if (this.messages[index].waitingMessage) {
                  this.$set(this.messages[index], 'waitingMessage', null);
                }
              }
            }
          } catch (e) {
            console.error('非JSON格式解析失败:', e);
          }
        }

        return conversationId;
      } catch (error) {
        console.error('处理消息错误:', error);
        return null;
      }
    },

    // 添加新方法：创建新会话
    async createNewConversation(difyConversationId, firstMessage) {
      try {
        console.log('创建新会话, Dify会话ID:', difyConversationId);
        if (!difyConversationId) {
          console.error('创建新会话失败: 缺少Dify会话ID');
          return;
        }

        // 获取当前选择的模型ID
        const modelId = this.currentModel.id || this.currentModel;
        if (!modelId) {
          console.error('创建新会话失败: 缺少模型ID');
          return;
        }

        // 生成会话标题（使用消息内容的前30个字符）
        const title = firstMessage && firstMessage.length > 0
          ? (firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage)
          : '新对话';

        // 调用API创建会话
        const response = await chatApi.createConversation(modelId, difyConversationId, title);

        if (response.success && response.data) {
          console.log('成功创建会话:', response.data);

          // 更新当前会话信息
          this.currentChatId = response.data.id;
          this.currentConversation = response.data;

          // 通知侧边栏刷新会话列表
          uni.$emit('refresh-chat-history');

          // 更新页面标题
          if (typeof document !== 'undefined') {
            document.title = `${title} - AI Park`;
          }

          // 显示成功提示
          uni.showToast({
            title: '已创建新会话',
            icon: 'none',
            duration: 1500
          });
        } else {
          console.error('创建会话失败:', response);
        }
      } catch (error) {
        console.error('创建新会话出错:', error);
      }
    },

    copyMessage(msg) {
      // 使用Clipboard API或uni.setClipboardData
      uni.setClipboardData({
        data: msg.content,
        success: () => {
          uni.showToast({
            title: '已复制到剪贴板',
            icon: 'none'
          });
        },
        fail: () => {
          uni.showToast({
            title: '复制失败',
            icon: 'none'
          });
        }
      });
    },

    // 点赞消息
    async likeMessage(msg) {
      if (!this.isLoggedIn) {
        this.showLoginPopup = true;
        return;
      }

      try {
        const response = await chatApi.messageAction(msg.id, 'like');
        if (response.success) {
          // 更新本地消息点赞数
          const index = this.messages.findIndex(m => m.id === msg.id);
          if (index !== -1) {
            this.messages[index].likes = (this.messages[index].likes || 0) + 1;

            uni.showToast({
              title: '点赞成功',
              icon: 'none'
            });
          }
        }
      } catch (error) {
        console.error('点赞失败:', error);
        uni.showToast({
          title: '点赞失败',
          icon: 'none'
        });
      }
    },

    // 踩消息
    async dislikeMessage(msg) {
      if (!this.isLoggedIn) {
        this.showLoginPopup = true;
        return;
      }

      try {
        const response = await chatApi.messageAction(msg.id, 'dislike');
        if (response.success) {
          // 更新本地消息踩数
          const index = this.messages.findIndex(m => m.id === msg.id);
          if (index !== -1) {
            this.messages[index].dislikes = (this.messages[index].dislikes || 0) + 1;

            uni.showToast({
              title: '反馈已提交',
              icon: 'none'
            });
          }
        }
      } catch (error) {
        console.error('反馈提交失败:', error);
        uni.showToast({
          title: '反馈提交失败',
          icon: 'none'
        });
      }
    },

    handleInputFocus() {
      this.isInputExpanded = true;
    },
    handleInputBlur() {
      if (!this.inputMessage) {
        this.isInputExpanded = false;
      }
    },
    handleSortChange(type) {
      this.sortType = type;
    },
    // 添加统一的登录弹窗处理方法
    handleShowLogin(phone = '') {
      console.log('收到登录弹窗事件，手机号:', phone);
      this.loginInitialPhone = phone || '';
      this.showLoginPopup = true;
    },

    // 优化关闭弹窗的处理方法
    handleLoginPopupClose() {
      this.showLoginPopup = false;
      this.loginInitialPhone = '';
    },

    // 获取消息头像
    getMessageAvatar(message) {
      if (message.type === 'user') {
        // 用户头像 - 从用户信息中获取或使用默认头像
        console.log('获取用户头像', this.userInfo.avatar || '/static/icons/person-circle.svg');
        return this.userInfo.avatar || '/static/icons/person-circle.svg';
      } else {
        // AI头像 - 根据当前选择的模型返回对应的模型图标
        const model = [...this.freeModels, ...this.paidModels].find(m => m.id === this.currentModel);
        console.log('获取AI头像', model?.icon_path || '/static/icons/robot.svg');
        return model?.icon_path || '/static/icons/robot.svg';
      }
    },

    // 滚动到底部
    scrollToBottom() {
      this.$nextTick(() => {
        // 只在浏览器环境中使用document
        if (typeof document === 'undefined') {
          return;
        }
        
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
          try {
            // 获取容器高度和内容高度
            const scrollHeight = messagesContainer.scrollHeight;
            const visibleHeight = messagesContainer.clientHeight;

            // 如果内容高度大于可见区域高度，才需要滚动
            if (scrollHeight > visibleHeight) {
              messagesContainer.scrollTo({
                top: scrollHeight,
                behavior: 'smooth'
              });
            }
          } catch (e) {
            // 降级处理：直接设置 scrollTop
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      });
    },

    // 使用快速提示
    async useQuickPrompt(promptText) {
      console.log('使用快速提示:', promptText);

      // 先检查是否可以发送消息
      if (this.isWaitingResponse) {
        uni.showToast({
          title: '请等待当前消息响应完成',
          icon: 'none'
        });
        return;
      }

      if (!this.isLoggedIn) {
        this.showLoginPopup = true;
        return;
      }

      // 设置输入框内容
      this.inputMessage = promptText;

      // 等待DOM更新
      await this.$nextTick();

      // 直接调用发送消息方法
      try {
        await this.sendMessage();
      } catch (error) {
        console.error('快速提示发送失败:', error);

        // 检查是否是登录失效错误
        if (error.message && (
          error.message.includes('用户信息无效') ||
          error.message.includes('用户未登录') ||
          error.message.includes('请重新登录')
        )) {
          // 显示友好提示
          uni.showToast({
            title: '登录已失效，请重新登录',
            icon: 'none',
            duration: 2000
          });

          // 延迟显示登录弹窗，让toast先显示
          setTimeout(() => {
            this.showLoginPopup = true;
          }, 1500);

          // 清除本地登录状态
          uni.removeStorageSync('isLoggedIn');
          uni.removeStorageSync('userInfo');
          this.isLoggedIn = false;
          this.userInfo = {};
        }
      }
    },

    // 处理网络错误
    handleNetworkError(error) {
      console.error('网络请求错误:', error);

      // 显示网络错误提示
      uni.showToast({
        title: '网络连接异常，请检查网络设置',
        icon: 'none',
        duration: 3000
      });

      // 如果正在等待响应，添加错误提示消息
      if (this.isWaitingResponse) {
        const errorMessage = {
          id: `network_error_${Date.now()}`,
          type: 'ai',
          content: '网络连接异常，请检查您的网络设置后重试。',
          created_at: new Date().toISOString(),
          isError: true
        };
        this.messages.push(errorMessage);
        this.scrollToBottom();

        // 重置状态
        this.loadingMessageId = null;
        this.isWaitingResponse = false;
      }
    },

    // 监听键盘事件（适用于H5端）
    setupKeyboardListeners() {
      // 只在浏览器环境中添加事件监听
      if (typeof document !== 'undefined') {
        document.addEventListener('keydown', this.handleKeyDown);
      }
    },

    // 处理键盘事件
    handleKeyDown(event) {
      // 只在浏览器环境中处理
      if (typeof document === 'undefined') {
        return;
      }
      
      // 检查焦点是否在输入框上，如果是则不处理全局快捷键
      const activeElement = document.activeElement;
      if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
        return; // 让InputArea组件处理
      }

      // Escape键关闭弹窗
      if (event.key === 'Escape') {
        if (this.showModelSelect) {
          this.showModelSelect = false;
          event.preventDefault();
        } else if (this.showLoginPopup) {
          this.handleLoginPopupClose();
          event.preventDefault();
        }
      }

      // 根据设置处理发送消息的快捷键（只在没有输入焦点时）
      const shouldSend = this.shouldSendMessage(event);
      if (shouldSend) {
        // 如果有消息可发送且不在等待响应状态
        if (this.inputMessage.trim() && !this.isWaitingResponse) {
          this.sendMessage();
          event.preventDefault();
        }
      }
    },

    // 判断是否应该发送消息
    shouldSendMessage(event) {
      // Shift+Enter 始终是换行，不发送
      if (event.shiftKey && event.key === 'Enter') {
        return false;
      }

      // 固定使用Enter发送（不带修饰键）
      return event.key === 'Enter' && !event.ctrlKey && !event.altKey && !event.metaKey;
    },

    // 当前会话模型名称
    getCurrentModelName() {
      if (!this.currentModel) return '默认AI助手';

      const model = [...this.freeModels, ...this.paidModels].find(m => m.id === this.currentModel);
      return model ? model.display_name : '默认AI助手';
    },

    // 初始化事件源连接（用于流式响应）
    initStreamConnection(conversationId, messageId) {
      // 关闭可能存在的连接
      if (this.activeEventSource) {
        this.activeEventSource.close();
      }

      // 构建事件源URL - 使用配置中的API基础URL
      const token = uni.getStorageSync('token');
      const url = `${config.apiBaseUrl}/api/chat/messages/${messageId}/stream/?conversation_id=${conversationId}`;

      const eventSource = new EventSource(url, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });

      // 初始化空的AI回复
      const streamingMessage = {
        id: messageId,
        type: 'ai',
        content: '',
        created_at: new Date().toISOString(),
        isStreaming: true
      };

      // 添加消息到列表
      this.messages.push(streamingMessage);
      this.scrollToBottom();

      // 记录消息在数组中的索引，用于快速更新
      const messageIndex = this.messages.length - 1;

      // 设置事件监听器
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 更新消息内容
          if (data.content) {
            this.messages[messageIndex].content += data.content;
            this.scrollToBottom();
          }
        } catch (err) {
          console.error('流式响应解析失败:', err);
        }
      };

      // 错误处理
      eventSource.onerror = (error) => {
        console.error('流式响应错误:', error);
        eventSource.close();

        // 移除流式状态
        this.messages[messageIndex].isStreaming = false;
        this.isWaitingResponse = false;

        // 检查是否还没有收到任何内容
        if (!this.messages[messageIndex].content) {
          this.messages[messageIndex].content = '抱歉，响应生成失败，请重试。';
          this.messages[messageIndex].isError = true;
        }
      };

      // 完成事件
      eventSource.addEventListener('complete', () => {
        // 流式响应完成
        eventSource.close();
        this.messages[messageIndex].isStreaming = false;
        this.isWaitingResponse = false;
      });

      // 保存活跃的事件源
      this.activeEventSource = eventSource;

      return eventSource;
    },

    // 处理长按操作（移动端）
    handleLongPress(msg) {
      // 显示操作菜单
      uni.showActionSheet({
        itemList: msg.type === 'user' ? ['复制'] : ['复制', '重新生成', '点赞', '不喜欢'],
        success: (res) => {
          const index = res.tapIndex;

          // 用户消息只有复制选项
          if (msg.type === 'user') {
            if (index === 0) this.copyMessage(msg);
          } else {
            // AI消息有更多选项
            switch (index) {
              case 0: this.copyMessage(msg); break;
              case 1: this.regenerateMessage(msg); break;
              case 2: this.likeMessage(msg); break;
              case 3: this.dislikeMessage(msg); break;
            }
          }
        }
      });
    },

    // 添加新方法处理登录提示
    handleLoginPrompt() {
      this.showLoginPopup = true;
    },

    // 添加登出处理方法
    handleLogout() {
      // 清除对话相关状态
      this.messages = [];
      this.currentChatId = '';
      this.currentChat = null;
      this.conversations = [];
      this.inputMessage = '';
      this.isLoggedIn = false;
      this.userInfo = {};

      // 重置其他状态
      this.isWaitingResponse = false;
      this.loadingMessageId = null;

      // 发送全局登出事件，通知其他组件清理状态
      uni.$emit('user-logged-out');

      // 显示欢迎界面
      this.$nextTick(() => {
        this.hasMessages = false;
      });
    },

    // 中断生成
    stopGenerating() {
      if (!this.isWaitingResponse) return;

      // 使用流式组件中断请求
      const chatStream = require('@/utils/chatStream').default;
      chatStream.stop();

      // 查找正在生成的消息
      const loadingMsgIndex = this.messages.findIndex(m => m.id === this.loadingMessageId);
      if (loadingMsgIndex !== -1) {
        this.messages[loadingMsgIndex].content += '\n[用户中断了生成]';
        this.messages[loadingMsgIndex].isLoading = false;
        this.messages[loadingMsgIndex].isStreaming = false;
      }

      this.isWaitingResponse = false;
      this.loadingMessageId = null;
    },

    // 处理选择聊天记录
    async handleSelectConversation(conversation) {
      console.log('选择会话:', conversation);

      // 如果正在加载消息，先取消之前的加载
      if (this.loadingMessageId) {
        this.cancelCurrentGeneration();
      }

      // 保存当前会话信息
      this.currentConversation = conversation;

      // 设置当前使用的模型
      if (conversation.model_id) {
        this.currentModel = {
          id: conversation.model_id,
          name: conversation.model_name || '通用模型'
        };
      }

      // 清空当前消息列表，准备加载新对话记录
      this.messages = [];

      // 显示加载状态
      this.messagesLoading = true;

      try {
        // 加载历史消息
        await this.loadConversationMessages(conversation.id);

        // 更新页面标题
        if (typeof document !== 'undefined') {
          document.title = `${conversation.title || '新对话'} - AI Park`;
        }
      } catch (error) {
        console.error('加载会话消息失败:', error);
        uni.showToast({
          title: '加载聊天记录失败',
          icon: 'none'
        });
      } finally {
        this.messagesLoading = false;
      }
    },

    // 加载会话消息历史
    async loadConversationMessages(conversationId, firstId = null) {
      try {
        const response = await chatApi.getMessages(conversationId, this.messagePagination.limit, firstId);

        if (response.success) {
          // 根据Dify API格式处理接收到的消息
          const messages = response.data || [];

          // 格式化消息
          const formattedMessages = messages.map(msg => ({
            id: msg.id,
            type: msg.query ? 'user' : 'ai',
            content: msg.query || msg.answer,
            timestamp: msg.created_at * 1000, // 转换为毫秒
            feedback: msg.feedback,
            files: msg.message_files || [],
            agentThoughts: msg.agent_thoughts || []
          }));

          // 如果是首次加载，直接替换
          if (!firstId) {
            this.messages = formattedMessages;
          } else {
            // 如果是加载更多，添加到现有消息列表前面
            this.messages = [...formattedMessages, ...this.messages];
          }

          // 更新分页信息
          this.hasMoreMessages = response.has_more || false;

          // 如果有消息，更新firstId为第一条消息的ID
          if (formattedMessages.length > 0) {
            this.messagePagination.firstId = formattedMessages[0].id;
          }
        } else {
          console.error('获取消息返回错误:', response.message);
        }
      } catch (error) {
        console.error('加载会话消息失败:', error);
        throw error;
      }
    },

    // 清空当前会话
    clearCurrentConversation() {
      this.currentConversation = null;
      this.messages = [];
      this.hasMoreMessages = false;
      this.messagePagination.firstId = null;
      if (typeof document !== 'undefined') {
        document.title = 'AI Park';
      }
    },

    // 处理发送消息 - 修改以适配当前会话
    async handleSendMessage(messageText) {
      // 如果没有选择模型，提示用户
      if (!this.currentModel) {
        uni.showToast({
          title: '请先选择AI模型',
          icon: 'none'
        });
        return;
      }

      try {
        // 生成临时消息ID
        const tempUserMsgId = 'user-' + Date.now();
        const tempAiMsgId = 'ai-' + Date.now();

        // 添加用户消息到列表
        this.messages.push({
          id: tempUserMsgId,
          type: 'user',
          content: messageText,
          timestamp: Date.now()
        });

        // 添加AI临时消息（加载中状态）
        this.messages.push({
          id: tempAiMsgId,
          type: 'ai',
          content: '',
          timestamp: Date.now(),
          loading: true
        });

        // 设置加载状态
        this.loadingMessageId = tempAiMsgId;

        // 滚动到底部
        this.$nextTick(() => {
          this.scrollToBottom();
        });

        // 准备请求参数
        const requestParams = {
          model_id: this.currentModel.id,
          query: messageText,
          stream: true
        };

        // 如果是现有会话，添加conversationId
        if (this.currentConversation && this.currentConversation.id) {
          requestParams.conversation_id = this.currentConversation.id;
        }

        // 发送流式请求
        this.currentStreamRequest = await chatApi.sendStreamMessage(requestParams, {
          onMessage: (data) => {
            // 更新AI回复内容
            const index = this.messages.findIndex(m => m.id === tempAiMsgId);
            if (index !== -1) {
              // 向现有内容添加新块
              this.messages[index].content += data.answer || '';
            }
          },
          onComplete: (data) => {
            // 完成时的处理
            const index = this.messages.findIndex(m => m.id === tempAiMsgId);
            if (index !== -1) {
              // 更新消息状态和ID
              this.messages[index].loading = false;
              this.messages[index].id = data.message_id;

              // 如果是新对话，更新对话信息
              if (!this.currentConversation) {
                // 触发刷新聊天历史列表
                uni.$emit('refresh-chat-history');

                // TODO: 获取新创建的会话详情
                this.getNewConversationDetails(data.conversation_id);
              }
            }

            // 清除加载状态
            this.loadingMessageId = null;
          },
          onError: (error) => {
            console.error('消息发送错误:', error);

            // 显示错误提示
            uni.showToast({
              title: '消息发送失败',
              icon: 'none'
            });

            // 标记消息发送失败
            const index = this.messages.findIndex(m => m.id === tempAiMsgId);
            if (index !== -1) {
              this.messages[index].error = true;
              this.messages[index].errorMessage = error.message || '发送失败';
            }

            // 清除加载状态
            this.loadingMessageId = null;
          }
        });

      } catch (error) {
        console.error('发送消息失败:', error);
        uni.showToast({
          title: error.message || '发送消息失败',
          icon: 'none'
        });

        // 清除加载状态
        this.loadingMessageId = null;
      }
    },

    // 获取新创建的会话详情
    async getNewConversationDetails(conversationId) {
      try {
        const response = await chatApi.getConversationDetail(conversationId);

        if (response.success && response.data) {
          this.currentConversation = response.data;

          // 更新页面标题
          if (typeof document !== 'undefined') {
            document.title = `${response.data.title || '新对话'} - AI Park`;
          }
        }
      } catch (error) {
        console.error('获取新会话详情失败:', error);
      }
    },

    // 取消当前生成
    cancelCurrentGeneration() {
      if (this.currentStreamRequest && this.currentStreamRequest.stop) {
        this.currentStreamRequest.stop();
        this.currentStreamRequest = null;
      }

      // 清除加载状态
      this.loadingMessageId = null;
    },
    
    // 添加创建新对话的处理方法
    handleCreateNewChat() {
      console.log('创建新对话');
      
      // 重置当前会话状态
      this.currentChatId = '';
      this.currentChat = null;
      this.messages = [];
      
      // 如果侧边栏打开，折叠它（移动端优化）
      if (this.isMobile && !this.isSidebarCollapsed) {
        this.isSidebarCollapsed = true;
        uni.setStorageSync('sidebarState', true);
      }
      
      // 更新页面标题
      if (typeof document !== 'undefined') {
        document.title = 'AI Park - 新对话';
      }
      
      // 聚焦输入框
      this.$nextTick(() => {
        if (this.$refs.inputArea) {
          this.$refs.inputArea.focus();
        }
      });
    },

    // 处理移动端模型选择
    handleMobileModelSelect(model) {
      console.log('选择模型:', model);
      
      // 检查是否切换到了不同的模型
      const previousModel = this.currentModel;
      const newModelId = String(model.id);
      
      // 更新当前模型
      this.currentModel = newModelId;
      this.showMobileModels = false;
      
      // 保存到本地存储
      uni.setStorageSync('selected_model', model.id);
      
      // 显示成功提示
      uni.showToast({
        title: `已切换到 ${model.display_name || model.name}`,
        icon: 'none',
        duration: 2000
      });
      
      // 发出事件通知其他组件
      uni.$emit('model-changed', model);
      
      // 如果切换到了不同的模型，自动开始新对话
      if (previousModel !== newModelId) {
        console.log('模型已切换，开始新对话');
        this.handleCreateNewChat();
        
        // 显示额外提示
        setTimeout(() => {
          uni.showToast({
            title: '已开始新对话',
            icon: 'none',
            duration: 1500
          });
        }, 2200); // 稍微延迟，避免与模型切换提示重叠
      }
    },

    // 重新生成消息
    async regenerateMessage(message) {
      console.log('重新生成消息:', message);
      
      if (this.isWaitingResponse) {
        uni.showToast({
          title: '请等待当前消息完成',
          icon: 'none'
        });
        return;
      }

      if (!this.isLoggedIn) {
        this.showLoginPopup = true;
        return;
      }

      try {
        // 找到要重新生成的消息位置
        const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
        if (messageIndex === -1) {
          console.error('未找到要重新生成的消息');
          return;
        }

        // 找到对应的用户消息（通常是AI消息的前一条）
        let userMessage = null;
        for (let i = messageIndex - 1; i >= 0; i--) {
          if (this.messages[i].type === 'user') {
            userMessage = this.messages[i];
            break;
          }
        }

        if (!userMessage) {
          console.error('未找到对应的用户消息');
          uni.showToast({
            title: '无法重新生成该消息',
            icon: 'none'
          });
          return;
        }

        // 设置重新生成状态
        this.messages[messageIndex].content = '';
        this.messages[messageIndex].isLoading = true;
        this.messages[messageIndex].isStreaming = true;
        this.loadingMessageId = message.id;
        this.isWaitingResponse = true;

        // 重新发送请求
        await this.sendMessageToAPI(userMessage.content, message.id);

      } catch (error) {
        console.error('重新生成消息失败:', error);
        
        // 恢复消息状态
        const messageIndex = this.messages.findIndex(msg => msg.id === message.id);
        if (messageIndex !== -1) {
          this.messages[messageIndex].isLoading = false;
          this.messages[messageIndex].isStreaming = false;
          this.messages[messageIndex].content = '重新生成失败，请稍后重试';
        }
        
        this.isWaitingResponse = false;
        this.loadingMessageId = null;
        
        uni.showToast({
          title: '重新生成失败',
          icon: 'none'
        });
      }
    },

    // 处理更新登录状态
    handleUpdateLoginStatus() {
      this.checkLoginStatus();
    },

    // 添加方法：模拟APP端流式打字机效果
    simulateStreamingEffect(messageIndex, fullContent, messageId) {
      let currentIndex = 0;
      const contentLength = fullContent.length;
      
      // 根据内容长度调整打字速度
      let typingSpeed = 20; // 默认每字符20ms
      if (contentLength > 500) {
        typingSpeed = 15; // 长内容加快速度
      } else if (contentLength > 1000) {
        typingSpeed = 10; // 很长内容更快
      }
      
      const typeNextChar = () => {
        if (currentIndex < contentLength) {
          // 检查消息是否还存在（防止用户切换页面等情况）
          const msgIndex = this.messages.findIndex(m => m.id === messageId);
          if (msgIndex === -1) {
            console.log('消息已被删除，停止流式效果');
            this.isWaitingResponse = false;
            this.loadingMessageId = null;
            return;
          }
          
          // 逐字添加内容
          const currentContent = fullContent.substring(0, currentIndex + 1);
          this.$set(this.messages[msgIndex], 'content', currentContent);
          
          // 每隔几个字符滚动到底部
          if (currentIndex % 10 === 0) {
            this.scrollToBottom();
          }
          
          currentIndex++;
          
          // 继续下一个字符
          setTimeout(typeNextChar, typingSpeed);
        } else {
          // 流式效果完成
          console.log('APP端流式效果完成');
          
          const msgIndex = this.messages.findIndex(m => m.id === messageId);
          if (msgIndex !== -1) {
            this.$set(this.messages[msgIndex], 'isStreaming', false);
          }
          
          // 重置状态
          this.isWaitingResponse = false;
          this.loadingMessageId = null;
          
          // 最后滚动到底部
          this.scrollToBottom();
        }
      };
      
      // 开始打字效果
      console.log('开始APP端流式打字效果，内容长度:', contentLength, '预计耗时:', (contentLength * typingSpeed / 1000).toFixed(1), '秒');
      typeNextChar();
    },

    // 新增方法：增强的SSE消息处理
  },

  // 添加计算属性
  computed: {
    // 判断是否有消息（用于控制欢迎界面和聊天界面的显示）
    hasMessages() {
      return this.messages && this.messages.length > 0;
    },

    // 计算当前会话标题
    conversationTitle() {
      if (this.currentChat && this.currentChat.title) {
        return this.currentChat.title;
      } else if (this.currentChatId) {
        return '未命名对话';
      } else {
        return `与${this.getCurrentModelName()}的对话`;
      }
    }
  },

  // 添加生命周期钩子，每次页面显示时检查登录状态
  onShow() {
    // 更新状态栏样式
    this.updateStatusBarStyle();
    
    // 检查登录状态和用户信息完整性
    const isLoggedIn = uni.getStorageSync('isLoggedIn');
    const userInfo = uni.getStorageSync('userInfo');

    console.log('页面显示，当前登录状态:', isLoggedIn, '用户信息:', userInfo);

    if (isLoggedIn && (!userInfo || !userInfo.id)) {
      console.warn('登录状态异常: 已登录但用户信息不完整');
      // 可以尝试修复用户信息或提示用户重新登录
    }

    // 监听登录成功事件
    uni.$on('login-success', (data) => {
      console.log('收到登录成功事件:', data);
      // 刷新页面数据或执行其他操作
    });

    // ...existing code...
  },
}
</script>

<style lang="scss">
@import '@/styles/global.scss';

.container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
  /* 移除之前的 padding-top，改用 status-bar-placeholder */
}

/* 状态栏占位符 */
.status-bar-placeholder {
  height: var(--status-bar-height);
  background: transparent;
  flex-shrink: 0;
  /* 支持刘海屏额外安全区域 */
  padding-top: constant(safe-area-inset-top);
  padding-top: env(safe-area-inset-top);
}

/* 强制移动端样式 - 当屏幕宽度小于等于768px时 */
@media screen and (max-width: 768px) {
  .container {
    flex-direction: column !important;
  }
  
  .header {
    padding: 0 16px !important;
    height: 56px !important;
  }
  
  .main-content {
    flex-direction: column !important;
  }
  
  .sidebar {
    display: none !important;
  }
  
  .chat-container {
    width: 100% !important;
    padding: 0 !important;
  }
  
  /* 确保移动端弹窗正确显示 */
  .mobile-models-popup,
  .mobile-history-popup,
  .mobile-settings-popup {
    display: flex !important;
  }
}

/* 强制触摸设备使用移动端样式 */
@media (pointer: coarse) {
  .container {
    flex-direction: column !important;
  }
  
  .sidebar {
    display: none !important;
  }
}

/* iPhone X 系列刘海屏适配 */
@supports (top: constant(safe-area-inset-top)) or (top: env(safe-area-inset-top)) {
  .container {
    /* 为刘海屏添加额外的顶部安全区域 */
    padding-top: constant(safe-area-inset-top);
    padding-top: env(safe-area-inset-top);
  }
  
  .main-content {
    /* 调整主内容区高度以适配刘海屏 */
    height: calc(100vh - 60px - constant(safe-area-inset-top) - constant(safe-area-inset-bottom));
    height: calc(100vh - 60px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  }
}

/* 底部安全区域适配（iPhone X Home Indicator） */
.safe-area-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
