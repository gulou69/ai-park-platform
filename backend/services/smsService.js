const redisClient = require('../utils/redis');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const EXPIRE_TIME = process.env.SMS_CODE_EXPIRE || 300; // 默认5分钟
const CODE_LENGTH = process.env.SMS_CODE_LENGTH || 6;   // 默认6位验证码

// 内存缓存验证码，用于Redis不可用的情况
const inMemoryCodeCache = new Map();

/**
 * 短信服务
 * 开发阶段将验证码输出到控制台
 */
const smsService = {
    /**
     * 生成随机验证码
     * @returns {string} - 生成的验证码
     */
    generateCode() {
        let code = '';
        for (let i = 0; i < CODE_LENGTH; i++) {
            code += Math.floor(Math.random() * 10);
        }
        return code;
    },

    /**
     * 发送验证码
     * @param {string} phone - 手机号
     * @param {number} type - 验证码类型(1:注册, 2:登录, 3:重置密码)
     * @returns {Promise<string>} - 生成的验证码
     */
    async sendCode(phone, type) {
        // 生成验证码
        const code = this.generateCode();
        // 保存到Redis，键名格式: sms:type:phone
        const key = `sms:${type}:${phone}`;

        try {
            // 尝试保存到Redis
            await redisClient.set(key, code);
            await redisClient.expire(key, EXPIRE_TIME);
        } catch (error) {
            console.warn('Redis不可用，使用内存缓存验证码');
            // 回退到内存缓存
            inMemoryCodeCache.set(key, {
                code,
                expires: Date.now() + EXPIRE_TIME * 1000
            });

            // 设置过期清理
            setTimeout(() => {
                inMemoryCodeCache.delete(key);
            }, EXPIRE_TIME * 1000);
        }

        // 开发阶段: 输出验证码到控制台
        console.log(`📱 发送验证码到 ${phone}: ${code} (类型: ${this.getTypeText(type)})`);

        // 生产环境: 调用真实短信API
        if (process.env.NODE_ENV === 'production') {
            // TODO: 集成真实短信服务
            // await realSmsService.send(phone, `您的验证码是: ${code}, 有效期${EXPIRE_TIME/60}分钟`);
        }

        return code;
    },

    /**
     * 验证验证码是否正确
     * @param {string} phone - 手机号
     * @param {string} code - 用户输入的验证码
     * @param {number} type - 验证码类型
     * @returns {Promise<boolean>} - 是否验证通过
     */
    async verifyCode(phone, code, type) {
        const key = `sms:${type}:${phone}`;

        // 先尝试从Redis获取
        let savedCode = await redisClient.get(key);

        // 如果Redis不可用，从内存缓存获取
        if (savedCode === null && inMemoryCodeCache.has(key)) {
            const cached = inMemoryCodeCache.get(key);
            // 检查是否过期
            if (cached && cached.expires > Date.now()) {
                savedCode = cached.code;
            } else {
                inMemoryCodeCache.delete(key); // 清理过期数据
            }
        }

        if (!savedCode) {
            return false; // 验证码不存在或已过期
        }

        // 验证通过后删除验证码，防止重复使用
        if (savedCode === code) {
            await redisClient.del(key);
            inMemoryCodeCache.delete(key);
            return true;
        }

        return false;
    },

    /**
     * 获取所有验证码
     * @returns {Promise<Array>} - 验证码列表
     */
    async getAllCodes() {
        const codes = [];
        
        try {
            // 从Redis获取所有验证码键
            const keys = await redisClient.keys('sms:*');
            
            for (const key of keys) {
                const code = await redisClient.get(key);
                const ttl = await redisClient.ttl(key);
                
                if (code && ttl > 0) {
                    // 解析键名: sms:type:phone
                    const [, type, phone] = key.split(':');
                    
                    codes.push({
                        phone,
                        code,
                        type: parseInt(type),
                        type_text: this.getTypeText(parseInt(type)),
                        status: 'pending',
                        status_text: '待使用',
                        expires_in: ttl,
                        created_at: new Date(Date.now() - (EXPIRE_TIME - ttl) * 1000).toISOString()
                    });
                }
            }
        } catch (error) {
            console.warn('从Redis获取验证码失败，尝试从内存缓存获取:', error);
            
            // 回退到内存缓存
            for (const [key, value] of inMemoryCodeCache.entries()) {
                if (value.expires > Date.now()) {
                    const [, type, phone] = key.split(':');
                    
                    codes.push({
                        phone,
                        code: value.code,
                        type: parseInt(type),
                        type_text: this.getTypeText(parseInt(type)),
                        status: 'pending',
                        status_text: '待使用',
                        expires_in: Math.floor((value.expires - Date.now()) / 1000),
                        created_at: new Date(Date.now() - (EXPIRE_TIME * 1000 - (value.expires - Date.now()))).toISOString()
                    });
                }
            }
        }
        
        // 按创建时间排序
        return codes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },

    /**
     * 清理过期验证码
     * @returns {Promise<number>} - 清理的数量
     */
    async clearExpiredCodes() {
        let clearedCount = 0;
        
        try {
            const keys = await redisClient.keys('sms:*');
            
            for (const key of keys) {
                const ttl = await redisClient.ttl(key);
                if (ttl <= 0) {
                    await redisClient.del(key);
                    clearedCount++;
                }
            }
        } catch (error) {
            console.warn('清理Redis过期验证码失败:', error);
            
            // 清理内存缓存中的过期数据
            const now = Date.now();
            for (const [key, value] of inMemoryCodeCache.entries()) {
                if (value.expires <= now) {
                    inMemoryCodeCache.delete(key);
                    clearedCount++;
                }
            }
        }
        
        return clearedCount;
    },

    /**
     * 获取验证码统计
     * @returns {Promise<object>} - 统计信息
     */
    async getStats() {
        const stats = {
            total: 0,
            register_codes: 0,
            login_codes: 0,
            reset_codes: 0,
            pending: 0
        };
        
        try {
            const keys = await redisClient.keys('sms:*');
            
            for (const key of keys) {
                const ttl = await redisClient.ttl(key);
                if (ttl > 0) {
                    stats.total++;
                    stats.pending++;
                    
                    const [, type] = key.split(':');
                    const typeNum = parseInt(type);
                    
                    if (typeNum === 1) stats.register_codes++;
                    else if (typeNum === 2) stats.login_codes++;
                    else if (typeNum === 3) stats.reset_codes++;
                }
            }
        } catch (error) {
            console.warn('获取Redis统计失败，使用内存缓存:', error);
            
            const now = Date.now();
            for (const [key, value] of inMemoryCodeCache.entries()) {
                if (value.expires > now) {
                    stats.total++;
                    stats.pending++;
                    
                    const [, type] = key.split(':');
                    const typeNum = parseInt(type);
                    
                    if (typeNum === 1) stats.register_codes++;
                    else if (typeNum === 2) stats.login_codes++;
                    else if (typeNum === 3) stats.reset_codes++;
                }
            }
        }
        
        return stats;
    },

    /**
     * 获取验证码类型文本描述
     * @param {number} type - 验证码类型
     * @returns {string} - 类型描述
     */
    getTypeText(type) {
        switch (type) {
            case 1: return '注册';
            case 2: return '登录';
            case 3: return '重置密码';
            default: return '未知类型';
        }
    }
};

module.exports = smsService;
