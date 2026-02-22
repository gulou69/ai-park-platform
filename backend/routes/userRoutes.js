const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

// 公开路由
router.post('/send-code', userController.sendCode);
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/reset-password', userController.resetPassword);

// 需要认证的路由
router.get('/me', authMiddleware, userController.getCurrentUser);

module.exports = router;
