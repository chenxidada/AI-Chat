#!/bin/bash

# ============================================
# Knowledge Base - 启动脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 项目根目录（脚本所在目录）
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# 确保 package.json 存在
if [ ! -f "package.json" ]; then
    log_error "未找到 package.json"
    log_error "当前目录: $(pwd)"
    log_error "请确保在项目根目录 (APP2) 运行此脚本"
    exit 1
fi

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
    echo "║                                                           ║"
    echo "║     ██╗  ██╗██╗██████╗ ██╗   ██╗███████╗██████╗          ║"
    echo "║     ██║ ██╔╝██║██╔══██╗██║   ██║██╔════╝██╔══██╗         ║"
    echo "║     █████╔╝ ██║██████╔╝██║   ██║█████╗  ██████╔╝         ║"
    echo "║     ██╔═██╗ ██║██╔══██╗██║   ██║██╔══╝  ██╔══██╗         ║"
    echo "║     ██║  ██╗██║██║  ██║╚██████╔╝███████╗██║  ██║         ║"
    echo "║     ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝         ║"
    echo "║                                                           ║"
    echo "║              Knowledge Base Application                   ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js 版本
check_node() {
    log_step "检查 Node.js 版本..."
    
    if ! command_exists node; then
        log_error "Node.js 未安装，请先安装 Node.js 20+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 20 ]; then
        log_error "Node.js 版本过低 (当前: $(node -v))，需要 20+"
        exit 1
    fi
    
    log_success "Node.js $(node -v) ✓"
}

# 检查 pnpm
check_pnpm() {
    log_step "检查 pnpm..."
    
    if ! command_exists pnpm; then
        log_warning "pnpm 未安装，正在安装..."
        npm install -g pnpm@9.1.0
    fi
    
    log_success "pnpm $(pnpm -v) ✓"
}

# 检查 Docker
check_docker() {
    log_step "检查 Docker..."
    
    if ! command_exists docker; then
        log_warning "Docker 未安装，将跳过 Docker 服务启动"
        return 1
    fi
    
    if ! docker info >/dev/null 2>&1; then
        log_warning "Docker 未运行，请启动 Docker Desktop"
        return 1
    fi
    
    log_success "Docker 运行中 ✓"
    return 0
}

