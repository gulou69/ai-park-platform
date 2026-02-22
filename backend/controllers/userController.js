const User = require('../models/user');
const auth = require('../utils/auth');
const smsService = require('../services/smsService');

/**
 * 用户控制器
 */
const userController = {
    /**
     * 发送验证码
     * @param {object} req - 请求对象
     * @param {object} res - 响应对象
     */
    async sendCode(req, res) {
        try {
            const { phone, type } = req.body;

            // 验证手机号格式
            if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: '请提供有效的手机号'
                });
            }

            // 验证类型
            if (!type || ![1, 2, 3].includes(Number(type))) {
                return res.status(400).json({
                    success: false,
                    message: '无效的验证码类型'
                });
            }

            // 如果是注册验证码，检查手机号是否已注册
            if (Number(type) === 1) {
                const existingUser = await User.findByPhone(phone);
                if (existingUser) {
                    return res.status(400).json({
                        success: false,
                        message: '该手机号已注册'
                    });
                }
            }

            // 如果是登录或重置密码验证码，检查手机号是否存在
            if ([2, 3].includes(Number(type))) {
                const existingUser = await User.findByPhone(phone);
                if (!existingUser) {
                    return res.status(404).json({
                        success: false,
                        message: '该手机号未注册'
                    });
                }
            }

            // 发送验证码
            await smsService.sendCode(phone, Number(type));

            res.json({
                success: true,
                message: '验证码已发送，请注意查收'
            });
        } catch (error) {
            console.error('发送验证码失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，请稍后再试'
            });
        }
    },

    /**
     * 用户注册
     * @param {object} req - 请求对象
     * @param {object} res - 响应对象
     */
    async register(req, res) {
        try {
            const { phone, password, verification_code } = req.body;

            // 验证必填字段
            if (!phone || !password || !verification_code) {
                return res.status(400).json({
                    success: false,
                    message: '手机号、密码和验证码都是必填项'
                });
            }

            // 验证手机号格式
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: '请提供有效的手机号'
                });
            }

            // 验证密码长度
            if (password.length < 6 || password.length > 20) {
                return res.status(400).json({
                    success: false,
                    message: '密码长度必须在6-20位之间'
                });
            }

            // 检查手机号是否已注册
            const existingUser = await User.findByPhone(phone);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: '该手机号已注册'
                });
            }

            // 验证验证码
            const isCodeValid = await smsService.verifyCode(phone, verification_code, 1);
            if (!isCodeValid) {
                return res.status(400).json({
                    success: false,
                    message: '验证码无效或已过期'
                });
            }

            // 创建用户
            const newUser = await User.create({
                phone,
                password
            });

            // 创建JWT令牌
            const token = auth.generateToken({
                id: newUser.id,
                phone: newUser.phone
            });

            res.status(201).json({
                success: true,
                message: '注册成功',
                data: {
                    user: {
                        id: newUser.id,
                        phone: newUser.phone,
                        avatar: newUser.avatar
                    },
                    token
                }
            });
        } catch (error) {
            console.error('注册失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，请稍后再试'
            });
        }
    },

    /**
     * 用户登录
     * @param {object} req - 请求对象
     * @param {object} res - 响应对象
     */
    async login(req, res) {
        try {
            const { phone, password } = req.body;

            // 验证必填字段
            if (!phone || !password) {
                return res.status(400).json({
                    success: false,
                    message: '手机号和密码都是必填项'
                });
            }

            // 查找用户
            const user = await User.findByPhone(phone);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            // 检查用户是否被禁用
            if (!user.is_active) {
                return res.status(403).json({
                    success: false,
                    message: '账户已被禁用，请联系客服'
                });
            }

            // 验证密码
            const isPasswordValid = await auth.comparePassword(password, user.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: '密码错误'
                });
            }

            // 更新登录时间
            await User.updateLoginTime(user.id);

            // 创建JWT令牌
            const token = auth.generateToken({
                id: user.id,
                phone: user.phone
            });

            // 确保返回格式统一，使前端更容易处理
            res.json({
                success: true,
                message: '登录成功',
                data: {
                    token,
                    user: {
                        id: user.id,
                        phone: user.phone,
                        avatar: user.avatar || '/static/icons/person-circle.svg'
                    }
                }
            });
        } catch (error) {
            console.error('登录失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，请稍后再试'
            });
        }
    },

    /**
     * 重置密码
     * @param {object} req - 请求对象
     * @param {object} res - 响应对象
     */
    async resetPassword(req, res) {
        try {
            const { phone, verification_code, new_password } = req.body;
            console.log(`尝试重置密码: 手机号=${phone}, 验证码长度=${verification_code?.length || 0}`);

            // 验证必填字段
            if (!phone || !verification_code || !new_password) {
                return res.status(400).json({
                    success: false,
                    message: '手机号、验证码和新密码都是必填项'
                });
            }

            // 验证密码长度
            if (new_password.length < 6 || new_password.length > 20) {
                return res.status(400).json({
                    success: false,
                    message: '密码长度必须在6-20位之间'
                });
            }

            // 查找用户
            const user = await User.findByPhone(phone);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            // 验证验证码
            const isCodeValid = await smsService.verifyCode(phone, verification_code, 3);
            console.log(`验证码校验结果: ${isCodeValid ? '通过' : '失败'} (类型=3,重置密码)`);

            if (!isCodeValid) {
                return res.status(400).json({
                    success: false,
                    message: '验证码无效或已过期'
                });
            }

            // 更新密码
            await User.updatePassword(phone, new_password);
            console.log(`用户密码重置成功: ${phone}`);

            res.json({
                success: true,
                message: '密码重置成功'
            });
        } catch (error) {
            console.error('重置密码失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，请稍后再试'
            });
        }
    },

    /**
     * 获取当前用户信息
     * @param {object} req - 请求对象
     * @param {object} res - 响应对象
     */
    async getCurrentUser(req, res) {
        try {
            const userId = req.user.id;

            // 查找用户
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            res.json({
                success: true,
                data: {
                    id: user.id,
                    phone: user.phone,
                    avatar: user.avatar || '/static/icons/person-circle.svg',
                    is_active: user.is_active,
                    created_at: user.created_at
                }
            });
        } catch (error) {
            console.error('获取用户信息失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，请稍后再试'
            });
        }
    }
};

module.exports = userController;
