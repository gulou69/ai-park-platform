/**
 * 状态栏管理工具
 * 处理沉浸式状态栏和刘海屏适配
 */

class StatusBarManager {
    constructor() {
        this.statusBarHeight = 0;
        this.safeAreaInsets = {
            top: 0,
            bottom: 0,
            left: 0,
            right: 0
        };
        this.isNotchScreen = false;
        this.init();
    }

    /**
     * 初始化状态栏管理
     */
    init() {
        this.getSystemInfo();
        this.setSafeAreaCSSVars();
    }

    /**
     * 获取系统信息
     */
    getSystemInfo() {
        uni.getSystemInfo({
            success: (res) => {
                console.log('系统信息:', res);
                
                // 获取状态栏高度
                this.statusBarHeight = res.statusBarHeight || 0;
                
                // 获取安全区域信息
                if (res.safeArea) {
                    this.safeAreaInsets = {
                        top: res.safeArea.top || 0,
                        bottom: res.windowHeight - res.safeArea.bottom || 0,
                        left: res.safeArea.left || 0,
                        right: res.windowWidth - res.safeArea.right || 0
                    };
                }

                // 检测刘海屏/水滴屏
                this.detectNotchScreen(res);
                
                console.log('状态栏高度:', this.statusBarHeight);
                console.log('安全区域信息:', this.safeAreaInsets);
                console.log('是否为刘海屏:', this.isNotchScreen);
            },
            fail: (err) => {
                console.error('获取系统信息失败:', err);
            }
        });
    }

    /**
     * 检测刘海屏
     * @param {Object} systemInfo 系统信息
     */
    detectNotchScreen(systemInfo) {
        // iPhone X 系列特征
        const isIPhoneX = systemInfo.platform === 'ios' && 
                         (systemInfo.model.includes('iPhone X') || 
                          systemInfo.model.includes('iPhone 11') ||
                          systemInfo.model.includes('iPhone 12') ||
                          systemInfo.model.includes('iPhone 13') ||
                          systemInfo.model.includes('iPhone 14'));

        // Android 刘海屏检测
        const hasNotch = systemInfo.safeArea && 
                        systemInfo.safeArea.top > systemInfo.statusBarHeight;

        this.isNotchScreen = isIPhoneX || hasNotch;
    }

    /**
     * 设置CSS变量
     */
    setSafeAreaCSSVars() {
        if (typeof document !== 'undefined') {
            const root = document.documentElement;
            
            // 设置状态栏高度
            root.style.setProperty('--status-bar-height', this.statusBarHeight + 'px');
            
            // 设置安全区域
            root.style.setProperty('--safe-area-inset-top', this.safeAreaInsets.top + 'px');
            root.style.setProperty('--safe-area-inset-bottom', this.safeAreaInsets.bottom + 'px');
            root.style.setProperty('--safe-area-inset-left', this.safeAreaInsets.left + 'px');
            root.style.setProperty('--safe-area-inset-right', this.safeAreaInsets.right + 'px');
        }
    }

    /**
     * 获取状态栏高度
     * @returns {number} 状态栏高度
     */
    getStatusBarHeight() {
        return this.statusBarHeight;
    }

    /**
     * 获取安全区域信息
     * @returns {Object} 安全区域信息
     */
    getSafeAreaInsets() {
        return this.safeAreaInsets;
    }

    /**
     * 是否为刘海屏
     * @returns {boolean} 是否为刘海屏
     */
    isNotch() {
        return this.isNotchScreen;
    }

    /**
     * 设置状态栏样式
     * @param {string} style 样式：dark/light
     */
    setStatusBarStyle(style = 'dark') {
        // #ifdef APP-PLUS
        plus.navigator.setStatusBarStyle(style);
        // #endif
    }

    /**
     * 设置状态栏背景颜色
     * @param {string} color 颜色值
     */
    setStatusBarBackground(color = 'transparent') {
        // #ifdef APP-PLUS
        plus.navigator.setStatusBarBackground(color);
        // #endif
    }

    /**
     * 获取导航栏高度（含状态栏）
     * @returns {number} 导航栏总高度
     */
    getNavigationBarHeight() {
        // 默认导航栏高度 44px + 状态栏高度
        return 44 + this.statusBarHeight;
    }
}

// 创建单例
const statusBarManager = new StatusBarManager();

// 导出工具函数
export const getStatusBarHeight = () => statusBarManager.getStatusBarHeight();
export const getSafeAreaInsets = () => statusBarManager.getSafeAreaInsets();
export const isNotchScreen = () => statusBarManager.isNotch();
export const setStatusBarStyle = (style) => statusBarManager.setStatusBarStyle(style);
export const setStatusBarBackground = (color) => statusBarManager.setStatusBarBackground(color);
export const getNavigationBarHeight = () => statusBarManager.getNavigationBarHeight();

export default statusBarManager;
