import { getNetworkType } from './network';
import config from '@/config';

// 基础URL配置 - 从配置文件中获取
const BASE_URL = config.apiBaseUrl;

// 请求超时时间
const TIMEOUT = config.requestTimeout || 30000;

/**
 * 请求工具函数
 * @param {string} url - 请求地址
 * @param {object} options - 请求选项
 * @returns {Promise} - 请求Promise
 */
function request(url, options = {}) {
    return new Promise(async (resolve, reject) => {
        // 检查网络状态
        const networkType = await getNetworkType();
        if (networkType === 'none') {
            uni.showToast({
                title: '网络连接失败，请检查网络设置',
                icon: 'none'
            });
            return reject(new Error('网络连接失败'));
        }

        // 获取完整URL
        const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

        // 获取token
        const token = uni.getStorageSync('token');

        // 设置请求头
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        // 如果存在token，添加到请求头
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // 超时处理
        const timeoutPromise = new Promise((_, timeoutReject) => {
            setTimeout(() => {
                timeoutReject(new Error('请求超时，请稍后再试'));
            }, options.timeout || TIMEOUT);
        });

        // 发起请求
        const fetchPromise = new Promise((fetchResolve, fetchReject) => {
            uni.request({
                url: fullUrl,
                data: options.data,
                method: options.method || 'GET',
                header: headers,
                success: (res) => {
                    // 处理HTTP状态码
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        fetchResolve(res.data);
                    } else if (res.statusCode === 401) {
                        // 处理认证错误
                        uni.removeStorageSync('token');
                        uni.removeStorageSync('userInfo');
                        uni.removeStorageSync('isLoggedIn');

                        uni.showToast({
                            title: '登录已过期，请重新登录',
                            icon: 'none',
                            duration: 2000
                        });

                        // 触发全局未授权事件
                        uni.$emit('unauthorized');

                        // 延迟显示登录弹窗
                        setTimeout(() => {
                            uni.$emit('showLogin');
                        }, 1500);

                        fetchReject(new Error('认证失败，请重新登录'));
                    } else {
                        // 其他错误
                        fetchReject(res.data || {
                            success: false,
                            message: `请求失败，状态码: ${res.statusCode}`
                        });
                    }
                },
                fail: (err) => {
                    console.error('请求失败:', err);
                    fetchReject(new Error(err.errMsg || '请求失败，请稍后再试'));
                }
            });
        });

        // 使用Promise.race来处理超时
        try {
            const result = await Promise.race([fetchPromise, timeoutPromise]);
            resolve(result);
        } catch (error) {
            if (error.message === '请求超时，请稍后再试') {
                uni.showToast({
                    title: '请求超时，请稍后再试',
                    icon: 'none'
                });
            }
            reject(error);
        }
    });
}

// 封装GET请求 - 修复参数构造
request.get = (url, params = {}, options = {}) => {
    // 构建查询字符串 - 兼容App端
    const queryPairs = [];

    // 遍历参数对象，添加到查询参数中
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            queryPairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
        }
    });

    const queryString = queryPairs.join('&');
    const fullUrl = queryString ? `${url}${url.includes('?') ? '&' : '?'}${queryString}` : url;

    console.log('构建的完整URL:', fullUrl);

    return request(fullUrl, {
        method: 'GET',
        ...options
    });
};

// 封装POST请求
request.post = (url, data = {}, options = {}) => {
    return request(url, {
        method: 'POST',
        data,
        ...options
    });
};

// 封装PUT请求
request.put = (url, data = {}, options = {}) => {
    return request(url, {
        method: 'PUT',
        data,
        ...options
    });
};

// 封装DELETE请求
request.delete = (url, data = {}, options = {}) => {
    return request(url, {
        method: 'DELETE',
        data,
        ...options
    });
};

// 封装PATCH请求
request.patch = (url, data = {}, options = {}) => {
    return request(url, {
        method: 'PATCH',
        data,
        ...options
    });
};

export default request;
