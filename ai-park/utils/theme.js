/**
 * 主题管理工具
 * 支持亮色/暗色模式切换
 */

import { setStatusBarStyle } from './statusBar.js'

// CSS变量映射
const THEME_VARS = {
    light: {
        // 背景色
        '--bg-primary': '#f9f9f9',
        '--bg-secondary': '#ffffff',
        '--bg-secondary-rgb': '255, 255, 255',
        '--bg-tertiary': '#f0f2f5',
        '--hover-bg': '#f0f0f0',
        '--bg-hover': '#f0f0f0',
        '--header-bg': 'rgba(255, 255, 255, 0.9)',
        '--sidebar-bg': '#f5f5f5',

        // 文本颜色
        '--text-primary': '#212121',
        '--text-secondary': '#666666',
        '--text-tertiary': '#999999',
        '--text-placeholder': '#888888',

        // 边框和阴影
        '--border-color': '#e0e0e0',
        '--shadow-color': 'rgba(0, 0, 0, 0.08)',
        '--scroll-thumb': 'rgba(0, 0, 0, 0.2)',

        // 输入框
        '--input-bg': '#f5f5f5',

        // 图标过滤器
        '--icon-filter': 'none',

        // 主题色
        '--primary-color': '#007AFF',
        '--primary-bg': 'rgba(0, 122, 255, 0.08)',

        // 状态色
        '--error-color': '#ff4d4f',
        '--warning-color': '#faad14',
        '--error-bg': 'rgba(255, 77, 79, 0.1)',

        // 消息气泡
        '--ai-message-bg': '#e8eef5',
        '--ai-message-bg-light': '#f0f7ff',
        '--ai-message-text': '#1a1a1a',
        '--user-message-bg': '#0076e4',
        '--user-message-bg-light': '#2c9bff',
        '--user-message-text': '#ffffff',
        '--loading-color': 'rgba(0, 0, 0, 0.3)',
        '--loading-color-active': 'rgba(0, 0, 0, 0.6)',
        '--error-text': '#ff4d4f',
        '--timeout-text': '#faad14',
        '--timeout-bg': 'rgba(250, 173, 20, 0.1)',
        '--code-bg': '#f0f0f0',
        '--code-inline-bg': 'rgba(175, 184, 193, 0.3)'
    },
    dark: {
        // 背景色
        '--bg-primary': '#121212',
        '--bg-secondary': '#1e1e1e',
        '--bg-secondary-rgb': '30, 30, 30',
        '--bg-tertiary': '#2a2a2a',
        '--hover-bg': '#2a2a2a',
        '--bg-hover': '#333333',
        '--header-bg': 'rgba(30, 30, 30, 0.9)',
        '--sidebar-bg': '#1a1a1a',

        // 文本颜色
        '--text-primary': '#e0e0e0',
        '--text-secondary': '#9e9e9e',
        '--text-tertiary': '#666666',
        '--text-placeholder': '#737373',

        // 边框和阴影
        '--border-color': '#333333',
        '--shadow-color': 'rgba(0, 0, 0, 0.5)',
        '--scroll-thumb': 'rgba(255, 255, 255, 0.15)',

        // 输入框
        '--input-bg': '#2a2a2a',

        // 图标过滤器
        '--icon-filter': 'invert(0.85)',

        // 主题色
        '--primary-color': '#0A84FF',
        '--primary-bg': 'rgba(10, 132, 255, 0.12)',

        // 状态色
        '--error-color': '#ff7875',
        '--warning-color': '#ffc53d',
        '--error-bg': 'rgba(255, 77, 79, 0.15)',

        // 消息气泡
        '--ai-message-bg': '#2d2d2d',
        '--ai-message-bg-light': '#383838',
        '--ai-message-text': '#f0f0f0',
        '--user-message-bg': '#0A84FF',
        '--user-message-bg-light': '#0060d1',
        '--user-message-text': '#ffffff',
        '--loading-color': 'rgba(255, 255, 255, 0.3)',
        '--loading-color-active': 'rgba(255, 255, 255, 0.6)',
        '--error-text': '#ff7875',
        '--timeout-text': '#ffc53d',
        '--timeout-bg': 'rgba(255, 197, 61, 0.1)',
        '--code-bg': '#2d2d2d',
        '--code-inline-bg': 'rgba(99, 110, 123, 0.4)'
    }
};

/**
 * 主题管理器
 */
