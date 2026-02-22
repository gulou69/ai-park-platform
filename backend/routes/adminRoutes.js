const express = require('express');
const adminController = require('../controllers/adminController');
const { authenticateAdmin, requirePermission, requireRole } = require('../middleware/auth');

const router = express.Router();

// 公开路由
router.post('/login', adminController.login);

// 需要管理员认证的路由
router.get('/me', authenticateAdmin, adminController.getCurrentAdmin);
router.post('/change-password', authenticateAdmin, adminController.changePassword);
router.get('/roles', authenticateAdmin, adminController.getRolesAndPermissions);
router.get('/stats', authenticateAdmin, requirePermission('system_stats'), adminController.getStats);
router.get('/system-status', authenticateAdmin, requirePermission('system_stats'), adminController.getSystemStatus);

// 统计图表数据
router.get('/stats/user-trend', authenticateAdmin, requirePermission('system_stats'), adminController.getUserTrend);
router.get('/stats/model-usage', authenticateAdmin, requirePermission('system_stats'), adminController.getModelUsage);
router.get('/stats/conversation-trend', authenticateAdmin, requirePermission('system_stats'), adminController.getConversationTrend);

// 活动记录
router.get('/activities', authenticateAdmin, adminController.getRecentActivities);

// 用户管理
router.get('/users', authenticateAdmin, requirePermission('user_management'), adminController.getUsers);
router.patch('/users/:userId/status', authenticateAdmin, requirePermission('user_management'), adminController.updateUserStatus);

// 模型管理
router.get('/models', authenticateAdmin, requirePermission('model_management'), adminController.getModels);
router.post('/models', authenticateAdmin, requirePermission('model_management'), adminController.createModel);
router.put('/models/:modelId', authenticateAdmin, requirePermission('model_management'), adminController.updateModel);
router.delete('/models/:modelId', authenticateAdmin, requirePermission('model_management'), adminController.deleteModel);
router.post('/models/:modelId/test', authenticateAdmin, requirePermission('model_management'), adminController.testModel);

// 会话管理
router.get('/conversations', authenticateAdmin, requirePermission('conversation_management'), adminController.getConversations);
router.get('/conversations/:conversationId/messages', authenticateAdmin, requirePermission('conversation_management'), adminController.getConversationMessages);
router.delete('/conversations/:conversationId', authenticateAdmin, requirePermission('conversation_management'), adminController.deleteConversation);
router.post('/conversations/batch-delete', authenticateAdmin, requirePermission('conversation_management'), adminController.batchDeleteConversations);

// 管理员管理（仅超级管理员）
router.get('/admins', authenticateAdmin, requireRole(['super_admin']), adminController.getAdmins);
router.post('/admins', authenticateAdmin, requireRole(['super_admin']), adminController.createAdmin);
router.put('/admins/:adminId', authenticateAdmin, requireRole(['super_admin']), adminController.updateAdmin);
router.patch('/admins/:adminId/status', authenticateAdmin, requireRole(['super_admin']), adminController.toggleAdminStatus);
router.delete('/admins/:adminId', authenticateAdmin, requireRole(['super_admin']), adminController.deleteAdmin);

// 验证码管理（所有管理员都可访问）
router.get('/verification-codes', authenticateAdmin, adminController.getVerificationCodes);
router.get('/verification-codes/stats', authenticateAdmin, adminController.getVerificationCodeStats);
router.post('/verification-codes/clear-expired', authenticateAdmin, adminController.clearExpiredCodes);

module.exports = router; 