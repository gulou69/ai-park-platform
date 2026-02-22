// 使用纯JavaScript的bcryptjs代替本地编译的bcrypt
// 这有助于避免在Docker中可能出现的本地模块崩溃问题
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

// 增加错误处理和日志
const auth = {
    /**
     * 生成密码哈希
     * @param {string} password - 原始密码
     * @returns {Promise<string>} - 哈希后的密码
     */
    async hashPassword(password) {
        const salt = await bcrypt.genSalt(10);
        return bcrypt.hash(password, salt);
    },

    /**
     * 验证密码
     * @param {string} password - 输入的密码
     * @param {string} hash - 数据库中存储的哈希密码
     * @returns {Promise<boolean>} - 是否匹配
     */
    async comparePassword(password, hash) {
        try {
            // 确保输入是字符串
            if (typeof password !== 'string' || typeof hash !== 'string') {
                console.error('密码验证错误: 参数不是字符串', {
                    passwordType: typeof password, 
                    hashType: typeof hash
                });
                return false;
            }
            
            // 避免使用损坏的哈希值
            if (!hash || hash.length < 10) {
                console.error('密码验证错误: 哈希值无效');
                return false;
            }
            
            return await bcrypt.compare(password, hash);
        } catch (error) {
            console.error('密码验证过程发生错误:', error);
            return false;
        }
    },

    /**
     * 生成JWT令牌
     * @param {object} payload - 要编码到令牌中的数据
     * @returns {string} - JWT令牌
     */
    generateToken(payload) {
        // 默认7天过期
        const expiresIn = process.env.JWT_EXPIRE || '7d';
        return jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn }
        );
    },

    /**
     * 验证JWT令牌
     * @param {string} token - JWT令牌
     * @returns {object|null} - 解码后的payload或null(如果无效)
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            return null;
        }
    }
};

module.exports = auth;
