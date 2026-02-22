const db = require('../utils/db');

/**
 * AI模型模型类
 */
class Model {
    /**
     * 获取所有可用模型
     * @param {boolean} includeInactive - 是否包含未激活的模型
     * @returns {Promise<Array>} 模型列表
     */
    static async getAll(includeInactive = false) {
        try {
            let query = 'SELECT * FROM models';

            if (!includeInactive) {
                query += ' WHERE is_active = true';
            }

            const [models] = await db.query(query);
            return models;
        } catch (error) {
            console.error('获取模型列表失败:', error);
            throw error;
        }
    }

    /**
     * 根据ID获取模型
     * @param {number|string} id - 模型ID
     * @returns {Promise<Object|null>} 模型信息
     */
    static async getById(id) {
        try {
            // 确保id是一个合法的值类型
            if (id === undefined || id === null) {
                console.warn('获取模型失败: ID为空');
                return null;
            }

            // 如果id是对象，可能是前端直接传递了整个模型对象，尝试提取id
            const modelId = typeof id === 'object' && id !== null ? id.id : id;

            // 如果无法获取有效ID，则返回null
            if (!modelId) {
                console.warn('无效的模型ID:', id);
                return null;
            }

            console.log('查询模型，ID:', modelId, '类型:', typeof modelId);

            // 使用参数化查询，避免SQL注入
            const [models] = await db.query('SELECT * FROM models WHERE id = ? AND is_active = true', [modelId]);

            if (models.length === 0) {
                console.warn(`未找到ID为 ${modelId} 的有效模型`);
                return null;
            }

            const model = models[0];
            console.log(`已找到模型: ID=${model.id}, 名称=${model.name}, API URL=${model.api_url}`);
            return model;
        } catch (error) {
            console.error(`获取模型(ID: ${id})失败:`, error);
            throw error;
        }
    }

    /**
     * 获取分类后的模型列表(免费和付费)
     * @returns {Promise<Object>} 包含免费和付费模型的对象
     */
    static async getCategorizedModels() {
        try {
            const [models] = await db.query('SELECT * FROM models WHERE is_active = true');

            // 分类模型
            const freeModels = models.filter(model => model.is_free === 1);
            const paidModels = models.filter(model => model.is_free === 0);

            return {
                free_models: freeModels.map(model => ({
                    id: model.id,
                    name: model.name,
                    display_name: model.display_name,
                    description: model.description,
                    model_type: model.model_type,
                    is_free: true,
                    icon_path: model.icon_path
                })),
                paid_models: paidModels.map(model => ({
                    id: model.id,
                    name: model.name,
                    display_name: model.display_name,
                    description: model.description,
                    model_type: model.model_type,
                    is_free: false,
                    icon_path: model.icon_path
                }))
            };
        } catch (error) {
            console.error('获取分类模型列表失败:', error);
            throw error;
        }
    }

    /**
     * 创建新模型
     * @param {Object} modelData - 模型数据
     * @returns {Promise<Object>} 创建的模型
     */
    static async create(modelData) {
        try {
            // 定义允许插入的字段列表（基于数据库表结构）
            const allowedFields = [
                'name',
                'display_name', 
                'description',
                'model_type',
                'provider',
                'api_url',
                'api_key',
                'icon_path',
                'is_free',
                'is_active'
            ];

            // 过滤出只包含允许字段的数据
            const filteredData = {};
            Object.keys(modelData).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredData[key] = modelData[key];
                }
            });

            const [result] = await db.query('INSERT INTO models SET ?', [filteredData]);
            return { id: result.insertId, ...filteredData };
        } catch (error) {
            console.error('创建模型失败:', error);
            throw error;
        }
    }

    /**
     * 更新模型
     * @param {number|string} id - 模型ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise<boolean>} 是否更新成功
     */
    static async update(id, updateData) {
        try {
            // 定义允许更新的字段列表（基于数据库表结构）
            const allowedFields = [
                'name',
                'display_name', 
                'description',
                'model_type',
                'provider',
                'api_url',
                'api_key',
                'icon_path',
                'is_free',
                'is_active'
            ];

            // 过滤出只包含允许字段的数据
            const filteredData = {};
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key)) {
                    filteredData[key] = updateData[key];
                }
            });

            // 如果没有有效的更新数据，返回false
            if (Object.keys(filteredData).length === 0) {
                console.warn('没有有效的更新字段');
                return false;
            }

            console.log('更新模型数据:', filteredData);
            const [result] = await db.query('UPDATE models SET ? WHERE id = ?', [filteredData, id]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新模型失败:', error);
            throw error;
        }
    }

    /**
     * 删除模型
     * @param {number|string} id - 模型ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    static async delete(id) {
        try {
            // 硬删除：真正从数据库中删除记录
            const [result] = await db.query('DELETE FROM models WHERE id = ?', [id]);
            
            // 如果删除成功，重置自增ID
            if (result.affectedRows > 0) {
                await this.resetAutoIncrement();
            }
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('删除模型失败:', error);
            throw error;
        }
    }

    /**
     * 重置模型表的自增ID
     * @returns {Promise<void>}
     */
    static async resetAutoIncrement() {
        try {
            // 获取当前最大ID
            const [maxResult] = await db.query('SELECT MAX(id) as max_id FROM models');
            const maxId = maxResult[0].max_id || 0;
            
            // 重置自增值为最大ID+1
            const newAutoIncrement = maxId + 1;
            await db.query(`ALTER TABLE models AUTO_INCREMENT = ${newAutoIncrement}`);
            
            console.log(`✅ 模型表自增ID已重置为: ${newAutoIncrement}`);
        } catch (error) {
            console.error('重置模型表自增ID失败:', error);
            // 不抛出错误，避免影响删除操作
        }
    }
}

module.exports = Model;
