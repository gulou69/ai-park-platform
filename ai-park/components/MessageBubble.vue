<template>
  <view class="message-container" :class="[isUser ? 'user-message' : 'ai-message']">
    <!-- AI头像 - 显示在左侧 -->
    <view class="avatar avatar-left" v-if="!isUser">
      <image :src="avatarSrc" mode="aspectFill" />
    </view>

    <view class="message" :class="[
      {
        'message-right': isUser,
        'message-left': !isUser,
        'loading': message.isLoading,
        'error-message': message.isError,
        'timeout-message': message.isTimeout
      },
      message.id ? 'message-id-' + message.id : ''
    ]">
      <view class="message-content">
        <!-- 消息内容 -->
        <view v-if="message.isLoading && !message.content" class="loading-indicator">
          <text class="dot-flashing"></text>
        </view>

        <!-- 单一内容区域，思考内容会直接在这里渲染 -->
        <view v-if="!message.isLoading || message.content" class="message-text selectable" v-html="formattedContent"
          @mouseup.stop @click.stop @copy.stop="handleCopyEvent"></view>

        <!-- 等待消息提示 -->
        <view v-if="message.waitingMessage" class="waiting-message">
          {{ message.waitingMessage }}
        </view>

        <!-- 消息时间戳 -->
        <view class="message-time">{{ formatTime(message.created_at) }}</view>

        <!-- AI消息的操作按钮 -->
        <view v-if="!isUser && !message.isLoading" class="message-actions">
          <button class="action-btn" @click.stop="handleCopyButtonClick" data-tooltip="复制">
            <image src="/static/icons/clipboard.svg" mode="aspectFit" />
          </button>
          <button class="action-btn" @click.stop="$emit('regenerate')" data-tooltip="重新生成">
            <image src="/static/icons/arrow-clockwise.svg" mode="aspectFit" />
          </button>
          <button class="action-btn" @click.stop="$emit('like')" data-tooltip="点赞">
            <image src="/static/icons/hand-thumbs-up.svg" mode="aspectFit" />
          </button>
          <button class="action-btn" @click.stop="$emit('dislike')" data-tooltip="不喜欢">
            <image src="/static/icons/hand-thumbs-down.svg" mode="aspectFit" />
          </button>
        </view>

        <!-- 用户消息的操作按钮 -->
        <view v-if="isUser" class="message-actions">
          <button class="action-btn" @click.stop="$emit('copy')" data-tooltip="复制">
            <image src="/static/icons/clipboard.svg" mode="aspectFit" />
          </button>
        </view>
      </view>
    </view>

    <!-- 用户头像 - 显示在右侧 -->
    <view class="avatar avatar-right" v-if="isUser">
      <image :src="avatarSrc" mode="aspectFill" />
    </view>
  </view>
</template>

<script>
// 改进MarkdownIt加载方式，确保全局唯一实例
let md = null;
try {
  // 检查环境是否支持require
  if (typeof require !== 'undefined') {
    const MarkdownIt = require('markdown-it');
    // 创建增强版MarkdownIt实例，特别处理代码块
    md = new MarkdownIt({
      html: true,      // 启用HTML标签，但会进行安全过滤
      linkify: true,    // 自动将URL转换为链接
      breaks: true,     // 将换行符转换为<br>
      typographer: true, // 启用智能标点
      highlight: function (str, lang) {
        // 增强代码块渲染，添加语言标识
        return `<div class="code-block-wrapper">
                  <div class="code-block-header">
                    ${lang ? `<span class="code-lang-tag">${lang}</span>` : ''}
                  </div>
                  <pre class="code-block language-${lang || 'plaintext'}"><code>${str}</code></pre>
                </div>`;
      }
    });

    // 使用安全设置
    md.set({ html: true, breaks: true });
  } else {
    console.warn('当前环境不支持require，将使用简单文本格式化');
  }
} catch (err) {
  console.warn('无法加载markdown-it，将使用简单文本显示:', err.message || err);
}

