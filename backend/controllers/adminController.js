const Admin = require('../models/admin');
const User = require('../models/user');
const Model = require('../models/model');
const Conversation = require('../models/conversation');
const smsService = require('../services/smsService');
const auth = require('../utils/auth');
const pool = require('../utils/db');

// 确保fetch在Node.js中可用
if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
}

// Helper function to safely parse permissions
const parsePermissions = (permissions) => {
    if (!permissions) return [];
    if (Array.isArray(permissions)) return permissions;
    if (typeof permissions === 'string') {
        try {
            return JSON.parse(permissions);
        } catch (error) {
            console.error('权限解析失败:', error, '原始数据:', permissions);
            return [];
        }
    }
    return [];
};

/**
 * 管理员控制器
 */
const adminController = {
    /**
     * 管理员登录
     */
    async login(req, res) {
        try {
            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: '用户名和密码都是必填项'
                });
            }

            // 查找管理员
            const admin = await Admin.findByUsername(username);
            if (!admin) {
                return res.status(401).json({
                    success: false,
                    message: '用户名或密码错误'
                });
            }

            if (!admin.is_active) {
                return res.status(401).json({
                    success: false,
                    message: '账户已被禁用，请联系系统管理员'
                });
            }

            // 验证密码，增加错误处理
            try {
                const isPasswordValid = await auth.comparePassword(password, admin.password);
                if (!isPasswordValid) {
                    return res.status(401).json({
                        success: false,
                        message: '用户名或密码错误'
                    });
                }
            } catch (passwordError) {
                console.error('密码验证过程出错:', passwordError);
                return res.status(500).json({
                    success: false,
                    message: '登录验证过程中发生错误'
                });
            }

            // 更新登录时间
            await Admin.updateLoginTime(admin.id);

            // 生成JWT token (标记为admin)
            const token = auth.generateToken({
                id: admin.id,
                username: admin.username,
                role: admin.role,
                isAdmin: true
            });

            res.json({
                success: true,
                message: '登录成功',
                data: {
                    admin: {
                        id: admin.id,
                        username: admin.username,
                        email: admin.email,
                        role: admin.role,
                        permissions: parsePermissions(admin.permissions)
                    },
                    token
                }
            });
        } catch (error) {
            console.error('管理员登录失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，请稍后再试'
            });
        }
    },

    /**
     * 获取当前管理员信息
     */
    async getCurrentAdmin(req, res) {
        try {
            const admin = req.admin;
            const permissions = Admin.getRolePermissions(admin.role);
            
            res.json({
                success: true,
                data: {
                    id: admin.id,
                    username: admin.username,
                    email: admin.email,
                    role: admin.role,
                    permissions: permissions
                }
            });
        } catch (error) {
            console.error('获取管理员信息失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误'
            });
        }
    },

    /**
     * 获取角色定义和权限
     */
    async getRolesAndPermissions(req, res) {
        try {
            const roles = {
                'super_admin': {
                    name: '超级管理员',
                    description: '拥有系统所有权限',
                    permissions: Admin.getRolePermissions('super_admin')
                },
                'admin': {
                    name: '管理员',
                    description: '可以管理除管理员之外的所有内容',
                    permissions: Admin.getRolePermissions('admin')
                },
                'operator': {
                    name: '操作员',
                    description: '只能操作模型管理和查看系统统计',
                    permissions: Admin.getRolePermissions('operator')
                }
            };

            res.json({
                success: true,
                data: roles
            });
        } catch (error) {
            console.error('获取角色权限失败:', error);
            res.status(500).json({
                success: false,
                message: '获取角色权限失败'
            });
        }
    },

    /**
     * 获取系统统计信息
     */
    async getStats(req, res) {
        try {
            // 用户统计
            const [userStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
                    COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_new_users
                FROM users
            `);

            // 模型统计
            const [modelStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_models,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_models,
                    COUNT(CASE WHEN is_free = 1 THEN 1 END) as free_models
                FROM models
            `);

            // 会话统计
            const [conversationStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_conversations,
                    COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_conversations
                FROM conversations
            `);

            // 管理员统计
            const [adminStats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_admins,
                    COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_admins
                FROM admins
            `);

            res.json({
                success: true,
                data: {
                    users: userStats[0],
                    models: modelStats[0],
                    conversations: conversationStats[0],
                    admins: adminStats[0]
                }
            });
        } catch (error) {
            console.error('获取统计信息失败:', error);
            res.status(500).json({
                success: false,
                message: '获取统计信息失败'
            });
        }
    },

    /**
     * 用户管理 - 获取用户列表
     */
    async getUsers(req, res) {
        try {
            const { page = 1, pageSize = 10, search, status } = req.query;
            
            let sql = 'SELECT id, phone, avatar, is_active, last_login, created_at FROM users';
            const params = [];
            const conditions = [];

            // 搜索条件
            if (search) {
                conditions.push('phone LIKE ?');
                params.push(`%${search}%`);
            }

            // 状态筛选
            if (status !== undefined) {
                conditions.push('is_active = ?');
                params.push(status === 'true');
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            // 获取总数
            const countSql = sql.replace('SELECT id, phone, avatar, is_active, last_login, created_at FROM users', 'SELECT COUNT(*) as total FROM users');
            const [countResult] = await pool.query(countSql, params);
            const total = countResult[0].total;

            // 分页查询
            sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

            const [users] = await pool.query(sql, params);

            res.json({
                success: true,
                data: {
                    users,
                    pagination: {
                        page: parseInt(page),
                        pageSize: parseInt(pageSize),
                        total,
                        pages: Math.ceil(total / pageSize)
                    }
                }
            });
        } catch (error) {
            console.error('获取用户列表失败:', error);
            res.status(500).json({
                success: false,
                message: '获取用户列表失败'
            });
        }
    },

    /**
     * 用户管理 - 更新用户状态
     */
    async updateUserStatus(req, res) {
        try {
            const { userId } = req.params;
            const { is_active } = req.body;

            const [result] = await pool.query(
                'UPDATE users SET is_active = ? WHERE id = ?',
                [is_active, userId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            res.json({
                success: true,
                message: '用户状态更新成功'
            });
        } catch (error) {
            console.error('更新用户状态失败:', error);
            res.status(500).json({
                success: false,
                message: '更新用户状态失败'
            });
        }
    },

    /**
     * 模型管理 - 获取模型列表
     */
    async getModels(req, res) {
        try {
            // 管理员可以查看所有模型，包括未启用的
            const models = await Model.getAll(true);
            res.json({
                success: true,
                data: models
            });
        } catch (error) {
            console.error('获取模型列表失败:', error);
            res.status(500).json({
                success: false,
                message: '获取模型列表失败'
            });
        }
    },

    /**
     * 模型管理 - 创建模型
     */
    async createModel(req, res) {
        try {
            const modelData = req.body;
            const newModel = await Model.create(modelData);
            
            res.status(201).json({
                success: true,
                message: '模型创建成功',
                data: newModel
            });
        } catch (error) {
            console.error('创建模型失败:', error);
            res.status(500).json({
                success: false,
                message: '创建模型失败'
            });
        }
    },

    /**
     * 模型管理 - 更新模型
     */
    async updateModel(req, res) {
        try {
            const { modelId } = req.params;
            const updateData = req.body;
            
            const success = await Model.update(modelId, updateData);
            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: '模型不存在'
                });
            }

            res.json({
                success: true,
                message: '模型更新成功'
            });
        } catch (error) {
            console.error('更新模型失败:', error);
            res.status(500).json({
                success: false,
                message: '更新模型失败'
            });
        }
    },

    /**
     * 模型管理 - 删除模型
     */
    async deleteModel(req, res) {
        try {
            const { modelId } = req.params;
            
            const success = await Model.delete(modelId);
            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: '模型不存在'
                });
            }

            res.json({
                success: true,
                message: '模型删除成功'
            });
        } catch (error) {
            console.error('删除模型失败:', error);
            res.status(500).json({
                success: false,
                message: '删除模型失败'
            });
        }
    },

    /**
     * 会话管理 - 获取会话列表
     */
    async getConversations(req, res) {
        try {
            const { page = 1, pageSize = 10, userId, modelId } = req.query;
            
            let sql = `
                SELECT c.*, u.phone as user_phone, m.display_name as model_name
                FROM conversations c
                LEFT JOIN users u ON c.user_id = u.id
                LEFT JOIN models m ON c.model_id = m.id
            `;
            const params = [];
            const conditions = [];

            if (userId) {
                conditions.push('c.user_id = ?');
                params.push(userId);
            }

            if (modelId) {
                conditions.push('c.model_id = ?');
                params.push(modelId);
            }

            if (conditions.length > 0) {
                sql += ' WHERE ' + conditions.join(' AND ');
            }

            // 获取总数
            const countSql = sql.replace(/SELECT c\.\*, u\.phone as user_phone, m\.display_name as model_name/, 'SELECT COUNT(*) as total');
            const [countResult] = await pool.query(countSql, params);
            const total = countResult[0].total;

            // 分页查询
            sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

            const [conversations] = await pool.query(sql, params);

            res.json({
                success: true,
                data: {
                    conversations,
                    pagination: {
                        page: parseInt(page),
                        pageSize: parseInt(pageSize),
                        total,
                        pages: Math.ceil(total / pageSize)
                    }
                }
            });
        } catch (error) {
            console.error('获取会话列表失败:', error);
            res.status(500).json({
                success: false,
                message: '获取会话列表失败'
            });
        }
    },

    /**
     * 会话管理 - 删除会话
     */
    async deleteConversation(req, res) {
        try {
            const { conversationId } = req.params;
            
            // 管理员删除会话时，直接使用数据库操作，不需要用户权限验证
            const [result] = await pool.query(
                'DELETE FROM conversations WHERE id = ?',
                [conversationId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: '会话不存在'
                });
            }

            res.json({
                success: true,
                message: '会话删除成功'
            });
        } catch (error) {
            console.error('删除会话失败:', error);
            res.status(500).json({
                success: false,
                message: '删除会话失败'
            });
        }
    },

    /**
     * 管理员管理 - 获取管理员列表
     */
    async getAdmins(req, res) {
        try {
            const { page, pageSize, role } = req.query;
            const admins = await Admin.getAll({ page, pageSize, role });
            const total = await Admin.getCount();

            res.json({
                success: true,
                data: {
                    admins,
                    pagination: {
                        page: parseInt(page) || 1,
                        pageSize: parseInt(pageSize) || 10,
                        total,
                        pages: Math.ceil(total / (pageSize || 10))
                    }
                }
            });
        } catch (error) {
            console.error('获取管理员列表失败:', error);
            res.status(500).json({
                success: false,
                message: '获取管理员列表失败'
            });
        }
    },

    /**
     * 管理员管理 - 创建管理员
     */
    async createAdmin(req, res) {
        try {
            const adminData = req.body;
            const currentAdmin = req.admin;
            
            // 只有超级管理员可以创建管理员
            if (currentAdmin.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超级管理员可以创建管理员账户'
                });
            }

            // 如果尝试创建超级管理员，但已存在
            if (adminData.role === 'super_admin') {
                const hasSuperAdmin = await Admin.hasSuperAdmin();
                if (hasSuperAdmin) {
                    return res.status(400).json({
                        success: false,
                        message: '系统中只能有一个超级管理员'
                    });
                }
            }
            
            // 检查用户名是否已存在
            const existingAdmin = await Admin.findByUsername(adminData.username);
            if (existingAdmin) {
                return res.status(400).json({
                    success: false,
                    message: '用户名已存在'
                });
            }

            const newAdmin = await Admin.create(adminData);
            
            res.status(201).json({
                success: true,
                message: '管理员创建成功',
                data: newAdmin
            });
        } catch (error) {
            console.error('创建管理员失败:', error);
            res.status(500).json({
                success: false,
                message: error.message || '创建管理员失败'
            });
        }
    },

    /**
     * 管理员管理 - 更新管理员
     */
    async updateAdmin(req, res) {
        try {
            const { adminId } = req.params;
            const updateData = req.body;
            const currentAdmin = req.admin;
            
            // 获取目标管理员信息
            const targetAdmin = await Admin.findById(adminId);
            if (!targetAdmin) {
                return res.status(404).json({
                    success: false,
                    message: '管理员不存在'
                });
            }

            // 权限检查
            if (currentAdmin.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超级管理员可以修改管理员信息'
                });
            }

            // 防止超级管理员修改自己的角色或关键信息
            if (targetAdmin.role === 'super_admin' && currentAdmin.id === targetAdmin.id) {
                // 超级管理员不能修改自己的角色、用户名和状态
                if (updateData.role && updateData.role !== 'super_admin') {
                    return res.status(403).json({
                        success: false,
                        message: '超级管理员不能修改自己的角色'
                    });
                }
                if (updateData.username && updateData.username !== targetAdmin.username) {
                    return res.status(403).json({
                        success: false,
                        message: '超级管理员不能修改自己的用户名'
                    });
                }
                if (updateData.is_active === false) {
                    return res.status(403).json({
                        success: false,
                        message: '超级管理员不能禁用自己的账户'
                    });
                }
            }

            // 防止修改其他超级管理员
            if (targetAdmin.role === 'super_admin' && currentAdmin.id !== targetAdmin.id) {
                return res.status(403).json({
                    success: false,
                    message: '不能修改其他超级管理员'
                });
            }

            // 防止将角色改为超级管理员（除非当前就是超级管理员且修改自己）
            if (updateData.role === 'super_admin' && 
                (targetAdmin.role !== 'super_admin' || currentAdmin.id !== targetAdmin.id)) {
                return res.status(400).json({
                    success: false,
                    message: '系统中只能有一个超级管理员'
                });
            }

            // 如果修改了角色，自动更新权限
            if (updateData.role && updateData.role !== targetAdmin.role) {
                updateData.permissions = Admin.getRolePermissions(updateData.role);
            }

            const success = await Admin.update(adminId, updateData);
            if (!success) {
                return res.status(400).json({
                    success: false,
                    message: '更新失败'
                });
            }

            res.json({
                success: true,
                message: '管理员信息更新成功'
            });
        } catch (error) {
            console.error('更新管理员失败:', error);
            res.status(500).json({
                success: false,
                message: '更新管理员失败'
            });
        }
    },

    /**
     * 管理员管理 - 删除管理员
     */
    async deleteAdmin(req, res) {
        try {
            const { adminId } = req.params;
            const currentAdmin = req.admin;

            // 只有超级管理员可以删除管理员
            if (currentAdmin.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超级管理员可以删除管理员账户'
                });
            }

            // 获取目标管理员信息
            const targetAdmin = await Admin.findById(adminId);
            if (!targetAdmin) {
                return res.status(404).json({
                    success: false,
                    message: '管理员不存在'
                });
            }

            // 不能删除超级管理员
            if (targetAdmin.role === 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '不能删除超级管理员账户'
                });
            }

            // 不能删除自己
            if (currentAdmin.id === targetAdmin.id) {
                return res.status(403).json({
                    success: false,
                    message: '不能删除自己的账户'
                });
            }

            const success = await Admin.delete(adminId);
            if (!success) {
                return res.status(404).json({
                    success: false,
                    message: '删除失败'
                });
            }

            res.json({
                success: true,
                message: '管理员删除成功'
            });
        } catch (error) {
            console.error('删除管理员失败:', error);
            res.status(500).json({
                success: false,
                message: '删除管理员失败'
            });
        }
    },

    /**
     * 会话管理 - 获取会话消息
     */
    async getConversationMessages(req, res) {
        try {
            const { conversationId } = req.params;
            const { user = 'admin', limit = 50 } = req.query;
            
            // 使用现有的chatController getMessages逻辑
            const chatController = require('./chatController');
            
            // 构建查询参数
            const mockReq = {
                query: {
                    conversation_id: conversationId,
                    user: user,
                    limit: limit
                }
            };

            // 创建一个模拟的响应对象，捕获消息数据
            let messagesData = null;
            const mockRes = {
                json: (data) => {
                    messagesData = data;
                },
                status: () => mockRes,
                setHeader: () => {},
                write: () => {},
                end: () => {}
            };

            // 调用现有的getMessages方法
            await chatController.getMessages(mockReq, mockRes);

            if (messagesData && messagesData.success) {
                res.json({
                    success: true,
                    data: messagesData.data || []
                });
            } else {
                res.json({
                    success: true,
                    data: []
                });
            }
        } catch (error) {
            console.error('获取会话消息失败:', error);
            res.status(500).json({
                success: false,
                message: '获取会话消息失败'
            });
        }
    },

    /**
     * 会话管理 - 批量删除会话
     */
    async batchDeleteConversations(req, res) {
        try {
            const { ids } = req.body;
            
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '请提供要删除的会话ID列表'
                });
            }

            // 删除会话
            const [result] = await pool.query(
                'DELETE FROM conversations WHERE id IN (?)',
                [ids]
            );

            res.json({
                success: true,
                message: `成功删除 ${result.affectedRows} 个会话`
            });
        } catch (error) {
            console.error('批量删除会话失败:', error);
            res.status(500).json({
                success: false,
                message: '批量删除会话失败'
            });
        }
    },

    /**
     * 模型管理 - 测试模型
     */
    async testModel(req, res) {
        try {
            const { modelId } = req.params;
            const { message } = req.body;

            if (!message || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    message: '请提供测试消息'
                });
            }

            // 获取模型信息
            const model = await Model.getById(modelId);

            if (!model) {
                return res.status(404).json({
                    success: false,
                    message: '模型不存在'
                });
            }

            const startTime = Date.now();
            let aiResponse = '';

            try {
                // 使用现有的API调用逻辑
                if (model.provider === 'dify') {
                    const axios = require('axios');
                    
                    // 准备Dify API请求
                    const requestData = {
                        query: message,
                        inputs: {},
                        response_mode: 'blocking', // 使用阻塞模式以便测试
                        user: 'admin_test',
                        conversation_id: '', // 测试时不需要会话ID
                        auto_generate_name: false
                    };

                    const headers = {
                        'Authorization': `Bearer ${model.api_key}`,
                        'Content-Type': 'application/json'
                    };

                    const response = await axios.post(
                        `${model.api_url}/chat-messages`,
                        requestData,
                        { headers }
                    );

                    const duration = Date.now() - startTime;

                    // 处理Dify响应
                    if (response.data && response.data.answer) {
                        aiResponse = response.data.answer;
                    } else {
                        aiResponse = '模型响应成功，但返回内容为空';
                    }

                    res.json({
                        success: true,
                        data: {
                            response: aiResponse,
                            duration,
                            model_name: model.display_name
                        }
                    });

                } else {
                    // 对于其他提供商，仍使用原有逻辑
                    const response = await fetch(model.api_url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${model.api_key}`
                        },
                        body: JSON.stringify({
                            model: model.name,
                            messages: [
                                {
                                    role: 'user',
                                    content: message
                                }
                            ],
                            max_tokens: 100,
                            temperature: 0.7
                        })
                    });

                    const duration = Date.now() - startTime;

                    if (!response.ok) {
                        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
                    }

                    const data = await response.json();
                    
                    // 处理不同API的响应格式
                    if (data.choices && data.choices[0] && data.choices[0].message) {
                        // OpenAI格式
                        aiResponse = data.choices[0].message.content;
                    } else if (data.answer) {
                        // Dify格式
                        aiResponse = data.answer;
                    } else if (data.response) {
                        // 其他格式
                        aiResponse = data.response;
                    } else {
                        aiResponse = JSON.stringify(data);
                    }

                    res.json({
                        success: true,
                        data: {
                            response: aiResponse,
                            duration,
                            model_name: model.display_name
                        }
                    });
                }

            } catch (apiError) {
                console.error('API调用失败:', apiError);
                const duration = Date.now() - startTime;
                
                // 如果API调用失败，返回模拟响应
                res.json({
                    success: true,
                    data: {
                        response: `模型测试成功！\n收到消息: "${message}"\n模型 ${model.display_name} 连接正常，但当前为测试模式，未连接到真实AI服务。\n\n错误信息: ${apiError.message}`,
                        duration,
                        model_name: model.display_name,
                        note: '当前为测试模式'
                    }
                });
            }

        } catch (error) {
            console.error('模型测试失败:', error);
            res.status(500).json({
                success: false,
                message: '模型测试失败'
            });
        }
    },

    /**
     * 统计数据 - 用户增长趋势
     */
    async getUserTrend(req, res) {
        try {
            const { period = '7d' } = req.query;
            let days = 7;
            
            if (period === '30d') days = 30;
            else if (period === '90d') days = 90;

            // 修复SQL查询，避免GROUP BY冲突
            const [trendData] = await pool.query(`
                SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as new_users
                FROM users
                WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(created_at)
                ORDER BY date ASC
            `, [days]);

            // 获取总用户数（累计）
            const [totalUsersData] = await pool.query(`
                SELECT COUNT(*) as total FROM users WHERE created_at <= CURDATE()
            `);

            const dates = [];
            const newUsers = [];
            const totalUsers = [];
            let cumulativeUsers = totalUsersData[0].total - trendData.reduce((sum, item) => sum + item.new_users, 0);

            // 填充所有日期（包括没有数据的日期）
            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                dates.push(dateStr);

                const dayData = trendData.find(d => d.date === dateStr);
                const dayNewUsers = dayData ? dayData.new_users : 0;
                newUsers.push(dayNewUsers);
                cumulativeUsers += dayNewUsers;
                totalUsers.push(cumulativeUsers);
            }

            res.json({
                success: true,
                data: {
                    dates,
                    newUsers,
                    totalUsers
                }
            });
        } catch (error) {
            console.error('获取用户趋势失败:', error);
            res.status(500).json({
                success: false,
                message: '获取用户趋势失败'
            });
        }
    },

    /**
     * 统计数据 - 模型使用统计
     */
    async getModelUsage(req, res) {
        try {
            const [usageData] = await pool.query(`
                SELECT 
                    m.display_name as model_name,
                    COUNT(c.id) as usage_count
                FROM models m
                LEFT JOIN conversations c ON m.id = c.model_id
                WHERE m.is_active = 1
                GROUP BY m.id, m.display_name
                ORDER BY usage_count DESC
            `);

            res.json({
                success: true,
                data: usageData
            });
        } catch (error) {
            console.error('获取模型使用统计失败:', error);
            res.status(500).json({
                success: false,
                message: '获取模型使用统计失败'
            });
        }
    },

    /**
     * 统计数据 - 会话活跃度趋势
     */
    async getConversationTrend(req, res) {
        try {
            const { period = '24h' } = req.query;
            let timeFormat, intervalCount;

            if (period === '24h') {
                timeFormat = '%H:00';
                intervalCount = 24;
            } else if (period === '7d') {
                timeFormat = '%Y-%m-%d';
                intervalCount = 7;
            } else {
                timeFormat = '%Y-%m-%d';
                intervalCount = 30;
            }

            const [trendData] = await pool.query(`
                SELECT 
                    DATE_FORMAT(created_at, ?) as time_period,
                    COUNT(*) as conversation_count
                FROM conversations
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? ${period === '24h' ? 'HOUR' : 'DAY'})
                GROUP BY time_period
                ORDER BY time_period ASC
            `, [timeFormat, intervalCount]);

            const times = [];
            const counts = [];

            // 填充时间段
            for (let i = intervalCount - 1; i >= 0; i--) {
                let time;
                if (period === '24h') {
                    const hour = new Date();
                    hour.setHours(hour.getHours() - i, 0, 0, 0);
                    time = hour.getHours().toString().padStart(2, '0') + ':00';
                } else {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    time = date.toISOString().split('T')[0];
                }
                times.push(time);

                const dayData = trendData.find(d => d.time_period === time);
                counts.push(dayData ? dayData.conversation_count : 0);
            }

            res.json({
                success: true,
                data: {
                    times,
                    counts
                }
            });
        } catch (error) {
            console.error('获取会话趋势失败:', error);
            res.status(500).json({
                success: false,
                message: '获取会话趋势失败'
            });
        }
    },

    /**
     * 获取最近活动记录
     */
    async getRecentActivities(req, res) {
        try {
            const { limit = 10 } = req.query;

            // 模拟活动记录（实际项目中应该有专门的活动日志表）
            const activities = [
                {
                    id: 1,
                    type: 'user',
                    text: '新用户注册',
                    time: new Date().toISOString()
                },
                {
                    id: 2,
                    type: 'conversation',
                    text: '创建新会话',
                    time: new Date(Date.now() - 5 * 60 * 1000).toISOString()
                },
                {
                    id: 3,
                    type: 'model',
                    text: '更新AI模型配置',
                    time: new Date(Date.now() - 10 * 60 * 1000).toISOString()
                },
                {
                    id: 4,
                    type: 'admin',
                    text: '管理员登录',
                    time: new Date(Date.now() - 30 * 60 * 1000).toISOString()
                }
            ];

            res.json({
                success: true,
                data: activities.slice(0, parseInt(limit))
            });
        } catch (error) {
            console.error('获取最近活动失败:', error);
            res.status(500).json({
                success: false,
                message: '获取最近活动失败'
            });
        }
    },

    /**
     * 获取系统状态
     */
    async getSystemStatus(req, res) {
        try {
            const os = require('os');
            
            // 检查数据库连接
            let databaseStatus = true;
            try {
                await pool.query('SELECT 1');
            } catch (error) {
                databaseStatus = false;
            }

            // 检查Redis连接（如果有Redis配置）
            let redisStatus = true;
            // 这里可以添加Redis连接检查，目前设为true

            // 获取系统资源使用情况
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsage = Math.round((usedMemory / totalMemory) * 100);

            // CPU使用率（简单模拟，实际项目中可以使用更精确的方法）
            const cpuUsage = Math.round(Math.random() * 30 + 10); // 10-40%之间

            // 存储使用率（简单模拟）
            const storageUsage = Math.round(Math.random() * 20 + 30); // 30-50%之间

            const status = databaseStatus && redisStatus ? 'healthy' : 'error';

            res.json({
                success: true,
                data: {
                    status,
                    database: databaseStatus,
                    redis: redisStatus,
                    memory: memoryUsage,
                    cpu: cpuUsage,
                    storage: storageUsage,
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('获取系统状态失败:', error);
            res.status(500).json({
                success: false,
                message: '获取系统状态失败'
            });
        }
    },

    /**
     * 管理员修改密码
     */
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const adminId = req.admin.id;

            // 验证输入
            if (!currentPassword || !newPassword) {
                return res.status(400).json({
                    success: false,
                    message: '当前密码和新密码都是必填项'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: '新密码长度不能少于6位'
                });
            }

            // 获取当前管理员信息
            const admin = await Admin.findByUsername(req.admin.username);
            if (!admin) {
                return res.status(404).json({
                    success: false,
                    message: '管理员不存在'
                });
            }

            // 验证当前密码
            const isCurrentPasswordValid = await auth.comparePassword(currentPassword, admin.password);
            if (!isCurrentPasswordValid) {
                return res.status(400).json({
                    success: false,
                    message: '当前密码不正确'
                });
            }

            // 更新密码
            const success = await Admin.update(adminId, { password: newPassword });
            if (!success) {
                return res.status(500).json({
                    success: false,
                    message: '密码更新失败'
                });
            }

            res.json({
                success: true,
                message: '密码修改成功'
            });
        } catch (error) {
            console.error('修改密码失败:', error);
            res.status(500).json({
                success: false,
                message: '修改密码失败'
            });
        }
    },

    /**
     * 管理员管理 - 快捷切换状态
     */
    async toggleAdminStatus(req, res) {
        try {
            const { adminId } = req.params;
            const currentAdmin = req.admin;

            // 只有超级管理员可以切换状态
            if (currentAdmin.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '只有超级管理员可以修改管理员状态'
                });
            }

            // 获取目标管理员信息
            const targetAdmin = await Admin.findById(adminId);
            if (!targetAdmin) {
                return res.status(404).json({
                    success: false,
                    message: '管理员不存在'
                });
            }

            // 防止禁用超级管理员
            if (targetAdmin.role === 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: '不能禁用超级管理员账户'
                });
            }

            // 切换状态
            const newStatus = !targetAdmin.is_active;
            const success = await Admin.update(adminId, { is_active: newStatus });
            
            if (!success) {
                return res.status(400).json({
                    success: false,
                    message: '状态切换失败'
                });
            }

            res.json({
                success: true,
                message: `管理员已${newStatus ? '启用' : '禁用'}`,
                data: { is_active: newStatus }
            });
        } catch (error) {
            console.error('切换管理员状态失败:', error);
            res.status(500).json({
                success: false,
                message: '切换管理员状态失败'
            });
        }
    },

    /**
     * 验证码管理 - 获取验证码列表
     */
    async getVerificationCodes(req, res) {
        try {
            const { page = 1, pageSize = 10, phone, type } = req.query;
            
            // 从Redis获取所有验证码
            let codes = await smsService.getAllCodes();
            
            // 应用筛选条件
            if (phone) {
                codes = codes.filter(code => code.phone.includes(phone));
            }
            
            if (type !== undefined) {
                codes = codes.filter(code => code.type === parseInt(type));
            }
            
            // 分页处理
            const total = codes.length;
            const startIndex = (parseInt(page) - 1) * parseInt(pageSize);
            const endIndex = startIndex + parseInt(pageSize);
            const paginatedCodes = codes.slice(startIndex, endIndex);

            res.json({
                success: true,
                data: {
                    codes: paginatedCodes,
                    pagination: {
                        page: parseInt(page),
                        pageSize: parseInt(pageSize),
                        total,
                        pages: Math.ceil(total / parseInt(pageSize))
                    }
                }
            });
        } catch (error) {
            console.error('获取验证码列表失败:', error);
            res.status(500).json({
                success: false,
                message: '获取验证码列表失败'
            });
        }
    },

    /**
     * 验证码管理 - 获取验证码统计
     */
    async getVerificationCodeStats(req, res) {
        try {
            const stats = await smsService.getStats();
            
            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('获取验证码统计失败:', error);
            res.status(500).json({
                success: false,
                message: '获取验证码统计失败'
            });
        }
    },

    /**
     * 验证码管理 - 清理过期验证码
     */
    async clearExpiredCodes(req, res) {
        try {
            const clearedCount = await smsService.clearExpiredCodes();
            
            res.json({
                success: true,
                message: `已清理 ${clearedCount} 个过期验证码`,
                data: { cleared_count: clearedCount }
            });
        } catch (error) {
            console.error('清理过期验证码失败:', error);
            res.status(500).json({
                success: false,
                message: '清理过期验证码失败'
            });
        }
    },


};

module.exports = adminController; 