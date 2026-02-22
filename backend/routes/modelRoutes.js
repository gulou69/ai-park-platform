const express = require('express');
const router = express.Router();
const modelController = require('../controllers/modelController');
const authMiddleware = require('../middlewares/auth');

// 获取模型列表
router.get('/list', authMiddleware, modelController.getModels);

// 获取模型详情
router.get('/:id', authMiddleware, modelController.getModelById);

module.exports = router;
