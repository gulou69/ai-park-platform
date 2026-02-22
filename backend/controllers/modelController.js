const Model = require('../models/model');
const axios = require('axios');

/**
 * AI模型控制器
 */
const modelController = {
    /**
     * 获取可用模型列表
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async getModels(req, res) {
        try {
            const models = await Model.getCategorizedModels();

            res.json({
                success: true,
                data: models
            });
        } catch (error) {
            console.error('获取模型列表失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，获取模型列表失败'
            });
        }
    },

    /**
     * 根据ID获取模型详情
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async getModelById(req, res) {
        try {
            const { id } = req.params;

            const model = await Model.getById(id);

            if (!model) {
                return res.status(404).json({
                    success: false,
                    message: '模型不存在或已禁用'
                });
            }

            res.json({
                success: true,
                data: {
                    id: model.id,
                    name: model.name,
                    display_name: model.display_name,
                    description: model.description,
                    model_type: model.model_type,
                    provider: model.provider,
                    is_free: model.is_free === 1,
                    icon_path: model.icon_path
                }
            });
        } catch (error) {
            console.error(`获取模型(ID: ${req.params.id})详情失败:`, error);
            res.status(500).json({
                success: false,
                message: '服务器错误，获取模型详情失败'
            });
        }
    },

    /**
     * 获取模型预设参数
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async getModelPreset(req, res) {
        try {
            const { modelId } = req.params;

            const model = await Model.getById(modelId);
            if (!model) {
                return res.status(404).json({
                    success: false,
                    message: '模型不存在或已禁用'
                });
            }

            // 这里可以返回模型的预设参数，如温度、最大token等
            // 实际可能需要从第三方API获取或从本地配置读取
            const presets = {
                temperature: 0.7,
                max_tokens: 2000,
                top_p: 0.95,
                frequency_penalty: 0,
                presence_penalty: 0
            };

            res.json({
                success: true,
                data: presets
            });
        } catch (error) {
            console.error('获取模型预设参数失败:', error);
            res.status(500).json({
                success: false,
                message: '服务器错误，获取模型预设参数失败'
            });
        }
    },

    /**
     * 使用模型进行聊天
     * @param {Object} req - 请求对象
     * @param {Object} res - 响应对象
     */
    async chatWithModel(req, res) {
        try {
            const { model_id, messages } = req.body; // 移除stream参数，总是使用streaming模式

            // 获取模型信息
            const model = await Model.getById(model_id);
            if (!model) {
                return res.status(404).json({
                    success: false,
                    message: '模型不存在或已禁用'
                });
            }

            // 输出模型调试信息（不输出敏感字段）
            console.log('===== 模型API调试信息 =====');
            console.log(`模型ID: ${model.id}`);
            console.log(`模型名称: ${model.name}`);
            console.log(`模型URL: ${model.api_url}`);
            console.log('==========================');

            // 根据模型类型调用不同的API
            if (model.provider === 'dify') {
                // 调用Dify API，添加inputs字段
                // 设置响应头，准备流式传输
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                // 始终使用streaming模式
                const response = await axios({
                    method: 'post',
                    url: `${model.api_url}/chat-messages`,
                    data: {
                        messages,
                        inputs: {}, // 添加必需的inputs字段
                        response_mode: 'streaming' // 始终使用流式响应
                    },
                    headers: {
                        'Authorization': `Bearer ${model.api_key}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'stream'
                });

                // 创建到客户端的流
                response.data.pipe(res);
            } else {
                // 其他模型处理（如OpenAI、Anthropic等）
                res.status(400).json({
                    success: false,
                    message: `不支持的模型提供商: ${model.provider}`
                });
            }
        } catch (error) {
            console.error('模型聊天请求失败:', error);

            // 检查响应是否已经开始发送
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: '服务器错误，模型聊天请求失败'
                });
            } else {
                // 如果已经开始发送流式响应，则发送错误事件
                res.write(`data: ${JSON.stringify({
                    event: 'error',
                    message: '服务器处理错误',
                    status: 500
                })}\n\n`);
                res.end();
            }
        }
    }
};

module.exports = modelController;
