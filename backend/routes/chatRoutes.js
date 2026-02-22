const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middlewares/auth');

// 会话路由
router.get('/conversations', authMiddleware, chatController.getConversations);

// 创建会话路由 - 支持接收dify_conversation_id参数
router.post('/conversations', authMiddleware, chatController.createConversation);

// 会话详情和操作
router.get('/conversations/:conversationId', authMiddleware, chatController.getConversationDetail);
router.patch('/conversations/:conversationId', authMiddleware, chatController.updateConversationTitle);
router.delete('/conversations/:conversationId', authMiddleware, chatController.deleteConversation);

// 消息相关路由 - 添加获取消息历史路由
router.get('/messages', authMiddleware, chatController.getMessages);
router.post('/send', authMiddleware, chatController.sendMessage);
router.post('/stop/:taskId', authMiddleware, chatController.stopMessageGeneration);

module.exports = router;
