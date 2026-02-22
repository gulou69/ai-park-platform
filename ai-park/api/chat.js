import request from '@/utils/request'
import config from '@/config'

// AI模型请求超时时间设置更长，因为AI生成可能需要较长时间
const AI_REQUEST_TIMEOUT = config.aiRequestTimeout;

/**
 * 聊天相关API
 */
export const chatApi = {
    /**
     * 获取用户的对话列表
     * @param {number} page - 页码
     * @param {number} pageSize - 每页条数
     */
    async getConversations(page = 1, pageSize = 20) {
        try {
            // 获取存储的用户信息
            const userInfo = uni.getStorageSync('userInfo') || {};
            if (!userInfo.id) {
                throw new Error('用户未登录');
            }

            const response = await request.get('/api/chat/conversations', {
                page,
                page_size: pageSize,
                user: userInfo.id
            });

            return response;
        } catch (error) {
            console.error('获取对话列表失败:', error);
            throw error;
        }
    },

    /**
     * 创建新对话
     * @param {string} modelId - 模型ID
     * @param {string} difyConversationId - Dify会话ID
     * @param {string} title - 会话标题(可选)
     */
    createConversation(modelId, difyConversationId, title = '新对话') {
        const userInfo = uni.getStorageSync('userInfo') || {};
        if (!userInfo.id) {
            throw new Error('用户未登录');
        }

        const data = {
            model_id: modelId,
            user: userInfo.id,
            title: title
        };

        // 添加Dify会话ID - 这是关键字段
        if (difyConversationId) {
            data.dify_conversation_id = difyConversationId;
        }

        console.log('创建会话请求数据:', data);
        return request.post('/api/chat/conversations', data);
    },

    /**
     * 获取对话详情
     * @param {string} conversationId - 对话ID
     */
    async getConversationDetail(conversationId) {
        try {
            const userInfo = uni.getStorageSync('userInfo') || {};
            if (!userInfo.id) {
                throw new Error('用户未登录');
            }

            const response = await request.get(`/api/chat/conversations/${conversationId}`, {
                user: userInfo.id
            });

            return response;
        } catch (error) {
            console.error('获取对话详情失败:', error);
            throw error;
        }
    },

    /**
     * 更新对话标题
     * @param {string} conversationId - 对话ID
     * @param {string} title - 新标题
     */
    async updateConversationTitle(conversationId, title) {
        try {
            const userInfo = uni.getStorageSync('userInfo') || {};
            if (!userInfo.id) {
                throw new Error('用户未登录');
            }

            const response = await request.patch(`/api/chat/conversations/${conversationId}`, {
                title: title,
                user: userInfo.id
            });

            return response;
        } catch (error) {
            console.error('更新对话标题失败:', error);
            throw error;
        }
    },

    /**
     * 删除对话
     * @param {string} conversationId - 对话ID
     */
    async deleteConversation(conversationId) {
        try {
            const userInfo = uni.getStorageSync('userInfo') || {};
            if (!userInfo.id) {
                throw new Error('用户未登录');
            }

            const response = await request.delete(`/api/chat/conversations/${conversationId}`, {
                user: userInfo.id
            });

            return response;
        } catch (error) {
            console.error('删除对话失败:', error);
            throw error;
        }
    },

    /**
     * 发送聊天消息
     * @param {Object} params 
     * @returns {Promise}
     */
    async sendMessage(params) {
        try {
            // 增加调试信息
            console.log('开始发送消息，检查登录状态...');
            const isLoggedIn = uni.getStorageSync('isLoggedIn');
            const userInfo = uni.getStorageSync('userInfo');

            // 更全面地检查登录状态
            if (!isLoggedIn) {
                console.error('登录状态检查失败: isLoggedIn =', isLoggedIn);
                throw new Error('用户未登录，请先登录');
            }

            // 确保userInfo是一个对象且包含id
            if (!userInfo || typeof userInfo !== 'object') {
                console.error('用户信息检查失败: 用户信息不是有效对象', userInfo);
                throw new Error('用户信息无效，请重新登录');
            }

            if (!userInfo.id) {
                console.error('用户信息检查失败: 缺少用户ID', userInfo);
                // 清除无效的登录信息
                uni.removeStorageSync('isLoggedIn');
                uni.removeStorageSync('userInfo');
                throw new Error('用户信息无效，请重新登录');
            }

            console.log('用户已登录，ID:', userInfo.id);

            // 添加用户标识并始终请求流式响应
            const data = {
                ...params,
                user: userInfo.id,
                stream: true // 总是请求流式响应
            };

            // 修改为正确的后端路由
            const response = await request.post('/api/chat/send', data, {
                timeout: AI_REQUEST_TIMEOUT
            });

            return response;
        } catch (error) {
            console.error('发送消息失败:', error);
            throw error;
        }
    },

    /**
     * 获取历史消息
     * @param {string} conversationId - 对话ID
     * @param {number} limit - 每页条数，默认为100，不能超过100
     * @param {string|null} firstId - 当前页第一条ID，用于分页
     */
    async getMessages(conversationId, limit = 100, firstId = null) {
        try {
            // 获取用户信息
            const userInfo = uni.getStorageSync('userInfo') || {};
            if (!userInfo.id) {
                throw new Error('用户未登录');
            }

            // 构建查询参数 - 确保limit不超过100
            const params = {
                conversation_id: conversationId,
                user: userInfo.id,
                limit: Math.min(limit, 100)  // 确保limit不超过100
            };

            // 添加可选的分页参数
            if (firstId) {
                params.first_id = firstId;
            }

            console.log('获取消息历史参数:', params);

            // 发送请求
            const response = await request.get('/api/chat/messages', params);

            // 添加调试信息
            if (response.success) {
                console.log('获取消息成功，消息数量:', response.data?.length || 0);

                // 添加更详细的消息类型调试信息
                if (response.data && response.data.length > 0) {
                    const userMsgs = response.data.filter(msg => !!msg.query).length;
                    const aiMsgs = response.data.filter(msg => !!msg.answer).length;
                    console.log('消息类型统计:', {
                        user: userMsgs,
                        ai: aiMsgs,
                        undefined: response.data.length - userMsgs - aiMsgs
                    });

                    // 打印消息字段示例，帮助调试
                    console.log('消息结构示例:',
                        JSON.stringify(response.data[0], ['id', 'query', 'answer', 'created_at', 'conversation_id'], 2)
                    );
                }

                // 如果有更多消息并且需要获取更多（未设置firstId表示初始请求）
                if (response.has_more && !firstId && response.data?.length > 0) {
                    console.log('存在更多消息，尝试获取下一页');

                    // 获取最后一条消息的ID作为下一页的first_id
                    const lastMessageId = response.data[response.data.length - 1].id;

                    // 获取下一页数据
                    const nextPageResponse = await this.getMessages(conversationId, 100, lastMessageId);

                    if (nextPageResponse.success && nextPageResponse.data) {
                        // 合并数据
                        response.data = [...response.data, ...nextPageResponse.data];
                        response.has_more = nextPageResponse.has_more;
                        console.log('合并后的消息数量:', response.data.length);
                    }
                }
            } else {
                console.error('获取消息失败:', response.message);
            }

            return response;
        } catch (error) {
            console.error('获取消息历史失败:', error);
            throw error;
        }
    },

    /**
     * 添加消息到对话(不调用AI)
     * @param {string} conversationId - 对话ID
     * @param {string} content - 消息内容
     * @param {string} type - 消息类型('user'或'ai')
     */
    addMessage(conversationId, content, type = 'user') {
        return request.post(`/api/chat/conversations/${conversationId}/messages/`, {
            content,
            type
        })
    },

    /**
     * 消息反馈(点赞/踩)
     * @param {string} messageId - 消息ID
     * @param {string} action - 操作类型('like'或'dislike')
     */
    async messageAction(messageId, action) {
        try {
            const response = await request.post(`/api/chat/messages/${messageId}/feedback/`, {
                action: action
            });
            return response;
        } catch (error) {
            console.error('消息反馈操作失败:', error);
            throw error;
        }
    },

    /**
     * 重新生成消息
     * @param {string} messageId - 消息ID
     * @param {boolean} stream - 是否使用流式响应
     */
    async regenerateMessage(messageId, stream = false) {
        try {
            const response = await request.post(`/api/chat/messages/${messageId}/regenerate/`, { stream }, {
                timeout: AI_REQUEST_TIMEOUT,
                retryOnTimeout: true,
                maxRetries: 1
            });
            return response;
        } catch (error) {
            console.error('重新生成消息失败:', error);
            throw error;
        }
    },

    /**
     * 处理流式响应
     * @param {string} url - 事件源URL
     * @param {Function} onData - 处理每个数据块的回调
     * @param {Function} onComplete - 完成时的回调
     * @param {Function} onError - 错误处理回调
     * @returns {Object} 包含事件源和控制方法的对象
     */
    handleStreamResponse(url, onData, onComplete, onError) {
        const source = new EventSource(url);
        let timeoutId = null;
        let hasReceivedData = false;

        // 设置超时处理
        timeoutId = setTimeout(() => {
            if (!hasReceivedData) {
                onError({ message: "服务器响应超时", isTimeout: true });
                source.close();
            }
        }, AI_REQUEST_TIMEOUT);

        source.onmessage = (event) => {
            // 收到数据，清除超时
            hasReceivedData = true;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            try {
                const data = JSON.parse(event.data);
                onData(data);
            } catch (error) {
                onError(error);
            }
        };

        source.onerror = (error) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            source.close();
            onError(error);
        };

        source.addEventListener('complete', () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            source.close();
            onComplete();
        });

        return {
            source,
            close: () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                source.close();
            }
        };
    },

    /**
     * 发送流式消息
     * @param {Object} params - 请求参数
     * @param {Object} streamCallbacks - 流事件回调
     * @returns {Object} - 包含stop方法的控制对象
     */
    async sendStreamMessage(params, streamCallbacks = {}) {
        try {
            const userInfo = uni.getStorageSync('userInfo') || {};
            if (!userInfo.id) {
                throw new Error('用户未登录');
            }

            // 添加用户标识和流式标志
            const data = {
                ...params,
                user: userInfo.id,
                stream: true
            };

            // 导入聊天流工具
            const chatStream = require('@/utils/chatStream').default;

            // 配置回调
            if (streamCallbacks.onMessage) chatStream.on('onMessage', streamCallbacks.onMessage);
            if (streamCallbacks.onError) chatStream.on('onError', streamCallbacks.onError);
            if (streamCallbacks.onComplete) chatStream.on('onComplete', streamCallbacks.onComplete);
            if (streamCallbacks.onFile) chatStream.on('onFile', streamCallbacks.onFile);
            if (streamCallbacks.onThought) chatStream.on('onThought', streamCallbacks.onThought);

            // 发送请求
            chatStream.send('/api/chat/send', data);

            // 返回控制对象
            return {
                stop: () => {
                    chatStream.stop();
                    // 如果有taskId，还可以调用API取消服务端处理
                    if (params.task_id) {
                        this.stopMessageGeneration(params.task_id, params.model_id);
                    }
                }
            };
        } catch (error) {
            console.error('发送流式消息失败:', error);
            throw error;
        }
    },

    /**
     * 停止消息生成
     * @param {string} taskId - 任务ID
     * @param {string} modelId - 模型ID
     */
    async stopMessageGeneration(taskId, modelId) {
        try {
            const userInfo = uni.getStorageSync('userInfo') || {};
            if (!userInfo.id) {
                throw new Error('用户未登录');
            }

            await request.post(`/api/chat/stop/${taskId}`, {
                user: userInfo.id,
                model_id: modelId
            });
        } catch (error) {
            console.error('停止消息生成失败:', error);
        }
    }
}