# 检查 Docker Compose
check_docker_compose() {
    if command_exists docker-compose; then
        return 0
    elif docker compose version >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# 安装依赖
install_dependencies() {
    log_step "检查依赖..."
    
    if [ ! -d "node_modules" ] || [ ! -d "apps/api/node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
        log_info "安装项目依赖..."
        pnpm install
        log_success "依赖安装完成"
    else
        log_success "依赖已安装 ✓"
    fi
}

# 启动 Docker 服务
start_docker_services() {
    log_step "启动 Docker 服务..."

    local compose_file="$PROJECT_ROOT/docker-compose.yml"

    if [ ! -f "$compose_file" ]; then
        log_warning "未找到 docker-compose.yml，跳过 Docker 服务"
        return 1
    fi

    # 检查 Docker Compose 命令
    if check_docker_compose; then
        if command_exists docker-compose; then
            COMPOSE_CMD="docker-compose"
        else
            COMPOSE_CMD="docker compose"
        fi

        log_info "启动 PostgreSQL 和 Redis..."
        cd "$PROJECT_ROOT"

        if $COMPOSE_CMD -f "$compose_file" up -d 2>&1; then
            # 等待服务启动
            log_info "等待服务启动..."
            sleep 3
            log_success "Docker 服务已启动 ✓"
            return 0
        else
            log_warning "Docker 服务启动失败"
            log_info "请确保 Docker Desktop 正在运行"
            log_info "或使用 --no-docker 参数跳过 Docker 服务"
            return 1
        fi
    else
        log_warning "Docker Compose 未安装，跳过"
        return 1
    fi
}

# 同步数据库
sync_database() {
    log_step "同步数据库..."
    
    cd apps/api
    
    # 生成 Prisma Client
    log_info "生成 Prisma Client..."
    pnpm exec prisma generate
    
    # 同步数据库结构
    log_info "同步数据库结构..."
    pnpm exec prisma db push --skip-generate
    
    cd "$PROJECT_ROOT"
    log_success "数据库同步完成 ✓"
}

# 检查环境变量
check_env() {
    log_step "检查环境变量..."
    
    if [ ! -f "apps/api/.env" ] && [ ! -f "apps/api/.env.local" ]; then
        log_warning "未找到 .env 文件，使用默认配置"
        
        # 创建默认 .env 文件
        cat > apps/api/.env << EOF
# 数据库配置
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knowledge_base"

# Redis 配置
REDIS_URL="redis://localhost:6379"

# AI 配置 (请替换为您的 API Key)
AI_API_KEY="your-api-key-here"
AI_API_BASE_URL="https://api.openai.com/v1"
AI_MODEL="gpt-3.5-turbo"

# 应用配置
PORT=4000
NODE_ENV=development
EOF
        log_info "已创建默认 .env 文件，请根据需要修改"
    fi
    
    log_success "环境变量检查完成 ✓"
}

# 启动开发服务器
start_dev() {
    log_step "启动开发服务器..."
    
    echo ""
    log_info "🚀 启动服务..."
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}API Server:${NC}  http://localhost:4000"
    echo -e "  ${GREEN}API Docs:${NC}    http://localhost:4000/api"
    echo -e "  ${GREEN}Web App:${NC}    http://localhost:3000"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    log_info "按 Ctrl+C 停止服务"
    echo ""
    
    # 启动服务
    pnpm dev
}

# 仅启动 API
start_api_only() {
    log_step "启动 API 服务器..."
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}API Server:${NC}  http://localhost:4000"
    echo -e "  ${GREEN}API Docs:${NC}    http://localhost:4000/api"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    pnpm dev:api
}

# 仅启动 Web
start_web_only() {
    log_step "启动 Web 服务器..."
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}Web App:${NC}    http://localhost:3000"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    pnpm dev:web
}

# 显示帮助
show_help() {
    echo ""
    echo "用法: ./start.sh [选项]"
    echo ""
    echo "选项:"
    echo "  --api         仅启动 API 服务器"
    echo "  --web         仅启动 Web 服务器"
    echo "  --no-docker   跳过 Docker 服务启动"
    echo "  --no-db       跳过数据库同步"
    echo "  --install     重新安装依赖"
    echo "  -h, --help    显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./start.sh              # 完整启动流程"
    echo "  ./start.sh --api        # 仅启动 API"
    echo "  ./start.sh --no-docker  # 跳过 Docker"
    echo ""
}

# 主函数
main() {
    # 默认参数
    START_API_ONLY=false
    START_WEB_ONLY=false
    USE_DOCKER=true
    SYNC_DB=true
    FORCE_INSTALL=false
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --api)
                START_API_ONLY=true
                shift
                ;;
            --web)
                START_WEB_ONLY=true
                shift
                ;;
            --no-docker)
                USE_DOCKER=false
                shift
                ;;
            --no-db)
                SYNC_DB=false
                shift
                ;;
            --install)
                FORCE_INSTALL=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "未知参数: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 显示 Banner
    show_banner
    
    # 检查环境
    check_node
    check_pnpm
    
    # 安装依赖
    if [ "$FORCE_INSTALL" = true ]; then
        rm -rf node_modules apps/api/node_modules apps/web/node_modules
        pnpm install
    else
        install_dependencies
    fi
    
    # Docker 服务
    if [ "$USE_DOCKER" = true ]; then
        check_docker && start_docker_services
    fi
    
    # 环境变量
    check_env
    
    # 数据库同步
    if [ "$SYNC_DB" = true ]; then
        sync_database
    fi
    
    # 启动服务
    if [ "$START_API_ONLY" = true ]; then
        start_api_only
    elif [ "$START_WEB_ONLY" = true ]; then
        start_web_only
    else
        start_dev
    fi
}

# 运行主函数
main "$@"
