# uni-app H5 构建（需要 Node 16 兼容 @dcloudio 2.x）
FROM node:16-alpine AS builder
WORKDIR /app

# 复制package文件并安装依赖
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps

# 复制所有文件
COPY . .

# 构建H5产物（UNI_INPUT_DIR 指向项目根目录，因为 HBuilderX 项目结构不在 src/ 下）
RUN npx cross-env UNI_PLATFORM=h5 UNI_INPUT_DIR=/app vue-cli-service build

# 运行时阶段
FROM nginx:alpine
# 修正nginx配置路径
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 复制实际产物目录（uni-app H5 构建输出到 dist/dev/h5）
COPY --from=builder /app/dist/dev/h5 /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
