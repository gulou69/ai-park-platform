import request from '@/utils/request'

/**
 * AI模型相关API
 */
export const modelApi = {
    /**
     * 获取可用模型列表
     * 返回的数据包含免费和付费模型
     */
    async getModels() {
        try {
            // 调用真实的后端API获取模型列表
            const response = await request.get('/api/models/list');

            // 检查响应是否成功并包含模型数据
            if (response.success && response.data) {
                // 如果后端返回的数据结构与前端预期一致，直接返回
                if (response.data.free_models || response.data.paid_models) {
                    console.log('成功获取模型列表:', response.data);
                    return response;
                } else {
                    // 如果后端返回的数据结构不同，进行适配转换
                    console.log('转换模型数据格式');
                    const free_models = [];
                    const paid_models = [];

                    // 假设后端返回的是models数组，需要根据is_free字段分类
                    const models = Array.isArray(response.data) ? response.data : [];
                    models.forEach(model => {
                        if (model.is_free) {
                            free_models.push(model);
                        } else {
                            paid_models.push(model);
                        }
                    });

                    return {
                        success: true,
                        data: { free_models, paid_models }
                    };
                }
            }

            // 如果API调用成功但没有返回预期数据，返回空模型列表
            console.warn('从API获取的模型数据格式不正确，返回空模型列表');
            return {
                success: false,
                message: '未获取到模型数据',
                data: { free_models: [], paid_models: [] }
            };
        } catch (error) {
            console.error('获取模型列表失败:', error);
            // API调用失败时，返回空模型列表
            console.warn('获取模型失败，返回空模型列表');
            return {
                success: false,
                message: '获取模型失败: ' + (error.message || '未知错误'),
                data: { free_models: [], paid_models: [] }
            };
        }
    },

    /**
     * 通过模型直接发送聊天请求
     * @param {string} modelId - 模型ID
     * @param {Array} messages - 消息列表，格式为[{role: 'user', content: '消息内容'}]
     * @param {boolean} stream - 是否使用流式响应
     */
    chatWithModel(modelId, messages, stream = false) {
        return request.post('/api/models/chat', {
            model_id: modelId,
            messages,
            stream
        });
    },

    /**
     * 获取模型预设参数
     * @param {string} modelId - 模型ID
     */
    getModelPreset(modelId) {
        return request.get(`/api/models/${modelId}/preset`);
    }
}
