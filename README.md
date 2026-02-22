# AI Park - 多模型AI智能对话平台

AI Park 是一个基于 Dify API 的多模型 AI 聊天平台，支持接入多种大语言模型，提供统一的对话界面和完善的后台管理系统。项目采用前后端分离架构，支持 Docker 一键部署。

## 项目简介

本项目为完整的 AI 对话平台解决方案，包含三大模块：

- **用户前端**：基于 uni-app 的跨平台聊天界面，支持 H5、微信小程序、App 多端运行
- **管理后台**：基于 Vue 3 + Element Plus 的管理面板，提供用户管理、模型管理、数据统计等功能
- **后端服务**：基于 Node.js + Express 的 REST API 服务，处理业务逻辑和 AI 接口代理

## 核心功能

### 用户端

- 多模型选择：支持免费/付费模型分类展示，用户自主选择 AI 模型
- 流式对话：基于 SSE（Server-Sent Events）实现实时流式输出，支持停止生成
- 思考过程展示：解析 `<think>` 标签，展示 AI 的思考推理过程
- 会话管理：支持多会话创建、切换、删除，自动保存对话历史
- 主题切换：深色/浅色模式，支持跟随系统偏好设置
- 响应式设计：适配桌面端和移动端，包含安全区域和刘海屏适配
- 用户认证：手机号 + 验证码注册登录，JWT 令牌认证

### 管理后台

- 数据看板：用户增长趋势、模型使用统计、会话活跃度图表（ECharts）
- 用户管理：用户列表查看、状态管理、搜索筛选
- 模型管理：AI 模型 CRUD 操作，支持在线测试 API 连通性
- 会话管理：查看所有用户会话记录
- 验证码管理：短信验证码发送记录查看
- 管理员管理：三级角色体系（超级管理员/管理员/操作员），细粒度权限控制
- 系统监控：CPU、内存、存储等系统资源实时监控

## 技术栈

| 模块 | 技术 |
|------|------|
| 用户前端 | uni-app (Vue 2)、markdown-it、CSS Variables 主题 |
| 管理后台 | Vue 3、Vite、Element Plus、Pinia、ECharts、Vue Router |
| 后端服务 | Node.js、Express、Helmet、Morgan |
| 认证方案 | JWT (jsonwebtoken)、bcryptjs |
| 数据库 | MySQL 8.0 (mysql2) |
| 缓存 | Redis 7 |
| AI 集成 | Dify API (SSE 流式传输) |
| 容器化 | Docker、Docker Compose |
| 反向代理 | Nginx |

## 项目结构

```
ai-park/              # 用户前端（uni-app 项目）
  api/                # API 接口封装
  components/         # 通用组件（聊天区域、侧边栏、消息气泡等）
  config/             # 全局配置
  pages/              # 页面（首页、注册、找回密码）
  styles/             # 全局样式
  utils/              # 工具函数（流式解析、网络请求、主题等）

admin-vue/            # 管理后台（Vue 3 项目）
  src/
    config/           # 配置文件
    layout/           # 布局组件
    router/           # 路由配置
    stores/           # Pinia 状态管理
    styles/           # 全局样式
    utils/            # API 请求封装
    views/            # 页面视图

backend/              # 后端服务（Node.js）
  controllers/        # 控制器（用户、聊天、模型、管理员）
  middleware/         # 管理员认证中间件
  middlewares/        # 用户认证中间件
  models/             # 数据模型
  routes/             # API 路由
  scripts/            # 初始化脚本
  services/           # 业务服务（短信验证码）
  utils/              # 工具函数（数据库、Redis、JWT）

docker-compose.yml    # Docker 编排配置
docker-deploy.sh      # 部署脚本
init.sql              # 数据库初始化脚本
```

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 8.0+
- Redis 7+
- Docker 和 Docker Compose（可选，用于容器化部署）
- Dify 平台实例（用于 AI 模型接入）

### Docker 部署（推荐）

1. 克隆项目

```bash
git clone https://github.com/YOUR_USERNAME/ai-park-platform.git
cd ai-park-platform
```

2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，填入实际的数据库密码、JWT 密钥等配置
```

3. 启动服务

```bash
chmod +x docker-deploy.sh
./docker-deploy.sh start
```

4. 访问服务

- 用户前端：http://localhost:8080
- 管理后台：http://localhost:7723
- 后端 API：http://localhost:3001

### 本地开发

1. 安装依赖

```bash
# 后端
cd backend
cp .env.example .env
# 编辑 .env 填入数据库配置
npm install

# 用户前端
cd ../ai-park
npm install

# 管理后台
cd ../admin-vue
cp .env.example .env
npm install
```

2. 初始化数据库

```bash
# 导入 init.sql 到 MySQL
mysql -u root -p ai_park < init.sql
```

3. 启动开发服务器

```bash
# 后端
cd backend
npm run dev

# 用户前端（需要 HBuilderX 或使用命令行）
cd ai-park
npm run dev

# 管理后台
cd admin-vue
npm run dev
```

### 默认管理员账户

- 用户名：admin
- 密码：admin123
- 请在首次登录后立即修改默认密码

## AI 模型接入

本项目通过 Dify API 接入 AI 模型。接入步骤：

1. 部署或注册 Dify 平台（https://dify.ai）
2. 在 Dify 中创建应用并获取 API Key
3. 登录管理后台，在"模型管理"中添加新模型
4. 填写 Dify API 地址和 API Key
5. 使用在线测试功能验证连通性

## 部署说明

### Docker Compose 架构

项目通过 Docker Compose 编排以下 5 个容器：

| 容器 | 服务 | 端口 |
|------|------|------|
| ai-park-mysql | MySQL 数据库 | 3306 |
| ai-park-redis | Redis 缓存 | 6379 |
| ai-park-backend | 后端 API 服务 | 3001 |
| ai-park-frontend | 用户前端 | 8080 |
| ai-park-admin | 管理后台 | 7723 |

### 部署脚本命令

```bash
./docker-deploy.sh start     # 启动所有服务
./docker-deploy.sh stop      # 停止所有服务
./docker-deploy.sh restart   # 重启所有服务
./docker-deploy.sh logs      # 查看日志
./docker-deploy.sh build     # 重新构建
./docker-deploy.sh backup    # 备份数据库
./docker-deploy.sh status    # 查看状态
```

## 许可证

MIT License