export default {
  props: {
    message: {
      type: Object,
      required: true
    },
    isUser: {
      type: Boolean,
      default: false
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    avatar: {
      type: String,
      default: '/static/icons/robot.svg'
    }
  },
  data() {
    return {
      thoughtStates: {}, // 存储各思考块的展开/收起状态
    };
  },
  computed: {
    formattedContent() {
      if (!this.message.content) return '';

      // 对于错误消息，直接返回文本
      if (this.message.isError || this.message.isTimeout) {
        return this.message.content;
      }

      try {
        // 获取消息内容
        let content = this.message.content;

        // 添加内容预处理逻辑
        // 确保换行符能正确被处理
        content = content.replace(/\\n/g, '\n');

        // 添加调试日志
        if (content.includes('#') || content.includes('*')) {
          console.log('检测到可能的Markdown格式:',
            content.substring(0, Math.min(100, content.length)) + '...');
        }

        // 在内容中查找并提取<think>标签
        const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
        let match;
        let lastIndex = 0;
        let result = '';
        let thoughtCount = 0;

        // 逐个处理每个<think>标签
        while ((match = thinkRegex.exec(content)) !== null) {
          // 将<think>标签之前的内容添加到结果中
          if (match.index > lastIndex) {
            const textBefore = content.substring(lastIndex, match.index);
            if (md) {
              // 确保先处理Markdown，再添加到结果
              const renderedText = md.render(textBefore);
              result += renderedText;
            } else {
              result += this.simpleFormat(textBefore);
            }
          }

          // 提取思考内容
          const thoughtText = match[1];
          const thoughtId = `thought-${this.message.id || 'temp'}-${thoughtCount++}`;

          // 检查此思考块的状态
          if (this.thoughtStates[thoughtId] === undefined) {
            this.$set(this.thoughtStates, thoughtId, false);
          }

          // 先用Markdown渲染思考内容
          let renderedThoughtContent = '';
          try {
            if (md) {
              console.log('使用MarkdownIt渲染思考内容');
              renderedThoughtContent = md.render(thoughtText);
            } else {
              renderedThoughtContent = this.simpleFormat(thoughtText);
            }
          } catch (e) {
            console.error('渲染思考内容失败:', e);
            renderedThoughtContent = this.simpleFormat(thoughtText);
          }

          // 创建思考块HTML (使用v-html安全渲染，无需转义)
          const isExpanded = this.thoughtStates[thoughtId];
          const thoughtHtml = `
            <div class="inline-thought" data-thought-id="${thoughtId}">
              <div class="thought-header" onclick="document.dispatchEvent(new CustomEvent('toggleThought',{detail:'${thoughtId}'}))">
                <img src="/static/icons/lightbulb.svg" class="thought-icon" />
                <span>思考过程</span>
                <img src="/static/icons/${isExpanded ? 'chevron-up' : 'chevron-down'}.svg" class="toggle-icon" />
              </div>
              <div class="thought-content ${isExpanded ? 'expanded' : 'collapsed'}">
                ${renderedThoughtContent}
              </div>
            </div>
          `;

          // 添加思考块到结果中
          result += thoughtHtml;

          // 更新lastIndex以继续处理后续内容
          lastIndex = match.index + match[0].length;
        }

        // 添加剩余内容
        if (lastIndex < content.length) {
          const remainingText = content.substring(lastIndex);
          if (md) {
            result += md.render(remainingText);
          } else {
            result += this.simpleFormat(remainingText);
          }
        }

        return result;
      } catch (e) {
        console.error('处理消息内容失败:', e);
        return this.simpleFormat(this.message.content);
      }
    },
    // 添加计算属性确保头像路径正确
    avatarSrc() {
      if (!this.avatar) {
        return this.isUser ? '/static/icons/person-circle.svg' : '/static/icons/robot.svg';
      }
      return this.avatar;
    }
  },
  mounted() {
    // 只在浏览器环境中添加事件监听
    if (typeof document !== 'undefined') {
      document.addEventListener('toggleThought', this.handleToggleThought);
    }

    // 添加copy事件监听
    this.addCopyEventListener();
  },
  beforeDestroy() {
    // 只在浏览器环境中移除事件监听
    if (typeof document !== 'undefined') {
      document.removeEventListener('toggleThought', this.handleToggleThought);
    }

    // 移除copy事件监听
    this.removeCopyEventListener();
  },
  methods: {
    // 处理思考块的展开/收起
    handleToggleThought(event) {
      const thoughtId = event.detail;
      // 确保思考ID属于当前消息
      if (thoughtId && thoughtId.includes(this.message.id || 'temp')) {
        this.$set(this.thoughtStates, thoughtId, !this.thoughtStates[thoughtId]);
      }
    },

    // 完全重写的simpleFormat方法，修复HTML渲染问题
    simpleFormat(text) {
      if (!text) return '';

      // 预处理文本，确保换行符能正确工作
      text = text.replace(/\\n/g, '\n');

      // 使用markdown-it库
      if (md) {
        try {
          console.log('使用markdown-it渲染内容');
          return md.render(text);
        } catch (e) {
          console.error('markdown-it渲染失败:', e);
          // 降级到基本处理
        }
      }

      // 基本处理逻辑（如果md不可用）
      // 第一步：提取代码块
      let formattedText = '';
      let lastIndex = 0;
      const codeBlockRegex = /```([a-zA-Z0-9]*)\n([\s\S]*?)```/g;
      let match;

      while ((match = codeBlockRegex.exec(text)) !== null) {
        // 处理代码块前的文本
        if (match.index > lastIndex) {
          formattedText += this.formatNormalText(text.substring(lastIndex, match.index));
        }

        // 提取代码块内容
        const language = match[1] || 'plaintext';
        const codeContent = match[2];

        // 存储代码块
        formattedText += `<pre class="code-block language-${language}"><code>${this.escapeHtml(codeContent)}</code></pre>`;

        lastIndex = match.index + match[0].length;
      }

      // 处理剩余文本
      if (lastIndex < text.length) {
        formattedText += this.formatNormalText(text.substring(lastIndex));
      }

      return formattedText;
    },

    // 新增方法：仅格式化普通文本部分
    formatNormalText(text) {
      if (!text) return '';

      // 转义HTML特殊字符
      const escaped = this.escapeHtml(text);

      // 应用基本Markdown格式
      return escaped
        // 处理标题
        .replace(/^(#{1,6})\s+(.*)$/gm, (match, hashes, content) => {
          const level = hashes.length;
          return `<h${level}>${content}</h${level}>`;
        })
        // 处理加粗
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // 处理斜体
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // 处理行内代码
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // 将换行符替换为<br>
        .replace(/\n/g, '<br>');
    },

    // HTML转义，防止XSS
    escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };

      return text.replace(/[&<>"']/g, m => map[m]);
    },

    // 格式化时间戳为易读形式
    formatTime(timestamp) {
      if (!timestamp) return '';

      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;

      // 今天的消息只显示时间
      if (diff < 24 * 60 * 60 * 1000 &&
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // 一周内的消息显示星期几
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return days[date.getDay()] + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }

      // 更早的消息显示完整日期
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    // 新增方法处理复制按钮点击
    handleCopyButtonClick() {
      // 检查是否有文本被选中
      const selection = window.getSelection();
      const selectedText = selection.toString();

      if (selectedText) {
        // 如果有文本被选中，仅复制选中的文本
        this.copyTextToClipboard(selectedText);
      } else {
        // 没有选中文本，复制整个消息
        this.$emit('copy');
      }
    },

    // 添加新方法用于复制选定文本
    copyTextToClipboard(text) {
      // 只在浏览器环境中使用document
      if (typeof document === 'undefined') {
        // 在App端使用uni-app的剪贴板API
        uni.setClipboardData({
          data: text,
          success: () => {
            uni.showToast({
              title: '已复制到剪贴板',
              icon: 'success',
              duration: 1500
            });
          },
          fail: () => {
            uni.showToast({
              title: '复制失败',
              icon: 'none',
              duration: 1500
            });
          }
        });
        return;
      }

      try {
        // 浏览器环境使用原有逻辑
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();

        const successful = document.execCommand('copy');
        
        uni.showToast({
          title: successful ? '已复制到剪贴板' : '复制失败',
          icon: successful ? 'success' : 'none',
          duration: 1500
        });

        if (successful && this.debugMode) {
          console.log('复制成功:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
        }
      } catch (err) {
        console.error('复制失败:', err);
        uni.showToast({
          title: '复制失败',
          icon: 'none',
          duration: 1500
        });
      } finally {
        if (document.body.contains(textarea)) {
          document.body.removeChild(textarea);
        }
      }
    },

    // 添加copy事件监听器到消息文本元素
    addCopyEventListener() {
      this.$nextTick(() => {
        // #ifdef H5
        if (typeof document !== 'undefined' && this.$el && this.$el.querySelector) {
          const messageElement = this.$el.querySelector('.message-text');
          if (messageElement) {
            messageElement.addEventListener('copy', this.handleCopyEvent);
          }
        }
        // #endif
      });
    },

    // 移除copy事件监听器
    removeCopyEventListener() {
      // #ifdef H5
      if (typeof document !== 'undefined' && this.$el && this.$el.querySelector) {
        const messageElement = this.$el.querySelector('.message-text');
        if (messageElement) {
          messageElement.removeEventListener('copy', this.handleCopyEvent);
        }
      }
      // #endif
    },

    // 处理复制事件
    handleCopyEvent(event) {
      const selection = window.getSelection();
      const selectedText = selection.toString();

      // 只有当用户选择了文本时，才处理复制
      if (selectedText) {
        // 阻止默认复制行为，使用我们的自定义复制
        event.preventDefault();
        event.stopPropagation();

        // 将选中文本复制到剪贴板
        try {
          navigator.clipboard.writeText(selectedText).then(() => {
            console.log('已复制选中文本:', selectedText.substring(0, 50) + '...');
          }).catch(err => {
            console.error('使用Clipboard API复制失败，尝试备用方法:', err);
            // 使用备用方法
            this.fallbackCopyTextToClipboard(selectedText);
          });
        } catch (err) {
          console.error('复制选中文本失败:', err);
          this.fallbackCopyTextToClipboard(selectedText);
        }
      } else {
        // 如果没有选择文本，则不阻止默认行为
        console.log('未选择文本，不进行处理');
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.message-container {
  position: relative;
  display: flex;
  width: 100%;
  margin-bottom: 28px;
  /* 增加间距 */
  align-items: flex-start;
  transition: transform 0.2s ease;
  /* 添加过渡效果 */

  &:hover {
    z-index: 2;
    /* 确保hover时在最上层 */
  }

  // AI消息容器（左对齐）
  &.ai-message {
    justify-content: flex-start;
  }

  // 用户消息容器（右对齐）
  &.user-message {
    justify-content: flex-end;
  }
}

// 头像样式优化
.avatar {
  width: 42px;
  /* 稍微增大头像 */
  height: 42px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 3px 8px var(--shadow-color);
  border: 2px solid white;
  background-color: var(--bg-secondary);
  transition: all 0.3s ease;
  z-index: 2;
  /* 增加z-index确保头像在气泡之上 */

  // 头像显示位置
  &.avatar-left {
    margin-right: 12px; // 增加与消息气泡间距
  }

  &.avatar-right {
    margin-left: 12px; // 增加与消息气泡间距
  }

  uni-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
    /* 添加图片过渡效果 */
  }

  // 头像悬停效果增强
  &:hover {
    transform: scale(1.08);
    box-shadow: 0 5px 12px var(--shadow-color);

    uni-image {
      transform: scale(1.05);
    }
  }
}

.message {
  position: relative;
  max-width: calc(100% - 110px);
  /* 增加最大宽度空间 */
  animation: messageSlide 0.4s ease;
  /* 延长动画时间 */

  .message-content {
    position: relative;
    padding: 14px 18px;
    /* 增加内边距 */
    border-radius: 18px;
    /* 增大圆角 */
    min-width: 60px;
    word-break: break-word;
    transition: all 0.3s ease;
    box-shadow: 0 2px 12px var(--shadow-color);
    /* 增强阴影效果 */
    overflow: visible;
    /* 确保时间戳能够显示在气泡外 */

    /* 添加鼠标悬停效果 */
    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px var(--shadow-color);
      /* 悬停时阴影更明显 */

      .message-time {
        opacity: 1;
        /* 悬停时显示时间戳 */
      }
    }

    /* 消息时间戳样式 */
    .message-time {
      position: absolute;
      bottom: -22px;
      font-size: 12px;
      color: var(--text-secondary);
      opacity: 0;
      /* 默认隐藏 */
      transition: opacity 0.2s ease;
      white-space: nowrap;

      .message-left & {
        left: 0;
      }

      .message-right & {
        right: 0;
      }
    }

    /* 确保内容可选择 */
    .message-text {
      font-size: 16px;
      line-height: 1.6;
      /* 增加行高提升可读性 */
      position: relative;
      z-index: 1;
      /* 确保文本在最上层 */

      /* 显式启用文本选择 */
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;

      /* 使内容可交互 */
      pointer-events: auto !important;
    }

    /* 确保深度选择器下的元素也可以选中 */
    :deep(.selectable),
    :deep(p),
    :deep(span),
    :deep(div),
    :deep(a),
    :deep(code),
    :deep(pre) {
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
      pointer-events: auto !important;
    }

    :deep(a) {
      color: #007AFF;
      text-decoration: none;
      position: relative;

      /* 添加链接下划线效果 */
      &::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 1px;
        background-color: currentColor;
        opacity: 0.5;
        transform: scaleX(0);
        transform-origin: left;
        transition: transform 0.3s ease;
      }

      &:hover::after {
        transform: scaleX(1);
      }
    }

    :deep(pre) {
      background-color: var(--code-bg);
      padding: 12px;
      /* 增加代码块内边距 */
      border-radius: 8px;
      /* 增大圆角 */
      overflow-x: auto;
      margin: 12px 0;
      box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.1);
      /* 添加内阴影 */
    }

    :deep(code) {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      /* 更好的代码字体 */
      background-color: var(--code-inline-bg);
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 0.9em;
      /* 调整代码字体大小 */
    }

    /* 等待消息样式 */
    .waiting-message {
      margin-top: 10px;
      padding: 10px 14px;
      background-color: rgba(var(--bg-secondary-rgb), 0.7);
      border-radius: 10px;
      font-size: 14px;
      color: var(--text-secondary);
      font-style: italic;
      animation: pulse 2s infinite ease-in-out;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      /* 添加轻微阴影 */
    }

    &:hover .message-actions {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // 右侧用户消息
  &.message-right {
    .message-content {
      background: linear-gradient(135deg, var(--user-message-bg-light), var(--user-message-bg));
      color: var(--user-message-text);
      border-radius: 20px 4px 20px 20px;
      /* 调整圆角 */
      margin-right: 8px;
      box-shadow: 0 2px 10px rgba(0, 118, 228, 0.25);
      /* 用户消息专用阴影 */

      /* 添加轻微边框效果 */
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .message-actions {
      right: auto;
      left: 0;
    }
  }

  // 左侧AI消息
  &.message-left {
    .message-content {
      background: linear-gradient(135deg, var(--ai-message-bg), var(--ai-message-bg-light));
      color: var(--ai-message-text);
      border-radius: 4px 20px 20px 20px;
      /* 调整圆角 */
      margin-left: 8px;
      border-left: 3px solid rgba(184, 199, 217, 0.8);
      /* 调整边框透明度 */
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      /* AI消息阴影调整 */
    }
  }

  // 加载状态
  &.loading .message-content {
    padding: 18px;
    /* 增加内边距 */
    min-height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(var(--bg-secondary-rgb), 0.7);
    /* 更轻的背景 */
  }

  // 错误状态
  &.error-message .message-content {
    background: var(--error-bg);
    color: var(--error-text);
    border-left: 3px solid var(--error-color);
    box-shadow: 0 2px 10px rgba(255, 77, 79, 0.1);
    /* 错误消息专用阴影 */
  }

  // 超时状态
  &.timeout-message .message-content {
    background: var(--timeout-bg);
    color: var(--timeout-text);
    border-left: 3px solid var(--warning-color);
    box-shadow: 0 2px 10px rgba(250, 173, 20, 0.1);
    /* 超时消息专用阴影 */
  }
}

.message-actions {
  position: absolute;
  top: -36px;
  /* 将操作按钮移得更高一点 */
  right: 0;
  display: flex;
  gap: 10px;
  /* 增加按钮间距 */
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  background: var(--bg-secondary);
  padding: 6px 10px;
  border-radius: 10px;
  box-shadow: 0 3px 15px var(--shadow-color);
  /* 增强阴影效果 */
  transform: translateY(4px);
  z-index: 10;

  /* 添加气泡箭头效果 */
  &::after {
    content: '';
    position: absolute;
    bottom: -6px;
    right: 20px;
    width: 12px;
    height: 12px;
    background: inherit;
    transform: rotate(45deg);
    z-index: -1;
  }

  .action-btn {
    width: 22px;
    /* 稍微增大按钮 */
    height: 22px;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
    transition: all 0.25s ease;
    position: relative;
    border-radius: 50%;
    /* 使按钮变成圆形 */

    &:hover {
      opacity: 1;
      transform: translateY(-2px);
      background-color: rgba(var(--bg-secondary-rgb), 0.8);
      /* 悬停时的背景色 */
    }

    &:active {
      transform: translateY(0) scale(0.95);
    }

    uni-image {
      width: 16px;
      height: 16px;
      filter: var(--icon-filter);
    }

    /* 按钮提示文字增强 */
    &::before {
      content: attr(data-tooltip);
      position: absolute;
      top: -30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 5px 8px;
      background: rgba(0, 0, 0, 0.7);
      color: white;
      font-size: 12px;
      border-radius: 4px;
      white-space: nowrap;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
    }

    &:hover::before {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(-2px);
    }
  }
}

.loading-indicator {
  display: flex;
  justify-content: center;
  align-items: center;

  .dot-flashing {
    position: relative;
    width: 7px;
    /* 稍微增大点的尺寸 */
    height: 7px;
    border-radius: 50%;
    background-color: var(--loading-color);
    animation: dot-flashing 1s infinite linear alternate;
    animation-delay: 0.5s;

    &::before,
    &::after {
      content: '';
      display: inline-block;
      position: absolute;
      top: 0;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: var(--loading-color);
      animation: dot-flashing 1s infinite alternate;
    }

    &::before {
      left: -15px;
      /* 增加点之间的间距 */
      animation-delay: 0s;
    }

    &::after {
      left: 15px;
      animation-delay: 1s;
    }
  }
}

/* 改进的动画关键帧 */
@keyframes dot-flashing {
  0% {
    background-color: var(--loading-color-active);
    transform: scale(1.1);
  }

  50%,
  100% {
    background-color: var(--loading-color);
    transform: scale(0.9);
  }
}

@keyframes messageSlide {
  from {
    opacity: 0;
    transform: translateY(15px) scale(0.98);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 添加响应式样式 */
@media screen and (max-width: 768px) {
  .message {
    max-width: calc(100% - 80px);
  }

  .avatar {
    width: 36px;
    height: 36px;

    &.avatar-left {
      margin-right: 8px;
    }

    &.avatar-right {
      margin-left: 8px;
    }
  }

  .message .message-content {
    padding: 12px 14px;
  }
}

/* 确保内容可选择的样式类 */
.selectable {
  user-select: text !important;
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  cursor: text;
  pointer-events: auto !important;
}

@keyframes pulse {
  0% {
    opacity: 0.7;
    transform: scale(0.98);
  }

  50% {
    opacity: 1;
    transform: scale(1);
  }

  100% {
    opacity: 0.7;
    transform: scale(0.98);
  }
}

/* 增强思考内容样式 - 减少与正文的距离 */
:deep(.inline-thought) {
  margin: 0;

  border-radius: 8px;
  /* 略微减小圆角，更贴合文本流 */
  overflow: hidden;
  border: 1px solid var(--border-color);
  background-color: rgba(var(--bg-secondary-rgb), 0.5);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.04);
  /* 减轻阴影，使其不那么突出 */
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-1px);
    /* 减少悬停时的上移距离 */
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.08);
    /* 减轻悬停阴影 */
  }
}

:deep(.inline-thought .thought-header) {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  /* 减小头部内边距，从10px 14px调整为6px 12px */
  background-color: rgba(var(--bg-secondary-rgb), 0.8);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.2s ease;
}

:deep(.inline-thought .thought-icon) {
  width: 18px;
  height: 18px;
  margin-right: 10px;
  filter: var(--icon-filter);
}

:deep(.inline-thought .thought-header span) {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  /* 增加字重 */
  color: var(--text-secondary);
}

:deep(.inline-thought .toggle-icon) {
  width: 16px;
  height: 16px;
  transition: transform 0.3s ease;
  filter: var(--icon-filter);
}

:deep(.inline-thought .thought-content) {
  padding: 10px 12px;
  /* 减小内容区内边距，从14px调整为10px 12px */
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  background-color: rgba(var(--bg-secondary-rgb), 0.3);
  border-left: 3px solid rgba(0, 120, 255, 0.4);
  transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
  /* 使用更流畅的动画曲线 */
}

:deep(.inline-thought .thought-content.expanded) {
  max-height: 1000vh;
  opacity: 1;
}

:deep(.inline-thought .thought-content.collapsed) {
  max-height: 0;
  padding: 0;
  opacity: 0;
  border: none;
  overflow: hidden;
}

/* 响应式适配内联思考 */
@media screen and (max-width: 768px) {
  :deep(.inline-thought) {
    margin: 6px 0;
    /* 移动端进一步减少边距 */
  }

  :deep(.inline-thought .thought-header) {
    padding: 6px 10px;
  }

  :deep(.inline-thought .thought-icon) {
    width: 14px;
    height: 14px;
  }

  :deep(.inline-thought .thought-content:not(.collapsed)) {
    padding: 10px;
    font-size: 13px;
  }
}

/* 消息文本内容的全面Markdown样式增强 */
.message .message-content .message-text {
  /* 基础样式保持不变 */

  /* 使用:deep增强所有Markdown元素的样式 */
  /* 标题样式 */
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin-top: 16px;
    margin-bottom: 10px;
    font-weight: 600;
    line-height: 1.25;
    color: var(--text-primary);
  }

  :deep(h1) {
    font-size: 1.5em;
  }

  :deep(h2) {
    font-size: 1.35em;
  }

  :deep(h3) {
    font-size: 1.2em;
  }

  :deep(h4) {
    font-size: 1.1em;
  }

  :deep(h5),
  :deep(h6) {
    font-size: 1em;
  }

  /* 段落样式 */
  :deep(p) {
    margin: 8px 0;
    line-height: 1.6;
  }

  /* 列表样式 */
  :deep(ul),
  :deep(ol) {
    margin: 8px 0;
    padding-left: 24px;

    li {
      margin: 4px 0;
    }
  }

  :deep(ul) li {
    list-style-type: disc;
  }

  :deep(ol) li {
    list-style-type: decimal;
  }

  /* 引用块样式 */
  :deep(blockquote) {
    border-left: 4px solid rgba(0, 120, 255, 0.4);
    padding: 8px 16px;
    margin: 12px 0;
    background-color: rgba(var(--bg-secondary-rgb), 0.4);
    border-radius: 4px;

    p {
      margin: 6px 0;
    }
  }

  /* 表格样式 */
  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    overflow-x: auto;
    display: block;

    th,
    td {
      border: 1px solid var(--border-color);
      padding: 8px 12px;
      text-align: left;
    }

    th {
      background-color: rgba(var(--bg-secondary-rgb), 0.6);
      font-weight: 500;
    }

    tr:nth-child(even) {
      background-color: rgba(var(--bg-secondary-rgb), 0.2);
    }
  }

  /* 代码样式增强 */
  :deep(pre) {
    background-color: var(--code-bg);
    padding: 12px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 12px 0;
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.1);
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  }

  :deep(code) {
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    background-color: var(--code-inline-bg);
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 0.9em;
    white-space: pre-wrap;
  }

  /* 水平线样式 */
  :deep(hr) {
    height: 1px;
    background-color: var(--border-color);
    border: none;
    margin: 16px 0;
  }

  /* 链接样式加强 */
  :deep(a) {
    color: #007AFF;
    text-decoration: none;
    position: relative;
    transition: color 0.2s ease;
    font-weight: 500;

    /* 添加链接下划线效果 */
    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 1px;
      background-color: currentColor;
      opacity: 0.5;
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }

    &:hover {
      color: darken(#007AFF, 10%);

      &::after {
        transform: scaleX(1);
      }
    }
  }

  /* 图片样式 */
  :deep(img) {
    max-width: 100%;
    border-radius: 6px;
    margin: 8px 0;
    height: auto;
  }
}

/* 思考内容的Markdown样式应用增强 */
:deep(.inline-thought .thought-content) {
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-color);
  background-color: rgba(var(--bg-secondary-rgb), 0.3);
  border-left: 3px solid rgba(0, 120, 255, 0.4);
  transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);

  /* 重用相同的Markdown样式 */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin-top: 8px;
    /* 减少标题上边距，从12px减少到8px */
    margin-bottom: 6px;
    /* 减少标题下边距，从8px减少到6px */
    color: var(--text-primary);
    font-weight: 600;
    line-height: 1.25;
    font-size: 1em;
    opacity: 0.9;
  }

  p {
    margin: 4px 0;
    /* 减少段落边距，从6px减少到4px */
    font-size: 0.95em;
  }

  ul,
  ol {
    margin: 4px 0;
    /* 减少列表边距，从6px减少到4px */
    padding-left: 20px;
    font-size: 0.95em;
  }

  pre {
    margin: 8px 0;
    background-color: var(--code-bg);
    font-size: 0.9em;
  }

  code {
    font-family: monospace;
    background-color: var(--code-inline-bg);
    font-size: 0.9em;
  }

  blockquote {
    border-left: 3px solid rgba(0, 120, 255, 0.3);
    padding: 6px 12px;
    margin: 8px 0;
    background-color: rgba(var(--bg-secondary-rgb), 0.2);
  }
}

