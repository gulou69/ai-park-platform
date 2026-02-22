const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// 根据环境加载不同的.env文件
const envFile = process.env.NODE_ENV === 'production' ? '.env.docker' : '.env';
require('dotenv').config({ path: path.resolve(process.cwd(), envFile) });

// 调试环境变量加载情况
console.log(`使用环境配置文件: ${envFile}`);
console.log('环境变量状态:', {
    NODE_ENV: process.env.NODE_ENV || '未设置',
    PORT: process.env.PORT || '3001',
    JWT_SECRET: process.env.JWT_SECRET ? '已设置' : '未设置',
    MYSQL_HOST: process.env.MYSQL_HOST || '未设置',
    MYSQL_USER: process.env.MYSQL_USER || '未设置',
    MYSQL_DATABASE: process.env.MYSQL_DATABASE || '未设置'
});

// 导入路由
const userRoutes = require('./routes/userRoutes');
const modelRoutes = require('./routes/modelRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');


// 初始化Express应用
const app = express();

// 基本中间件
app.use(helmet()); // 安全增强

// 优化的CORS配置 - 解决CORS问题并避免安全问题
app.use(cors({
    // 动态设置允许的域名，而不是使用通配符
    origin: function(origin, callback) {
        // 允许所有域的请求，但不使用*通配符
        callback(null, origin || '');
    },
    
    // 启用凭证
    credentials: true, // 启用凭证支持
    
    // 允许的方法
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    
    // 允许的头部
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With', 
        'Accept', 
        'Origin',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods'
    ],
    
    // 暴露的头部
    exposedHeaders: ['X-Total-Count', 'Content-Length', 'Content-Type'],
    
    // 预检请求的有效期（秒）
    maxAge: 86400,
    
    // 预检请求响应状态码
    optionsSuccessStatus: 204,
    
    // 是否继续处理OPTIONS请求
    preflightContinue: false
}));

// 预检请求处理
app.options('*', cors());

// 添加额外的CORS头部处理
app.use((req, res, next) => {
    // 动态设置来源，而不是使用通配符
    const origin = req.headers.origin;
    if (origin) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    // 支持所有HTTP方法
    res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    // 允许所有常用请求头
    res.header('Access-Control-Allow-Headers', 
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, Access-Control-Allow-Origin, Access-Control-Allow-Methods, Access-Control-Allow-Headers');
    // 移除可能冲突的安全相关头部
    // res.header('Cross-Origin-Opener-Policy', 'same-origin');
    // res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    // 启用凭证，如cookies
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // 预检请求直接返回成功
    // if (req.method === 'OPTIONS') {
    //     console.log('接收到OPTIONS预检请求，直接返回200, origin:', origin);
    //     return res.sendStatus(200);
    // } 
    
    next();
});

app.use(express.json()); // JSON请求体解析
app.use(express.urlencoded({ extended: true })); // 表单数据解析

// 日志中间件
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// API路由
app.use('/api/users', userRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// 静态文件服务
app.use('/static', express.static(path.join(__dirname, 'public')));

// 健康检查路由
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'AI Park API服务正常运行',
        timestamp: new Date().toISOString()
    });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
    console.error('全局错误:', err);
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 处理404路由
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '未找到请求的资源'
    });
});

// 启动服务器
const PORT = process.env.PORT;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ╭───────────────────────────────────────────────╮
  │                                               │
  │      AI Park服务已启动                       │
  │      运行于 http://localhost:${PORT}            │
  │      环境: ${process.env.NODE_ENV || '开发环境'}                       │
  │                                               │
  ╰───────────────────────────────────────────────╯
  `);
});
