#!/bin/bash

# ============================================
# Knowledge Base - Docker 部署脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 日志函数
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}==>${NC} $1"; }

# 显示 Banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║              Knowledge Base - Docker 部署                 ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查 Docker
check_docker() {
    log_step "检查 Docker..."
    
    if ! command -v docker &>/dev/null; then
        log_error "Docker 未安装"
        echo ""
        echo "请先安装 Docker:"
        echo "  macOS:   https://docs.docker.com/desktop/install/mac-install/"
        echo "  Windows: https://docs.docker.com/desktop/install/windows-install/"
        echo "  Linux:   https://docs.docker.com/engine/install/"
        exit 1
    fi
    
    if ! docker info &>/dev/null; then
        log_error "Docker 未运行，请启动 Docker Desktop"
        exit 1
    fi
    
    log_success "Docker 运行中 ✓"
}

# 检查 Docker Compose
check_docker_compose() {
    if docker compose version &>/dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &>/dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    # 检查 docker-compose.yml 文件
    if [ ! -f "$SCRIPT_DIR/docker-compose.yml" ]; then
        log_error "未找到 docker-compose.yml 文件"
        exit 1
    fi
    
    log_success "Docker Compose 就绪 ✓"
}

# 检查环境变量文件
check_env() {
    log_step "检查环境配置..."
    
    if [ ! -f ".env" ]; then
        log_warning "未找到 .env 文件"
        log_info "从 .env.example 创建 .env 文件..."
        cp .env.example .env
        log_success "已创建 .env 文件"
        echo ""
        log_warning "请编辑 .env 文件，配置您的 AI API Key"
        echo ""
        read -p "是否现在编辑 .env 文件？(y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} .env
        fi
    else
        log_success ".env 文件已存在 ✓"
    fi
}

# 构建镜像
build_images() {
    log_step "构建 Docker 镜像..."
    
    cd "$SCRIPT_DIR"
    $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" build --no-cache
    
    log_success "镜像构建完成 ✓"
}

# 启动服务
start_services() {
    log_step "启动服务..."
    
    cd "$SCRIPT_DIR"
    $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" up -d
    
    log_info "等待服务启动..."
    sleep 10
    
    log_success "服务启动完成 ✓"
}

# 初始化数据库
init_database() {
    log_step "初始化数据库..."
    
    # 等待 PostgreSQL 就绪
    log_info "等待 PostgreSQL 就绪..."
    for i in {1..30}; do
        if docker exec kb-postgres pg_isready -U kb_user -d knowledge_base &>/dev/null; then
            break
        fi
        sleep 1
    done
    
    # 运行 Prisma 迁移
    log_info "运行数据库迁移..."
    $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" exec api npx prisma migrate deploy 2>/dev/null || {
        log_info "使用 db push 同步数据库..."
        $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" exec api npx prisma db push --skip-generate
    }
    
    log_success "数据库初始化完成 ✓"
}

# 显示状态
show_status() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  部署完成！${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "服务地址："
    echo -e "  ${GREEN}Web:${NC}   http://localhost:${WEB_PORT:-3000}"
    echo -e "  ${GREEN}API:${NC}   http://localhost:${API_PORT:-4000}/api"
    echo -e "  ${GREEN}Docs:${NC}  http://localhost:${API_PORT:-4000}/api"
    echo ""
    echo -e "管理命令："
    echo -e "  ${CYAN}docker compose logs -f${NC}      查看日志"
    echo -e "  ${CYAN}docker compose down${NC}         停止服务"
    echo -e "  ${CYAN}docker compose restart${NC}      重启服务"
    echo ""
}

# 显示帮助
show_help() {
    echo ""
    echo "用法: ./docker-deploy.sh [命令]"
    echo ""
    echo "命令:"
    echo "  build     构建镜像"
    echo "  start     启动服务"
    echo "  stop      停止服务"
    echo "  restart   重启服务"
    echo "  logs      查看日志"
    echo "  status    查看状态"
    echo "  rebuild   重新构建并启动"
    echo "  clean     清理所有容器和数据"
    echo "  help      显示帮助"
    echo ""
}

# 主函数
main() {
    show_banner
    
    case "${1:-deploy}" in
        build)
            check_docker
            check_docker_compose
            check_env
            build_images
            ;;
        start)
            check_docker
            check_docker_compose
            start_services
            init_database
            show_status
            ;;
        stop)
            check_docker
            check_docker_compose
            log_step "停止服务..."
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" down
            log_success "服务已停止"
            ;;
        restart)
            check_docker
            check_docker_compose
            log_step "重启服务..."
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" restart
            log_success "服务已重启"
            ;;
        logs)
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" logs -f
            ;;
        status)
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" ps
            ;;
        rebuild)
            check_docker
            check_docker_compose
            check_env
            log_step "重新构建..."
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" down
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" build --no-cache
            $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" up -d
            init_database
            show_status
            ;;
        clean)
            check_docker
            check_docker_compose
            log_warning "这将删除所有容器和数据卷！"
            read -p "确定要继续吗？(y/n) " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                $COMPOSE_CMD -f "$SCRIPT_DIR/docker-compose.yml" down -v --rmi local
                log_success "清理完成"
            fi
            ;;
        help|--help|-h)
            show_help
            ;;
        deploy|"")
            check_docker
            check_docker_compose
            check_env
            build_images
            start_services
            init_database
            show_status
            ;;
        *)
            log_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