/* 代码块样式增强 */
.message .message-content .message-text {
  /* 保持现有样式 */

  /* 代码块包装器样式 */
  :deep(.code-block-wrapper) {
    margin: 16px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: var(--code-bg, #282c34);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* 代码块头部样式 */
  :deep(.code-block-header) {
    display: flex;
    justify-content: flex-end;
    padding: 6px 12px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);

    .code-lang-tag {
      font-size: 12px;
      color: #abb2bf;
      background: rgba(0, 0, 0, 0.2);
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      font-family: monospace;
    }
  }

  /* 代码块内容样式 */
  :deep(.code-block) {
    margin: 0 !important;
    padding: 12px 16px;
    background: var(--code-bg, #282c34);
    border-radius: 0;
    overflow-x: auto;
    font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
    font-size: 0.9em;
    line-height: 1.6;

    code {
      background: transparent;
      padding: 0;
      color: #e3e3e3;
      white-space: pre;
      font-family: inherit;
      border-radius: 0;
    }
  }

  /* 行内代码样式 */
  :deep(code):not(.code-block code) {
    background-color: var(--code-inline-bg);
    color: var(--text-primary);
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 0.9em;
  }
}

/* 思考内容中的代码块样式 */
:deep(.inline-thought .thought-content) {
  /* 保留现有样式 */

  .code-block-wrapper {
    margin: 10px 0;
    border-radius: 6px;

    .code-block-header {
      padding: 4px 8px;

      .code-lang-tag {
        font-size: 11px;
        padding: 1px 4px;
      }
    }

    .code-block {
      padding: 10px;
      font-size: 0.85em;
    }
  }
}

/* 移动端适配 */
@media screen and (max-width: 768px) {
  .message .message-content .message-text {
    :deep(.code-block-wrapper) {
      margin: 12px 0;
    }

    :deep(.code-block) {
      padding: 10px;
      font-size: 0.85em;
    }
  }
}
</style>
