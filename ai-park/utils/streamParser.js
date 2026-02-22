/**
 * 流式响应解析工具
 * 用于处理SSE流式响应中的各种数据格式
 */

/**
 * 解析流式响应数据
 * @param {string} data - 收到的数据块
 * @returns {Object} 解析后的数据对象
 */
export const parseStreamData = (data) => {
    try {
        // 尝试解析为JSON
        return JSON.parse(data);
    } catch (e) {
        // 如果不是合法的JSON，尝试其他解析方式

        // 1. 检查是否是纯文本内容
        if (!data.includes('{') && !data.includes('}')) {
            return { content: data };
        }

        // 2. 尝试解析常见的流式响应格式（如OpenAI的格式）
        try {
            // 处理多行数据
            const lines = data.split('\n').filter(line => line.trim() !== '');

            // 处理可能的 "data: " 前缀
            const processedLines = lines.map(line => {
                if (line.startsWith('data: ')) {
                    return line.substring(6);
                }
                return line;
            });

            // 尝试解析每一行
            for (const line of processedLines) {
                try {
                    const parsedData = JSON.parse(line);
                    if (parsedData) {
                        return parsedData;
                    }
                } catch (err) {
                    // 忽略解析失败的行
                }
            }

            // 如果无法解析，把内容作为文本返回
            return { content: data };
        } catch (err) {
            // 最终回退：将整个内容作为文本返回
            console.warn('Stream parse error:', err);
            return { content: data };
        }
    }
};

/**
 * 提取流式响应中的文本内容
 * @param {Object} parsedData - 已解析的数据对象
 * @returns {string|null} 提取的文本，如果没有则返回null
 */
export const extractTextContent = (parsedData) => {
    if (!parsedData) return null;

    // 直接包含content字段
    if (typeof parsedData.content === 'string') {
        return parsedData.content;
    }

    // OpenAI格式
    if (parsedData.choices && parsedData.choices[0]) {
        const choice = parsedData.choices[0];
        if (choice.delta && choice.delta.content) {
            return choice.delta.content;
        }
        if (choice.text) {
            return choice.text;
        }
    }

    // Anthropic格式
    if (parsedData.completion) {
        return parsedData.completion;
    }

    // 没有找到可识别的文本内容
    return null;
};

/**
 * 检查流是否已完成
 * @param {Object} parsedData - 已解析的数据对象
 * @returns {boolean} 是否已完成
 */
export const isStreamComplete = (parsedData) => {
    if (!parsedData) return false;

    // 直接包含complete字段
    if (parsedData.isComplete === true || parsedData.complete === true) {
        return true;
    }

    // OpenAI格式
    if (parsedData.choices && parsedData.choices[0]) {
        return parsedData.choices[0].finish_reason != null;
    }

    // 自定义结束标记
    if (parsedData.type === 'end' || parsedData.event === 'end') {
        return true;
    }

    return false;
};

/**
 * 解析流式数据
 * @param {string} chunk - 服务器返回的数据块
 * @returns {object|null} 解析后的数据对象，如果无法解析则返回null
 */
export const parseStreamChunk = (chunk) => {
    try {
        // 移除SSE格式的"data: "前缀
        const dataString = chunk.replace(/^data:\s+/, '').trim();

        // 如果数据是空的，返回null
        if (!dataString || dataString === '[DONE]') {
            return null;
        }

        // 解析JSON
        return JSON.parse(dataString);
    } catch (e) {
        console.error('解析流式数据失败:', e);
        return null;
    }
};

/**
 * 将SSE格式的流式数据转换为事件流
 * @param {ReadableStream} stream - 请求的流
 * @param {object} callbacks - 回调函数集合
 * @returns {function} 终止函数
 */
export const handleSSEStream = (stream, callbacks = {}) => {
    const { onMessage, onComplete, onError } = callbacks;

    const reader = stream.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processStream = async () => {
        try {
            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    if (buffer && onMessage) {
                        // 处理缓冲区中剩余的数据
                        const lines = buffer.split('\n\n');
                        for (const line of lines) {
                            if (line.trim()) {
                                const parsedData = parseStreamChunk(line);
                                if (parsedData) {
                                    onMessage(parsedData);
                                }
                            }
                        }
                    }

                    if (onComplete) {
                        onComplete();
                    }

                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // 按\n\n分割数据块
                const lines = buffer.split('\n\n');
                buffer = lines.pop() || ''; // 最后一个可能不完整，留在buffer中

                for (const line of lines) {
                    if (line.trim()) {
                        const parsedData = parseStreamChunk(line);
                        if (parsedData && onMessage) {
                            onMessage(parsedData);
                        }
                    }
                }
            }
        } catch (error) {
            if (onError) {
                onError(error);
            }
        }
    };

    processStream();

    // 返回终止函数
    return () => {
        reader.cancel();
    };
};

/**
 * 处理Dify API的SSE流式响应
 */
class StreamParser {
    constructor() {
        this.buffer = '';
        this.eventCallbacks = {
            message: () => { },
            error: () => { },
            done: () => { }
        };
    }

    /**
     * 注册事件回调
     * @param {string} event 事件名称: message, error, done
     * @param {Function} callback 回调函数
     */
    on(event, callback) {
        if (this.eventCallbacks[event]) {
            this.eventCallbacks[event] = callback;
        }
        return this;
    }

    /**
     * 处理流式数据块
     * @param {string} chunk 接收到的数据块
     */
    parse(chunk) {
        // 将新的数据块添加到缓冲区
        this.buffer += chunk;

        // 按照SSE格式分割消息(data: {...}\n\n)
        const messages = this.buffer.split('\n\n');

        // 保留最后一个可能不完整的消息
        this.buffer = messages.pop();

        // 处理完整的消息
        for (const message of messages) {
            if (!message.trim()) continue;

            try {
                // 提取消息内容
                const match = message.match(/^data: (.*)/);
                if (!match) continue;

                const data = JSON.parse(match[1]);

                // 根据事件类型分发
                switch (data.event) {
                    case 'message':
                        // 处理普通消息块
                        this.eventCallbacks.message({
                            text: data.answer,
                            messageId: data.message_id,
                            conversationId: data.conversation_id,
                            done: false
                        });
                        break;

                    case 'message_end':
                        // 处理消息结束事件
                        this.eventCallbacks.done({
                            messageId: data.id,
                            conversationId: data.conversation_id,
                            metadata: data.metadata
                        });
                        break;

                    case 'error':
                        // 处理错误事件
                        this.eventCallbacks.error({
                            message: data.message,
                            code: data.code,
                            status: data.status
                        });
                        break;

                    case 'message_file':
                        // 处理文件消息
                        this.eventCallbacks.message({
                            file: {
                                id: data.id,
                                type: data.type,
                                url: data.url
                            },
                            conversationId: data.conversation_id,
                            isFile: true
                        });
                        break;
                }
            } catch (error) {
                console.error('Error parsing SSE message:', error, message);
            }
        }
    }

    /**
     * 重置解析器状态
     */
    reset() {
        this.buffer = '';
    }
}

export default new StreamParser();
