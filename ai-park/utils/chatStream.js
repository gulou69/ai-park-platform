import config from '@/config';

/**
 * 聊天流处理工具
 * 用于处理AI聊天流式响应
 */
class ChatStream {
    constructor() {
        this.controller = null;
        this.callbacks = {
            onMessage: () => { },
            onError: () => { },
            onComplete: () => { },
            onFile: () => { },
            onThought: () => { }
        };
        this.baseUrl = config.apiBaseUrl;
        this.decoder = new TextDecoder();
        this.buffer = '';
    }

    /**
     * 注册事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (typeof callback === 'function' && this.callbacks.hasOwnProperty(event)) {
            this.callbacks[event] = callback;
        }
        return this;
    }

    /**
     * 停止流式请求
     */
    stop() {
        if (this.controller) {
            this.controller.abort();
            this.controller = null;
        }
    }

    /**
     * 发送流式请求
     * @param {string} url - 请求URL
     * @param {Object} data - 请求数据
     */
    async send(url, data) {
        // 确保上一个请求被终止
        this.stop();

        // 创建新的AbortController
        this.controller = new AbortController();
        const { signal } = this.controller;

        try {
            // 获取并添加授权令牌
            const token = uni.getStorageSync('token') || '';
            console.log('开始发送流式请求, URL:', `${this.baseUrl}${url}`);
            console.log('请求数据:', JSON.stringify(data));

            // 发起请求
            const response = await fetch(`${this.baseUrl}${url}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(data),
                signal
            });

            if (!response.ok) {
                console.error(`请求失败: ${response.status} - ${response.statusText}`);
                throw new Error(`请求失败: ${response.status}`);
            }

            console.log('收到响应:', response.status, response.headers.get('Content-Type'));

            // 检查响应类型
            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('text/event-stream')) {
                console.warn('警告: 响应不是event-stream格式，而是:', contentType);
            }

            const reader = response.body.getReader();
            console.log('开始处理响应流');
            this.processStream(reader);
        } catch (error) {
            // 检查是否为用户主动取消的请求
            if (error.name === 'AbortError') {
                console.log('请求被用户取消');
                return;
            }
            console.error('流式请求错误:', error);
            this.callbacks.onError(error);
        }
    }

    /**
     * 处理流式数据
     * @param {ReadableStreamDefaultReader} reader - 流读取器
     */
    async processStream(reader) {
        try {
            console.log('开始处理流式数据');
            // 累积的消息缓冲区
            let messageBuffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    console.log('流读取完成，处理可能存在的最后一条消息');
                    if (messageBuffer.trim()) {
                        this.processChunk(messageBuffer);
                    }
                    this.callbacks.onComplete();
                    break;
                }

                // 解码当前块并添加到缓冲区
                const chunk = this.decoder.decode(value, { stream: true });
                console.log('收到数据块:', chunk);
                messageBuffer += chunk;

                // 查找完整的SSE消息，格式为 data: {...}\n\n
                const messages = messageBuffer.split('\n\n');
                console.log(`分割后获得 ${messages.length} 条潜在消息`);

                // 处理所有完整的消息（除了可能不完整的最后一条）
                for (let i = 0; i < messages.length - 1; i++) {
                    if (messages[i].trim()) {
                        this.processChunk(messages[i]);
                    }
                }

                // 保留可能不完整的最后一条消息
                messageBuffer = messages[messages.length - 1];
            }
        } catch (error) {
            console.error('处理流式数据时出错:', error);
            this.callbacks.onError(error);
        }
    }

    /**
     * 处理单条消息
     * @param {string} chunk - 消息文本
     */
    processChunk(chunk) {
        console.log('处理消息块:', chunk);

        // 忽略ping事件
        if (chunk.includes('event: ping') || chunk.includes('"event":"ping"')) {
            console.log('忽略ping事件');
            return;
        }

        // 尝试解析SSE格式的数据
        try {
            // 标准SSE格式为 "data: {JSON数据}\n\n"
            if (chunk.startsWith('data:')) {
                // 提取data后面的JSON部分
                const jsonText = chunk.slice(5).trim();
                console.log('提取的JSON文本:', jsonText);

                try {
                    // 尝试解析JSON
                    const jsonData = JSON.parse(jsonText);
                    console.log('成功解析JSON数据:', jsonData);

                    // 忽略ping事件
                    if (jsonData.event === 'ping') {
                        console.log('忽略ping事件');
                        return;
                    }

                    // 分发事件处理
                    this.dispatchEvent(jsonData);
                } catch (jsonError) {
                    console.error('JSON解析失败:', jsonError, '原始文本:', jsonText);
                    // 尝试直接作为文本处理
                    this.callbacks.onMessage({
                        content: jsonText,
                        type: 'text'
                    });
                }
            } else if (chunk.trim()) {
                // 非标准SSE格式，尝试直接解析
                console.log('尝试解析非标准格式文本:', chunk);
                try {
                    const jsonData = JSON.parse(chunk.trim());
                    console.log('成功解析非标准JSON:', jsonData);

                    // 忽略ping事件
                    if (jsonData.event === 'ping') {
                        console.log('忽略ping事件');
                        return;
                    }

                    this.dispatchEvent(jsonData);
                } catch (e) {
                    console.log('非JSON格式，作为纯文本处理');
                    // 作为纯文本处理
                    this.callbacks.onMessage({
                        content: chunk,
                        type: 'text'
                    });
                }
            }
        } catch (error) {
            console.warn('处理消息块失败:', error);
            // 失败时尝试直接将内容传递给消息处理器
            this.callbacks.onMessage({
                content: chunk,
                type: 'raw'
            });
        }
    }

    /**
     * 根据事件类型分发事件
     * @param {Object} data - 事件数据
     */
    dispatchEvent(data) {
        console.log('分发事件:', JSON.stringify(data));

        // 获取事件类型，默认为message
        const event = data.event || 'message';
        console.log('事件类型:', event);

        // 检查answer字段中的Unicode编码并解码
        if (data.answer !== undefined && typeof data.answer === 'string') {
            data.answer = this.decodeUnicodeEscapes(data.answer);
            console.log('解码后的回答:', data.answer);
        }

        // 检查content字段中的Unicode编码并解码
        if (data.content !== undefined && typeof data.content === 'string') {
            data.content = this.decodeUnicodeEscapes(data.content);
            console.log('解码后的内容:', data.content);
        }

        // 根据事件类型处理
        switch (event) {
            case 'agent_message':
                // 处理agent_message事件（来自Dify API）
                console.log('处理agent_message事件, 内容:', data.answer || '');
                if (data.answer !== undefined) {
                    // 调用消息回调
                    this.callbacks.onMessage({
                        type: 'ai',
                        content: data.answer || '' // 包括空字符串
                    });
                }
                break;

            case 'message':
                // 处理普通消息事件
                console.log('处理message事件, 内容:', data.answer || data.content);
                // 提取消息内容（兼容不同格式）
                const messageContent = data.answer !== undefined ? data.answer :
                    (data.content !== undefined ? data.content : JSON.stringify(data));
                this.callbacks.onMessage({
                    type: 'ai',
                    content: messageContent
                });
                break;

            case 'message_end':
                console.log('收到message_end事件, 会话结束');
                this.callbacks.onComplete(data);
                break;

            case 'message_file':
                console.log('收到message_file事件, 文件URL:', data.url);
                this.callbacks.onFile(data);
                break;

            case 'agent_thought':
                console.log('收到agent_thought事件');
                this.callbacks.onThought(data);
                break;

            case 'error':
                console.error('收到error事件:', data.message);
                this.callbacks.onError(data);
                break;

            default:
                // 未知事件类型，尝试从数据中提取有用信息
                console.log('未知事件类型:', event, '尝试从数据中提取内容');
                // 尝试从各种可能的字段中提取内容
                const content = data.answer || data.content || data.text || JSON.stringify(data);
                if (content) {
                    this.callbacks.onMessage({
                        content,
                        type: 'ai'
                    });
                }
                break;
        }
    }

    /**
     * 解码Unicode转义序列
     * @param {string} str - 可能包含Unicode转义序列的字符串
     * @returns {string} 解码后的字符串
     */
    decodeUnicodeEscapes(str) {
        if (typeof str !== 'string') return '';

        try {
            // 处理形如 \u60a8\u597d 的Unicode转义序列
            return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
                String.fromCharCode(parseInt(hex, 16))
            );
        } catch (e) {
            console.error('Unicode解码失败:', e);
            return str; // 解码失败则返回原字符串
        }
    }
}

// 创建单例
const chatStream = new ChatStream();
export default chatStream;
