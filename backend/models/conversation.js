const db = require('../utils/db');
const { v4: uuidv4 } = require('uuid');

/**
 * 对话会话模型类
 */
class Conversation {
    /**
     * 创建新会话
     * @param {Object} conversationData - 会话数据
     * @returns {Promise<Object>} 创建的会话
     */
    static async create(conversationData) {
        try {
            // 生成UUID作为会话ID
            const id = uuidv4();
            const data = { id, ...conversationData };

            await db.query('INSERT INTO conversations SET ?', [data]);
            return data;
        } catch (error) {
            console.error('创建会话失败:', error);
            throw error;
        }
    }

    /**
     * 获取用户的会话列表
     * @param {number} userId - 用户ID
     * @param {number} limit - 返回数量
     * @param {string|null} lastId - 上一页的最后一条ID
     * @returns {Promise<Array>} 会话列表
     */
    static async getByUserId(userId, limit = 20, lastId = null) {
        try {
            let query = 'SELECT c.*, m.name as model_name, m.display_name as model_display_name FROM conversations c ' +
                'LEFT JOIN models m ON c.model_id = m.id ' +
                'WHERE c.user_id = ? ';

            const params = [userId];

            if (lastId) {
                query += 'AND c.id < ? ';
                params.push(lastId);
            }

            query += 'ORDER BY c.last_updated DESC LIMIT ?';
            params.push(limit);

            const [conversations] = await db.query(query, params);
            return conversations;
        } catch (error) {
            console.error(`获取用户(ID: ${userId})会话列表失败:`, error);
            throw error;
        }
    }

    /**
     * 根据ID获取会话
     * @param {string} id - 会话ID
     * @returns {Promise<Object|null>} 会话信息
     */
    static async getById(id) {
        try {
            const [rows] = await db.query(
                'SELECT c.*, m.name as model_name, m.display_name as model_display_name, m.id as model_id ' +
                'FROM conversations c ' +
                'LEFT JOIN models m ON c.model_id = m.id ' +
                'WHERE c.id = ?',
                [id]
            );

            if (rows.length === 0) {
                return null;
            }

            return rows[0];
        } catch (error) {
            console.error(`获取会话(ID: ${id})失败:`, error);
            throw error;
        }
    }

    /**
     * 更新会话标题
     * @param {string} id - 会话ID
     * @param {string} title - 新标题
     * @param {number} userId - 用户ID（用于验证权限）
     * @returns {Promise<boolean>} 是否更新成功
     */
    static async updateTitle(id, title, userId) {
        try {
            const [result] = await db.query(
                'UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?',
                [title, id, userId]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error(`更新会话(ID: ${id})标题失败:`, error);
            throw error;
        }
    }

    /**
     * 更新最后一条消息
     * @param {string} id - 会话ID
     * @param {string} message - 最后一条消息
     * @returns {Promise<boolean>} 是否更新成功
     */
    static async updateLastMessage(id, message) {
        try {
            const lastMessage = message.length > 100 ? message.substring(0, 97) + '...' : message;
            const [result] = await db.query(
                'UPDATE conversations SET last_message = ?, last_updated = NOW() WHERE id = ?',
                [lastMessage, id]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error(`更新会话(ID: ${id})最后消息失败:`, error);
            throw error;
        }
    }

    /**
     * 删除会话
     * @param {string} id - 会话ID
     * @param {number} userId - 用户ID（用于验证权限）
     * @returns {Promise<boolean>} 是否删除成功
     */
    static async delete(id, userId) {
        try {
            const [result] = await db.query(
                'DELETE FROM conversations WHERE id = ? AND user_id = ?',
                [id, userId]
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error(`删除会话(ID: ${id})失败:`, error);
            throw error;
        }
    }
}

module.exports = Conversation;
