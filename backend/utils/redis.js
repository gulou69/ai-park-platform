const { createClient } = require('redis');

// 根据环境加载不同的.env文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.docker' : '.env';
require('dotenv').config({ path: require('path').resolve(process.cwd(), envFile) });

console.log(`使用环境配置文件: ${envFile}`);

// 定义默认值
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || '6379';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// 创建Redis客户端，添加更多配置选项提高稳定性
const redisClient = createClient({
    // 构建更健壮的连接URL
    url: `redis://${REDIS_PASSWORD ? REDIS_PASSWORD + '@' : ''}${REDIS_HOST}:${REDIS_PORT}`,
    socket: {
        // 连接超时设置
        connectTimeout: 10000,
        // 命令超时设置
        commandTimeout: 5000,
        // 保持连接活跃
        keepAlive: 30000,
        // 重连设置
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.log('❌ Redis重连次数超过限制，停止重连');
                return new Error('Redis重连失败');
            }
            const delay = Math.min(retries * 50, 500);
            console.log(`🔄 Redis重连第${retries}次，延迟${delay}ms`);
            return delay;
        }
    },
    // 关闭自动pipelining，提高稳定性
    enableAutoPipelining: false
});

// 添加更好的错误处理
let redisConnected = false;
let redisConnecting = false;

// 连接事件处理
redisClient.on('connect', () => {
    redisConnected = true;
    redisConnecting = false;
    console.log('✅ Redis连接成功');
});

redisClient.on('ready', () => {
    redisConnected = true;
    console.log('✅ Redis就绪可用');
});

redisClient.on('error', (err) => {
    redisConnected = false;
    console.error('❌ Redis连接错误:', err.message);
    // 不要在这里尝试重连，让reconnectStrategy处理
});

redisClient.on('end', () => {
    redisConnected = false;
    console.log('⚠️ Redis连接已断开');
});

redisClient.on('reconnecting', () => {
    redisConnecting = true;
    console.log('🔄 Redis正在重新连接...');
});

// 连接到Redis
(async () => {
    try {
        redisConnecting = true;
        await redisClient.connect();
    } catch (err) {
        redisConnected = false;
        redisConnecting = false;
        console.error('❌ Redis连接失败:', err.message);
        console.log('⚠️ 应用将在没有Redis的情况下继续运行，但验证码功能可能不可用');
    }
})();

// 封装Redis操作，添加错误处理和重连逻辑
const redisWrapper = {
    // 检查连接状态并尝试重连
    async ensureConnection() {
        if (redisConnected) return true;
        if (redisConnecting) return false; // 正在连接中，避免重复连接
        
        try {
            redisConnecting = true;
            if (!redisClient.isOpen) {
                await redisClient.connect();
            }
            return redisConnected;
        } catch (error) {
            redisConnecting = false;
            console.error('Redis重连失败:', error.message);
            return false;
        }
    },

    async get(key) {
        await this.ensureConnection();
        if (!redisConnected) return null;
        try {
            return await redisClient.get(key);
        } catch (error) {
            console.error(`Redis get error for key ${key}:`, error.message);
            redisConnected = false;
            return null;
        }
    },

    async set(key, value) {
        await this.ensureConnection();
        if (!redisConnected) return false;
        try {
            return await redisClient.set(key, value);
        } catch (error) {
            console.error(`Redis set error for key ${key}:`, error.message);
            redisConnected = false;
            return false;
        }
    },

    async expire(key, seconds) {
        await this.ensureConnection();
        if (!redisConnected) return false;
        try {
            return await redisClient.expire(key, seconds);
        } catch (error) {
            console.error(`Redis expire error for key ${key}:`, error.message);
            redisConnected = false;
            return false;
        }
    },

    async del(key) {
        await this.ensureConnection();
        if (!redisConnected) return false;
        try {
            return await redisClient.del(key);
        } catch (error) {
            console.error(`Redis del error for key ${key}:`, error.message);
            redisConnected = false;
            return false;
        }
    },

    async keys(pattern) {
        await this.ensureConnection();
        if (!redisConnected) return [];
        try {
            return await redisClient.keys(pattern);
        } catch (error) {
            console.error(`Redis keys error for pattern ${pattern}:`, error.message);
            redisConnected = false;
            return [];
        }
    },

    async ttl(key) {
        await this.ensureConnection();
        if (!redisConnected) return -1;
        try {
            return await redisClient.ttl(key);
        } catch (error) {
            console.error(`Redis ttl error for key ${key}:`, error.message);
            redisConnected = false;
            return -1;
        }
    }
};

module.exports = redisWrapper;
