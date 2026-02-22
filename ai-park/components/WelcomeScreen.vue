<template>
    <view class="welcome-container">
        <view class="welcome-content">
            <image src="/static/logo.png" mode="aspectFit" class="welcome-logo" />
            <text class="welcome-title">欢迎使用 AI Park</text>
            <text class="welcome-subtitle">智能助手随时为您服务</text>
            <view class="welcome-features">
                <view class="feature">
                    <text class="feature-icon">💬</text>
                    <text class="feature-text">聊天问答</text>
                </view>
                <view class="feature">
                    <text class="feature-icon">📝</text>
                    <text class="feature-text">文案创作</text>
                </view>
                <view class="feature">
                    <text class="feature-icon">🧩</text>
                    <text class="feature-text">代码助手</text>
                </view>
            </view>

            <!-- 快捷提示仅在电脑端显示 -->
            <view v-if="!isMobile" class="quick-prompts">
                <text class="prompts-title">快捷提示</text>
                <view class="prompt-buttons">
                    <button class="prompt-btn" @click="$emit('use-prompt', '介绍一下你自己')">介绍一下你自己</button>
                    <button class="prompt-btn" @click="$emit('use-prompt', '你能做什么?')">你能做什么?</button>
                    <button class="prompt-btn" @click="$emit('use-prompt', '写一段Python代码')">写一段Python代码</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'WelcomeScreen',
    data() {
        return {
            isMobile: false
        }
    },
    mounted() {
        this.checkDevice();
    },
    methods: {
        checkDevice() {
            // 使用uni-app的系统信息API检测设备类型
            try {
                const systemInfo = uni.getSystemInfoSync();
                
                // 多重检测条件确保准确性
                const isApp = systemInfo.platform === 'android' || systemInfo.platform === 'ios';
                const isSmallScreen = systemInfo.screenWidth <= 768;
                const isMobilePlatform = systemInfo.platform && 
                    ['android', 'ios', 'harmonyos'].includes(systemInfo.platform.toLowerCase());
                
                // App端、小屏幕设备或移动平台都认为是移动端
                this.isMobile = isApp || isSmallScreen || isMobilePlatform;
                
                // 如果在浏览器环境中，额外检查用户代理
                // #ifdef H5
                if (typeof navigator !== 'undefined') {
                    const userAgent = navigator.userAgent.toLowerCase();
                    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
                    const isMobileUA = mobileRegex.test(userAgent);
                    
                    // 如果用户代理检测为移动端，强制设置为移动端
                    if (isMobileUA) {
                        this.isMobile = true;
                    }
                }
                // #endif
                
                console.log('设备信息:', {
                    platform: systemInfo.platform,
                    screenWidth: systemInfo.screenWidth,
                    isMobile: this.isMobile
                });
            } catch (error) {
                console.error('获取设备信息失败:', error);
                // 默认为移动端以确保兼容性
                this.isMobile = true;
            }
        }
    }
}
</script>

<style lang="scss" scoped>
.welcome-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    overflow-y: auto;
    margin-bottom: 80px;

    /* 添加隐藏滚动条但保留滚动功能的样式 */
    &::-webkit-scrollbar {
        display: none;
        /* Chrome, Safari 和 Opera */
        width: 0 !important;
    }

    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;
    /* IE 和 Edge */

    .welcome-content {
        max-width: 600px;
        width: 100%;
        text-align: center;
        padding: 40px;
        animation: fadeIn 0.6s ease;

        .welcome-logo {
            width: 80px;
            height: 80px;
            margin-bottom: 24px;
        }

        .welcome-title {
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 16px;
            background: linear-gradient(to right, #007AFF, #00C6FF);
            -webkit-background-clip: text;
            color: transparent;
            display: block;
        }

        .welcome-subtitle {
            font-size: 18px;
            color: var(--text-secondary);
            margin-bottom: 40px;
            display: block;
        }

        .welcome-features {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 20px;
            margin-top: 40px;

            .feature {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 12px;
                padding: 20px;
                border-radius: 12px;
                background: var(--bg-secondary);
                transition: all 0.3s ease;

                &:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 20px var(--shadow-color);
                }

                .feature-icon {
                    font-size: 32px;
                }

                .feature-text {
                    font-size: 16px;
                    color: var(--text-primary);
                }
            }
        }

        .quick-prompts {
            margin-top: 40px;

            .prompts-title {
                font-size: 16px;
                color: var(--text-secondary);
                margin-bottom: 16px;
                display: block;
            }

            .prompt-buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                justify-content: center;

                .prompt-btn {
                    padding: 12px 16px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    font-size: 14px;
                    color: var(--text-primary);
                    cursor: pointer;
                    transition: all 0.2s ease;

                    &:hover {
                        background: var(--hover-bg);
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px var(--shadow-color);
                    }

                    &:active {
                        transform: translateY(0);
                    }
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
</style>
