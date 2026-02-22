/**
 * 网络状态监测工具
 */
class NetworkManager {
    constructor() {
        this.isOnline = true;
        this.listeners = {
            online: [],
            offline: []
        };

        // 初始化网络监听
        this.setupListeners();
    }

    /**
     * 设置网络状态监听
     */
    setupListeners() {
        // 浏览器环境
        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => this.handleOnline());
            window.addEventListener('offline', () => this.handleOffline());

            // 初始状态
            this.isOnline = navigator.onLine;
        }
        // 小程序环境
        else if (typeof uni !== 'undefined') {
            uni.getNetworkType({
                success: (res) => {
                    this.isOnline = res.networkType !== 'none';
                }
            });

            // 监听网络状态变化
            uni.onNetworkStatusChange((res) => {
                if (res.isConnected) {
                    this.handleOnline();
                } else {
                    this.handleOffline();
                }
            });
        }
    }

    /**
     * 处理上线事件
     */
    handleOnline() {
        this.isOnline = true;
        this.listeners.online.forEach(callback => callback());
    }

    /**
     * 处理离线事件
     */
    handleOffline() {
        this.isOnline = false;
        this.listeners.offline.forEach(callback => callback());
    }

    /**
     * 添加网络状态监听器
     * @param {string} event 事件类型 'online' | 'offline'
     * @param {Function} callback 回调函数
     */
    addEventListener(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
        return this;
    }

    /**
     * 移除网络状态监听器
     * @param {string} event 事件类型 'online' | 'offline'
     * @param {Function} callback 回调函数
     */
    removeEventListener(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
        return this;
    }

    /**
     * 检查当前网络是否在线
     * @returns {boolean} 是否在线
     */
    checkOnline() {
        // 重新检查网络状态
        if (typeof window !== 'undefined') {
            this.isOnline = navigator.onLine;
        } else if (typeof uni !== 'undefined') {
            uni.getNetworkType({
                success: (res) => {
                    this.isOnline = res.networkType !== 'none';
                }
            });
        }
        return this.isOnline;
    }
}

/**
 * 获取当前网络类型
 * @returns {Promise<string>} 网络类型：wifi/2g/3g/4g/5g/ethernet/unknown/none
 */
export const getNetworkType = () => {
    return new Promise((resolve) => {
        uni.getNetworkType({
            success: (res) => {
                resolve(res.networkType);
            },
            fail: () => {
                resolve('unknown');
            }
        });
    });
};

/**
 * 监听网络状态变化
 * @param {Function} callback 网络状态变化回调
 */
export const onNetworkStatusChange = (callback) => {
    uni.onNetworkStatusChange(callback);
};

// 导出单例
export default new NetworkManager();
