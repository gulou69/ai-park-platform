#!/bin/bash

# AI Park Docker 部署脚本
# 使用方法: ./docker-deploy.sh [start|stop|restart|logs|build]

set -e

PROJECT_NAME="ai-park"
COMPOSE_FILE="docker-compose.yml"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    # 检查Docker权限
    if ! docker ps &> /dev/null; then
        log_error "Docker权限不足，请执行以下命令之一："
        log_error "1. 使用sudo运行此脚本: sudo $0 $1"
        log_error "2. 将用户加入docker组: sudo usermod -aG docker \$USER && newgrp docker"
        log_error "3. 重新登录系统生效docker组权限"
        exit 1
    fi
}

# 检查环境配置文件
check_env() {
    # 检查Docker环境配置文件
    if [ ! -f ".env.docker" ]; then
        log_warn ".env.docker 文件不存在，正在从 .env 文件创建..."
        if [ -f ".env" ]; then
            cp .env .env.docker
            log_info "已创建 .env.docker 文件"
        else
            log_error ".env 文件不存在，请先创建环境配置文件"
            exit 1
        fi
    fi
    
    # 检查必要的配置项
    if ! grep -q "NODE_ENV=production" .env.docker; then
        log_warn "设置生产环境配置..."
        sed -i 's/NODE_ENV=.*/NODE_ENV=production/' .env.docker 2>/dev/null || echo "NODE_ENV=production" >> .env.docker
    fi
}

# 等待容器服务就绪
wait_for_services() {
    log_info "等待容器服务启动完成..."
    
    # 等待MySQL容器健康检查通过
    log_info "等待MySQL服务就绪..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if docker compose exec -T mysql mysqladmin ping -h localhost -u root -p"${MYSQL_ROOT_PASSWORD:-changeme}" &>/dev/null; then
            log_info "✅ MySQL服务已就绪"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        log_error "MySQL服务启动超时"
        return 1
    fi
    
    # 等待Redis容器健康检查通过
    log_info "等待Redis服务就绪..."
    timeout=30
    while [ $timeout -gt 0 ]; do
        if docker compose exec -T redis redis-cli ping &>/dev/null; then
            log_info "✅ Redis服务已就绪"
            break
        fi
        sleep 2
        timeout=$((timeout - 2))
    done
    
    if [ $timeout -le 0 ]; then
        log_error "Redis服务启动超时"
        return 1
    fi
    
    # 等待后端服务健康检查通过
    log_info "等待后端服务就绪..."
    timeout=60
    while [ $timeout -gt 0 ]; do
        if curl -f http://localhost:3001/health &>/dev/null; then
            log_info "✅ 后端服务已就绪"
            break
        fi
        sleep 3
        timeout=$((timeout - 3))
    done
    
    if [ $timeout -le 0 ]; then
        log_warn "后端服务健康检查超时，请检查日志"
    fi
}

# 启动服务
start_services() {
    log_info "启动 AI Park 服务..."
    check_docker
    check_env
    
    # 停止现有服务（如果存在）
    log_info "停止现有服务..."
    docker compose -f $COMPOSE_FILE down 2>/dev/null || true
    
    # 构建并启动服务
    log_info "构建并启动所有服务..."
    docker compose -f $COMPOSE_FILE up -d --build
    
    # 等待服务就绪
    wait_for_services
    
    # 检查服务状态
    docker compose -f $COMPOSE_FILE ps
    
    log_info "AI Park 服务启动完成！"
    echo ""
    log_info "🌐 访问地址："
    log_info "   前端应用: http://localhost:8080"
    log_info "   管理后台: http://localhost:7723"
    log_info "   后端API:  http://localhost:3001"
    log_info "   健康检查: http://localhost:3001/health"
    echo ""
    log_info "💡 如需外网访问，请将 localhost 替换为服务器公网IP"
}

# 停止服务
stop_services() {
    log_info "停止 AI Park 服务..."
    docker compose -f $COMPOSE_FILE down
    log_info "服务已停止"
}

# 重启服务
restart_services() {
    log_info "重启 AI Park 服务..."
    stop_services
    start_services
}

# 查看日志
view_logs() {
    if [ -z "$2" ]; then
        # 查看所有服务日志
        docker compose -f $COMPOSE_FILE logs -f
    else
        # 查看指定服务日志
        docker compose -f $COMPOSE_FILE logs -f "$2"
    fi
}

# 重新构建
rebuild_services() {
    log_info "重新构建 AI Park 服务..."
    docker compose -f $COMPOSE_FILE down
    docker compose -f $COMPOSE_FILE build --no-cache
    docker compose -f $COMPOSE_FILE up -d
    log_info "重新构建完成"
}

# 清理资源
clean_resources() {
    log_warn "清理 Docker 资源..."
    docker compose -f $COMPOSE_FILE down -v --remove-orphans
    docker system prune -f
    log_info "清理完成"
}

# 备份数据
backup_data() {
    log_info "备份数据库..."
    timestamp=$(date +"%Y%m%d_%H%M%S")
    backup_file="backup_${timestamp}.sql"
    
    # 使用固定的root密码进行备份
    docker compose -f $COMPOSE_FILE exec -T mysql mysqldump -u root -p"${MYSQL_ROOT_PASSWORD:-changeme}" ai_park > "$backup_file"
    
    if [ $? -eq 0 ]; then
        log_info "数据库备份完成: $backup_file"
    else
        log_error "数据库备份失败"
    fi
}

# 显示帮助信息
show_help() {
    echo "AI Park Docker 部署脚本"
    echo ""
    echo "使用方法: $0 [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  start     启动所有服务"
    echo "  stop      停止所有服务"
    echo "  restart   重启所有服务"
    echo "  logs      查看日志 (可指定服务名)"
    echo "  build     重新构建服务"
    echo "  clean     清理Docker资源"
    echo "  backup    备份数据库"
    echo "  status    查看服务状态"
    echo "  help      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 start                    # 启动所有服务"
    echo "  $0 logs backend             # 查看后端服务日志"
    echo "  $0 restart                  # 重启所有服务"
}

# 查看服务状态
show_status() {
    log_info "查看服务状态..."
    docker compose -f $COMPOSE_FILE ps
    
    echo ""
    log_info "容器资源使用情况:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

# 主逻辑
if [ $# -eq 0 ]; then
    log_warn "请提供命令参数"
    echo ""
    show_help
    exit 1
fi

case "$1" in
    start)
        start_services
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    logs)
        view_logs "$@"
        ;;
    build)
        rebuild_services
        ;;
    clean)
        clean_resources
        ;;
    backup)
        backup_data
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "未知命令: $1"
        echo ""
        show_help
        exit 1
        ;;
esac

exit 0
