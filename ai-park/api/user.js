import request from '@/utils/request'

export const userApi = {
    sendCode(phone, type = 1) {
        return request.post('/api/users/send-code/', { phone, type })
    },

    async register(data) {
        try {
            console.log('准备注册数据:', {
                phone: data.phone,
                password: data.password,
                verification_code: data.code
            });

            const response = await request.post('/api/users/register/', {
                phone: data.phone,
                password: data.password,
                verification_code: data.code
            });

            if (response.success && response.data) {
                // 保存token
                if (response.data.token) {
                    uni.setStorageSync('token', response.data.token);
                    console.log('注册成功，已保存token到本地存储');
                } else {
                    console.error('注册响应中缺少token!');
                }

                // 保存用户信息
                if (response.data.user) {
                    const userInfo = {
                        id: response.data.user.id,
                        phone: response.data.user.phone,
                        avatar: response.data.user.avatar || '/static/icons/person-circle.svg'
                    };

                    uni.setStorageSync('userInfo', userInfo);
                    uni.setStorageSync('isLoggedIn', true);

                    console.log('注册成功，保存用户信息:', userInfo);

                    // 触发用户信息更新事件
                    uni.$emit('update-user-info', userInfo);
                }
            }

            return response;
        } catch (error) {
            throw error;
        }
    },

    async login(data) {
        try {
            const response = await request.post('/api/users/login/', {
                phone: data.phone,
                password: data.password,
                remember: data.remember || false
            });

            if (response.success && response.data) {
                // **关键修复：保存token**
                if (response.data.token) {
                    uni.setStorageSync('token', response.data.token);
                    console.log('已保存token到本地存储');
                } else {
                    console.error('登录响应中缺少token!');
                }

                // 确保用户信息包含ID
                const userInfo = {
                    id: response.data.user && response.data.user.id, // 确保从正确的位置获取ID
                    phone: response.data.user ? response.data.user.phone : (response.data.phone || data.phone),
                    avatar: response.data.user && response.data.user.avatar ? response.data.user.avatar : '/static/icons/person-circle.svg'
                };

                // 打印调试信息
                console.log('登录成功，保存用户信息:', userInfo);
                console.log('登录响应完整数据:', response.data);

                // 存储到uni存储
                uni.setStorageSync('userInfo', userInfo);
                uni.setStorageSync('isLoggedIn', true);

                // 额外保存一份到localStorage，作为备份
                try {
                    localStorage.setItem('userInfo', JSON.stringify(userInfo));
                    if (response.data.token) {
                        localStorage.setItem('token', response.data.token);
                    }
                } catch (e) {
                    console.warn('无法保存信息到localStorage:', e);
                }

                // 触发用户信息更新事件
                uni.$emit('update-user-info', userInfo);
            }

            return response;
        } catch (error) {
            console.error('登录失败:', error);
            throw error;
        }
    },

    // 重置密码
    resetPassword(data) {
        return request.post('/api/users/reset-password/', {
            phone: data.phone,
            verification_code: data.verification_code,
            new_password: data.new_password
        });
    }
}
