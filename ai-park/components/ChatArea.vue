<template>
    <view class="chat-area" :class="{ 'chat-expanded': isExpanded }">
        <WelcomeScreen v-if="!hasMessages" @use-prompt="$emit('use-prompt', $event)" />

        <view v-else class="messages-container" ref="messagesContainer">
            <!-- 添加加载状态显示 -->
            <view v-if="messagesLoading" class="messages-loading">
                <view class="loading-spinner"></view>
                <text>正在加载聊天记录...</text>
            </view>

            <view class="debug-info" v-if="debugMode">
                <text>消息数量: {{ messages.length }}</text>
            </view>

            <view class="messages" :class="{ 'messages-input-expanded': isInputExpanded }">
                <MessageBubble v-for="msg in messages" :key="msg.id" :message="msg" :is-user="msg.type === 'user'"
                    :is-loading="msg.id === loadingMessageId" :avatar="getAvatarUrl(msg)"
                    @copy="$emit('copy-message', msg)" @regenerate="$emit('regenerate-message', msg)"
                    @like="$emit('like-message', msg)" @dislike="$emit('dislike-message', msg)" />
            </view>

            <!-- 添加底部空间，防止被输入框遮挡 -->
            <view class="bottom-space" ref="bottomSpace"></view>
        </view>

        <!-- 将input-area插槽放在外部，不在滚动容器内 -->
        <div class="input-area-container">
            <slot name="input-area"></slot>
        </div>
    </view>
</template>

<script>
import WelcomeScreen from './WelcomeScreen.vue'
import MessageBubble from './MessageBubble.vue'

export default {
    name: 'ChatArea',
    components: {
        WelcomeScreen,
        MessageBubble
    },
    props: {
        messages: {
            type: Array,
            default: () => []
        },
        isExpanded: {
            type: Boolean,
            default: false
        },
        isInputExpanded: {
            type: Boolean,
            default: false
        },
        loadingMessageId: {
            type: String,
            default: null
        },
        debugMode: {
            type: Boolean,
            default: false
        },
        // 添加消息加载状态属性
        messagesLoading: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            inputAreaHeight: 80, // 初始输入区域高度估计值
            resizeObserver: null
        };
    },
    computed: {
        hasMessages() {
            return this.messages && this.messages.length > 0;
        }
    },
    watch: {
        // 观察消息数组的变化，自动滚动到底部
        messages: {
            deep: true,
            handler(newVal, oldVal) {
                this.$nextTick(() => {
                    // 检查是否有新消息添加
                    if (newVal.length > (oldVal?.length || 0)) {
                        this.updateBottomSpace();
                        this.scrollToBottom();
                    } else if (newVal.some((msg, i) =>
                        oldVal[i] && msg.content !== oldVal[i].content)) {
                        // 消息内容更新时也滚动
                        this.scrollToBottom();
                    }
                });
            }
        }
    },
    mounted() {
        this.updateBottomSpace();
        this.setupResizeObserver();

        // 添加窗口大小变化监听 - 仅在浏览器环境中
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this.updateBottomSpace);
        }
    },
    beforeDestroy() {
        // 清理观察器和事件监听
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // 仅在浏览器环境中移除事件监听
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this.updateBottomSpace);
        }
    },
    methods: {
        // 更新底部空间大小
        updateBottomSpace() {
            // 简化处理，只触发滚动到底部
            this.$nextTick(() => {
                this.scrollToBottom();
            });
        },

        // 设置大小变化观察器
        setupResizeObserver() {
            // #ifdef H5
            if (typeof ResizeObserver !== 'undefined') {
                try {
                    this.resizeObserver = new ResizeObserver(entries => {
                        // 输入区域大小变化时，更新底部空间
                        this.updateBottomSpace();
                    });

                    // 延迟观察以确保DOM已渲染
                    setTimeout(() => {
                        if (this.$el && this.$el.querySelector) {
                            const inputArea = this.$el.querySelector('.input-area');
                            if (inputArea) {
                                this.resizeObserver.observe(inputArea);
                            }
                        }
                    }, 500);
                } catch (error) {
                    console.warn('ResizeObserver设置失败:', error);
                }
            }
            // #endif
        },

        scrollToBottom() {
            this.$nextTick(() => {
                const container = this.$refs.messagesContainer;
                if (container) {
                    try {
                        container.scrollTo({
                            top: container.scrollHeight,
                            behavior: 'smooth'
                        });
                    } catch (e) {
                        container.scrollTop = container.scrollHeight;
                    }
                }
            });
        },

        // 修改头像获取方法 - 直接调用父组件提供的回调函数
        getAvatarUrl(message) {
            // 将消息对象传给父组件以获取正确头像URL
            return this.$parent.getMessageAvatar ?
                this.$parent.getMessageAvatar(message) :
                (message.type === 'user' ?
                    '/static/icons/person-circle.svg' :
                    '/static/icons/robot.svg');
        }
    }
}
</script>

<style lang="scss" scoped>
.chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    width: calc(100% - 280px);
    background: var(--bg-primary);
    color: var(--text-primary);
    min-height: 0;

    &.chat-expanded {
        width: calc(100% - 60px);
    }

    .messages-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: 20px 40px 20px 40px; /* 保持上下padding一致 */
        background: transparent;
        min-height: 0;
    }

    .messages {
        flex: 1;
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        padding: 0;
        background: transparent;
        min-height: 0;
    }

    .bottom-space {
        display: none; /* 完全隐藏 */
        height: 0;
        flex-shrink: 0;
    }

    .debug-info {
        display: none; /* 完全隐藏调试信息 */
        visibility: hidden;
        height: 0;
        overflow: hidden;
    }

    /* 输入区域容器，固定在底部 */
    .input-area-container {
        flex-shrink: 0;
        width: 100%;
        padding: 0 40px 20px 40px; /* 只有底部和左右padding */
        background: var(--bg-primary);
        border-top: none; /* 移除任何边框 */
        box-shadow: none; /* 移除阴影 */
    }

    // 添加消息加载状态样式
    .messages-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 30px 0;
        gap: 16px;
        background: transparent;

        .loading-spinner {
            width: 36px;
            height: 36px;
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
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

@media screen and (max-width: 768px) {
    .chat-area {
        width: 100% !important;

        .messages-container {
            padding: 16px 16px 0 !important; /* 移除底部padding */
        }

        .input-area-container {
            padding: 16px !important;
        }
    }
}
</style>
