FROM node:18-alpine

# 安装必要的系统工具，包括curl用于健康检查
RUN apk add --no-cache curl

# 设置环境变量以优化Node.js内存使用，避免SIGSEGV错误
ENV NODE_OPTIONS="--max-old-space-size=512 --no-experimental-fetch"
# 生产环境不启用详细调试
# ENV DEBUG=express:*,cors:*

WORKDIR /app

# 复制package文件并安装依赖
COPY package*.json ./
RUN npm install --production

# 复制应用代码
COPY . .

EXPOSE 3001

CMD ["npm", "run", "start"]