export const themeManager = {
    /**
     * 初始化主题
     * 从本地存储加载主题，或根据系统偏好设置
     */
    init() {
        // 从本地获取已保存的主题
        let savedTheme = uni.getStorageSync('theme');

        // 如果没有保存的主题，则使用系统默认
        if (!savedTheme) {
            // 检查系统偏好
            if (typeof window !== 'undefined' && window.matchMedia) {
                const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                savedTheme = isDarkMode ? 'dark' : 'light';
            } else {
                savedTheme = 'light'; // 默认亮色
            }
        }

        // 应用主题
        this.applyTheme(savedTheme);

        // 监听系统主题变化
        this.setupSystemThemeListener();
    },

    /**
     * 切换主题
     * 在亮色和暗色之间切换
     */
    toggleTheme() {
        const currentTheme = uni.getStorageSync('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';

        // 应用新主题
        this.applyTheme(newTheme);

        return newTheme;
    },

    /**
     * 设置特定主题
     * @param {string} theme - 'light' 或 'dark'
     */
    setTheme(theme) {
        if (!['light', 'dark'].includes(theme)) {
            console.error('无效的主题:', theme);
            return false;
        }

        // 应用主题
        this.applyTheme(theme);
        return true;
    },

    /**
     * 应用主题到DOM
     * @param {string} theme - 'light' 或 'dark'
     */
    applyTheme(theme) {
        if (!['light', 'dark'].includes(theme)) {
            theme = 'light';
        }

        // 保存到本地存储
        uni.setStorageSync('theme', theme);

        // 更新全局数据
        try {
            const app = getApp();
            if (app && app.globalData) {
                app.globalData.theme = theme;
            }
        } catch (error) {
            // getApp() 在某些环境下可能不可用，静默处理
            console.debug('getApp() 不可用，跳过全局数据更新');
        }

        // 设置CSS变量（仅在浏览器环境中）
        if (typeof document !== 'undefined') {
            const themeVars = THEME_VARS[theme];
            const root = document.documentElement || document.body;

            if (root && root.style) {
                for (const [key, value] of Object.entries(themeVars)) {
                    root.style.setProperty(key, value);
                }
            }

            // 更新meta主题色
            this.updateMetaThemeColor(theme);
        }

        // 更新状态栏样式
        this.updateStatusBarStyle(theme);

        // 触发主题变化事件
        uni.$emit('theme-changed', theme);
    },

    /**
     * 更新状态栏样式
     * @param {string} theme - 主题名称
     */
    updateStatusBarStyle(theme) {
        try {
            // 根据主题设置状态栏文字颜色
            const isDark = theme === 'dark';
            setStatusBarStyle(isDark ? 'light' : 'dark');
        } catch (error) {
            console.debug('状态栏样式更新失败:', error);
        }
    },

    /**
     * 更新meta标签的主题色
     * @param {string} theme - 主题名称
     */
    updateMetaThemeColor(theme) {
        if (typeof document === 'undefined') return;

        // 设置meta主题色标签
        let metaTheme = document.querySelector('meta[name="theme-color"]');
        if (!metaTheme) {
            metaTheme = document.createElement('meta');
            metaTheme.name = 'theme-color';
            document.head.appendChild(metaTheme);
        }

        // 根据主题设置不同的颜色
        metaTheme.content = theme === 'dark' ? '#1e1e1e' : '#ffffff';
    },

    /**
     * 设置系统主题监听
     */
    setupSystemThemeListener() {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        // 检查是否支持监听方法
        if (darkModeMediaQuery.addEventListener) {
            darkModeMediaQuery.addEventListener('change', (e) => {
                // 只有当用户没有手动设置主题时，才跟随系统变化
                if (!uni.getStorageSync('theme_manual')) {
                    this.applyTheme(e.matches ? 'dark' : 'light');
                }
            });
        }
    },

    /**
     * 获取当前主题
     * @returns {string} - 当前主题 'light' 或 'dark'
     */
    getCurrentTheme() {
        return uni.getStorageSync('theme') || 'light';
    },

    /**
     * 重置到系统默认主题
     */
    resetToSystemTheme() {
        // 移除手动设置标记
        uni.removeStorageSync('theme_manual');

        // 获取系统主题
        let systemTheme = 'light';
        if (typeof window !== 'undefined' && window.matchMedia) {
            systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }

        // 应用系统主题
        this.applyTheme(systemTheme);
    }
};

/**
 * 初始化主题
 * 在应用加载时调用
 */
export function initTheme() {
    themeManager.init();
}

export default themeManager;
