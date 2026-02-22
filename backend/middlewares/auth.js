const auth = require('../utils/auth');

/**
 * 认证中间件 - 验证JWT令牌
 */
const authMiddleware = (req, res, next) => {
    try {
        // 从请求头获取Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: '未提供认证令牌'
            });
        }

        // 提取token
        const token = authHeader.split(' ')[1];

        // 验证token
        const decoded = auth.verifyToken(token);

        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: '无效或已过期的令牌'
            });
        }

        // 将解码后的用户信息添加到请求对象中
        req.user = decoded;

        next();
    } catch (error) {
        console.error('认证中间件错误:', error);
        res.status(401).json({
            success: false,
            message: '认证失败'
        });
    }
};

module.exports = authMiddleware;
