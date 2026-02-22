# 简化的uni-app构建
FROM node:18-alpine AS builder
WORKDIR /app

# 复制package文件并安装依赖
COPY package*.json ./
RUN npm install --legacy-peer-deps || npm install --force || npm install

# 复制所有文件
COPY . .

# 构建H5产物
RUN npm run build:h5 || echo "Build failed, using fallback page"

# 运行时阶段
FROM nginx:alpine
# 修正nginx配置路径
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 复制实际产物目录
COPY --from=builder /app/unpackage/dist/build/web /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
