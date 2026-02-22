const pool = require('../utils/db');
const auth = require('../utils/auth');

/**
 * 管理员模型
 */
const Admin = {
    /**
     * 根据ID查询管理员
     * @param {number} id - 管理员ID
     * @returns {Promise<object|null>} - 管理员对象或null
     */
    async findById(id) {
        try {
            const [rows] = await pool.query(
                'SELECT id, username, email, role, permissions, is_active, last_login, created_at, updated_at FROM admins WHERE id = ?',
                [id]
            );
            
            if (rows.length > 0) {
                const admin = rows[0];
                // 转换 is_active 字段为布尔值
                admin.is_active = !!admin.is_active;
                return admin;
            }
            
            return null;
        } catch (error) {
            console.error('查询管理员失败:', error);
            throw error;
        }
    },

    /**
     * 根据用户名查询管理员
     * @param {string} username - 用户名
     * @returns {Promise<object|null>} - 管理员对象或null
     */
    async findByUsername(username) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM admins WHERE username = ?',
                [username]
            );
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('查询管理员失败:', error);
            throw error;
        }
    },

    /**
     * 获取所有管理员
     * @param {object} options - 查询选项
     * @returns {Promise<Array>} - 管理员列表
     */
    async getAll(options = {}) {
        try {
            let sql = 'SELECT id, username, email, role, is_active, last_login, created_at, updated_at FROM admins';
            const params = [];

            // 添加过滤条件
            if (options.role) {
                sql += ' WHERE role = ?';
                params.push(options.role);
            }

            // 添加排序
            sql += ' ORDER BY created_at DESC';

            // 添加分页
            if (options.page && options.pageSize) {
                const offset = (options.page - 1) * options.pageSize;
                sql += ' LIMIT ? OFFSET ?';
                params.push(options.pageSize, offset);
            }

            const [rows] = await pool.query(sql, params);
            
            // 转换 is_active 字段为布尔值
            return rows.map(row => ({
                ...row,
                is_active: !!row.is_active
            }));
        } catch (error) {
            console.error('获取管理员列表失败:', error);
            throw error;
        }
    },

    /**
     * 创建新管理员
     * @param {object} adminData - 管理员数据
     * @returns {Promise<object>} - 创建的管理员对象
     */
    async create(adminData) {
        try {
            // 如果尝试创建超级管理员，检查是否已存在
            if (adminData.role === 'super_admin') {
                const [existingSuperAdmin] = await pool.query(
                    'SELECT id FROM admins WHERE role = "super_admin"'
                );
                if (existingSuperAdmin.length > 0) {
                    throw new Error('系统中只能有一个超级管理员');
                }
            }

            // 对密码进行哈希处理
            const hashedPassword = await auth.hashPassword(adminData.password);

            // 根据角色自动设置权限
            const rolePermissions = this.getRolePermissions(adminData.role || 'operator');

            const [result] = await pool.query(
                'INSERT INTO admins (username, password, email, role, permissions, is_active) VALUES (?, ?, ?, ?, ?, ?)',
                [
                    adminData.username,
                    hashedPassword,
                    adminData.email || null,
                    adminData.role || 'operator',
                    JSON.stringify(rolePermissions),
                    adminData.is_active !== false
                ]
            );

            const adminId = result.insertId;
            return this.findById(adminId);
        } catch (error) {
            console.error('创建管理员失败:', error);
            throw error;
        }
    },

    /**
     * 更新管理员信息
     * @param {number} id - 管理员ID
     * @param {object} updateData - 更新数据
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async update(id, updateData) {
        try {
            const fields = [];
            const values = [];

            // 构建更新字段
            if (updateData.username !== undefined) {
                fields.push('username = ?');
                values.push(updateData.username);
            }
            if (updateData.email !== undefined) {
                fields.push('email = ?');
                values.push(updateData.email);
            }
            if (updateData.role !== undefined) {
                fields.push('role = ?');
                values.push(updateData.role);
            }
            if (updateData.permissions !== undefined) {
                fields.push('permissions = ?');
                values.push(JSON.stringify(updateData.permissions));
            }
            if (updateData.is_active !== undefined) {
                fields.push('is_active = ?');
                values.push(updateData.is_active);
            }
            if (updateData.password !== undefined) {
                const hashedPassword = await auth.hashPassword(updateData.password);
                fields.push('password = ?');
                values.push(hashedPassword);
            }

            if (fields.length === 0) {
                return false;
            }

            values.push(id);
            const [result] = await pool.query(
                `UPDATE admins SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            return result.affectedRows > 0;
        } catch (error) {
            console.error('更新管理员失败:', error);
            throw error;
        }
    },

    /**
     * 删除管理员
     * @param {number} id - 管理员ID
     * @returns {Promise<boolean>} - 是否删除成功
     */
    async delete(id) {
        try {
            const [result] = await pool.query(
                'DELETE FROM admins WHERE id = ? AND role != "super_admin"',
                [id]
            );
            
            // 如果删除成功，重置自增ID
            if (result.affectedRows > 0) {
                await this.resetAutoIncrement();
            }
            
            return result.affectedRows > 0;
        } catch (error) {
            console.error('删除管理员失败:', error);
            throw error;
        }
    },

    /**
     * 重置管理员表的自增ID
     * @returns {Promise<void>}
     */
    async resetAutoIncrement() {
        try {
            // 获取当前最大ID
            const [maxResult] = await pool.query('SELECT MAX(id) as max_id FROM admins');
            const maxId = maxResult[0].max_id || 0;
            
            // 重置自增值为最大ID+1
            const newAutoIncrement = maxId + 1;
            await pool.query(`ALTER TABLE admins AUTO_INCREMENT = ${newAutoIncrement}`);
            
            console.log(`✅ 管理员表自增ID已重置为: ${newAutoIncrement}`);
        } catch (error) {
            console.error('重置管理员表自增ID失败:', error);
            // 不抛出错误，避免影响删除操作
        }
    },

    /**
     * 更新登录时间
     * @param {number} id - 管理员ID
     * @returns {Promise<void>}
     */
    async updateLoginTime(id) {
        try {
            await pool.query(
                'UPDATE admins SET last_login = NOW() WHERE id = ?',
                [id]
            );
        } catch (error) {
            console.error('更新登录时间失败:', error);
            throw error;
        }
    },

    /**
     * 获取管理员总数
     * @returns {Promise<number>} - 管理员总数
     */
    async getCount() {
        try {
            const [rows] = await pool.query('SELECT COUNT(*) as count FROM admins');
            return rows[0].count;
        } catch (error) {
            console.error('获取管理员总数失败:', error);
            throw error;
        }
    },

    /**
     * 检查是否已存在超级管理员
     * @returns {Promise<boolean>} - 是否存在超级管理员
     */
    async hasSuperAdmin() {
        try {
            const [rows] = await pool.query('SELECT id FROM admins WHERE role = "super_admin"');
            return rows.length > 0;
        } catch (error) {
            console.error('检查超级管理员失败:', error);
            throw error;
        }
    },

    /**
     * 获取角色权限定义
     * @param {string} role - 角色名称
     * @returns {Array} - 权限列表
     */
    getRolePermissions(role) {
        const permissions = {
            'super_admin': [
                'user_management',
                'model_management', 
                'conversation_management',
                'admin_management',
                'system_stats',
                'system_config'
            ],
            'admin': [
                'user_management',
                'model_management',
                'conversation_management', 
                'system_stats'
            ],
            'operator': [
                'model_management',
                'system_stats'
            ]
        };
        return permissions[role] || [];
    },

    /**
     * 检查用户是否有指定权限
     * @param {object} admin - 管理员对象
     * @param {string} permission - 权限名称
     * @returns {boolean} - 是否有权限
     */
    hasPermission(admin, permission) {
        if (!admin || !admin.role) return false;
        
        // 超级管理员拥有所有权限
        if (admin.role === 'super_admin') return true;
        
        const rolePermissions = this.getRolePermissions(admin.role);
        return rolePermissions.includes(permission);
    }
};

module.exports = Admin; 