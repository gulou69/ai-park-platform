/**
 * 全局配置
 * 包含API地址、超时设置等
 */
export default {
    // API基础URL（部署时替换为实际服务器地址）
    apiBaseUrl: 'http://localhost:3001',

    // 上传API基础URL（部署时替换为实际服务器地址）
    uploadBaseUrl: 'http://localhost:3001',

    // 常规请求超时时间（毫秒）
    requestTimeout: 10000,

    // AI请求超时时间（毫秒）
    aiRequestTimeout: 60000,

    // 流式请求分块大小（字节）
    chunkSize: 4096,

    // 全局默认头像
    defaultAvatar: '/static/icons/person-circle.svg',

    // 聊天相关配置
    chat: {
        // 最大输入长度
        maxInputLength: 4000,
        // 最大显示消息数
        maxMessages: 100,
        // 默认模型ID (若未指定)
        defaultModelId: 1
    }
};
