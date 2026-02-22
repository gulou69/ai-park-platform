const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');

/**
 * 管理员身份验证中间件
 */
const authenticateAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                success: false,
                message: '需要登录后才能访问'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded.isAdmin) {
            return res.status(403).json({
                success: false,
                message: '需要管理员权限'
            });
        }

        // 获取最新的管理员信息
        const admin = await Admin.findById(decoded.id);
        if (!admin || !admin.is_active) {
            return res.status(401).json({
                success: false,
                message: '账户不存在或已被禁用'
            });
        }

        req.admin = admin;
        next();
    } catch (error) {
        console.error('管理员认证失败:', error);
        res.status(401).json({
            success: false,
            message: '登录已过期，请重新登录'
        });
    }
};

/**
 * 权限检查中间件工厂函数
 * @param {string} permission - 需要的权限
 * @returns {Function} - 中间件函数
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        const admin = req.admin;
        
        if (!Admin.hasPermission(admin, permission)) {
            return res.status(403).json({
                success: false,
                message: '没有足够的权限执行此操作'
            });
        }
        
        next();
    };
};

/**
 * 角色检查中间件工厂函数
 * @param {Array} allowedRoles - 允许的角色列表
 * @returns {Function} - 中间件函数
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        const admin = req.admin;
        
        if (!allowedRoles.includes(admin.role)) {
            return res.status(403).json({
                success: false,
                message: '没有足够的权限执行此操作'
            });
        }
        
        next();
    };
};

module.exports = {
    authenticateAdmin,
    requirePermission,
    requireRole
}; 