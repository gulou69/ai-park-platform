# uni-app H5 构建（需要 Node 16 兼容 @dcloudio 2.x）
FROM node:16-alpine AS builder
WORKDIR /app

# 复制package文件并安装依赖
COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com && npm install --legacy-peer-deps

# 复制所有文件
COPY . .

# 构建H5产物（生产模式，UNI_INPUT_DIR 指向项目根目录）
RUN npx cross-env NODE_ENV=production UNI_PLATFORM=h5 UNI_INPUT_DIR=/app vue-cli-service build --mode production

# 若产物在 dist/build/h5 则用它，否则回退到 dist/dev/h5
RUN if [ -d /app/dist/build/h5 ]; then \
      echo "Using production build"; \
    elif [ -d /app/dist/dev/h5 ]; then \
      mkdir -p /app/dist/build && cp -r /app/dist/dev/h5 /app/dist/build/h5; \
      echo "Copied dev build to build path"; \
    fi

# 运行时阶段
FROM nginx:alpine
# 修正nginx配置路径
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 复制产物目录
COPY --from=builder /app/dist/build/h5 /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
