const pool = require('../utils/db');
const auth = require('../utils/auth');

/**
 * 用户模型
 */
const User = {
    /**
     * 根据ID查询用户
     * @param {number} id - 用户ID
     * @returns {Promise<object|null>} - 用户对象或null
     */
    async findById(id) {
        try {
            const [rows] = await pool.query(
                'SELECT id, phone, avatar, is_active, created_at, updated_at FROM users WHERE id = ?',
                [id]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('查询用户失败:', error);
            throw error;
        }
    },

    /**
     * 根据手机号查询用户
     * @param {string} phone - 手机号
     * @returns {Promise<object|null>} - 用户对象或null
     */
    async findByPhone(phone) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM users WHERE phone = ?',
                [phone]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('查询用户失败:', error);
            throw error;
        }
    },

    /**
     * 创建新用户
     * @param {object} userData - 用户数据
     * @returns {Promise<object>} - 创建的用户对象
     */
    async create(userData) {
        try {
            // 对密码进行哈希处理
            const hashedPassword = await auth.hashPassword(userData.password);

            const [result] = await pool.query(
                'INSERT INTO users (phone, password, avatar, is_active) VALUES (?, ?, ?, ?)',
                [userData.phone, hashedPassword, userData.avatar || '/static/icons/person-circle.svg', true]
            );

            const userId = result.insertId;
            return this.findById(userId);
        } catch (error) {
            console.error('创建用户失败:', error);
            throw error;
        }
    },

    /**
     * 更新用户登录时间
     * @param {number} id - 用户ID
     * @returns {Promise<void>}
     */
    async updateLoginTime(id) {
        try {
            await pool.query(
                'UPDATE users SET last_login = NOW() WHERE id = ?',
                [id]
            );
        } catch (error) {
            console.error('更新登录时间失败:', error);
            throw error;
        }
    },

    /**
     * 更新用户密码
     * @param {string} phone - 手机号
     * @param {string} newPassword - 新密码
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async updatePassword(phone, newPassword) {
        try {
            const hashedPassword = await auth.hashPassword(newPassword);

            const [result] = await pool.query(
                'UPDATE users SET password = ? WHERE phone = ?',
                [hashedPassword, phone]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新密码失败:', error);
            throw error;
        }
    },

    /**
     * 更新用户头像
     * @param {number} id - 用户ID
     * @param {string} avatarUrl - 头像URL
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async updateAvatar(id, avatarUrl) {
        try {
            const [result] = await pool.query(
                'UPDATE users SET avatar = ? WHERE id = ?',
                [avatarUrl, id]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新头像失败:', error);
            throw error;
        }
    }
};

module.exports = User;
