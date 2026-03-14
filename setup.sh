#!/bin/bash

# ============================================
# Knowledge Base - 快速设置脚本
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# 切换到项目根目录并验证
cd "$SCRIPT_DIR" || {
    echo -e "${RED}错误: 无法切换到项目目录${NC}"
    exit 1
}

# 确保 package.json 存在
if [ ! -f "package.json" ]; then
    echo -e "${RED}错误: 未找到 package.json${NC}"
    echo -e "${YELLOW}当前目录: $(pwd)${NC}"
    echo -e "${YELLOW}请确保在项目根目录运行此脚本${NC}"
    exit 1
fi

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_step() { echo -e "${CYAN}==>${NC} $1"; }

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Knowledge Base 快速设置                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. 检查 Node.js
log_step "检查 Node.js..."
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}请先安装 Node.js 20+${NC}"
    exit 1
fi
log_success "Node.js $(node -v) ✓"

# 2. 检查 pnpm
log_step "检查 pnpm..."
if ! command -v pnpm >/dev/null 2>&1; then
    log_info "安装 pnpm..."
    npm install -g pnpm@9.1.0
fi
log_success "pnpm $(pnpm -v) ✓"

# 3. 安装依赖
log_step "安装项目依赖..."
pnpm install
log_success "依赖安装完成 ✓"

# 4. 创建环境变量文件
log_step "配置环境变量..."
if [ ! -f "apps/api/.env" ] && [ ! -f "apps/api/.env.local" ]; then
    cat > apps/api/.env << 'EOF'
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
    log_success "已创建 .env 文件 ✓"
else
    log_success ".env 文件已存在 ✓"
fi

# 5. 启动 Docker 服务
log_step "启动 Docker 服务..."
DOCKER_STARTED=false
if command -v docker >/dev/null 2>&1; then
    if docker info >/dev/null 2>&1; then
        if [ -f "docker-compose.yml" ]; then
            # 尝试启动 Docker 服务
            if docker compose up -d 2>/dev/null; then
                sleep 3
                log_success "Docker 服务已启动 ✓"
                DOCKER_STARTED=true
            elif docker-compose up -d 2>/dev/null; then
                sleep 3
                log_success "Docker 服务已启动 ✓"
                DOCKER_STARTED=true
            else
                log_warning "Docker 服务启动失败，请手动启动或检查 Docker Desktop"
            fi
        fi
    else
        log_warning "Docker 未运行，跳过 Docker 服务"
    fi
else
    log_warning "Docker 未安装，跳过 Docker 服务"
fi

if [ "$DOCKER_STARTED" = false ]; then
    log_info "将使用本地数据库连接（请确保 PostgreSQL 已启动）"
fi

# 6. 初始化数据库
log_step "初始化数据库..."
cd apps/api
pnpm exec prisma generate
if pnpm exec prisma db push --skip-generate 2>/dev/null; then
    cd "$PROJECT_ROOT"
    log_success "数据库初始化完成 ✓"
else
    cd "$PROJECT_ROOT"
    log_warning "数据库连接失败"
    log_info "请确保 PostgreSQL 已启动，或检查 DATABASE_URL 配置"
    log_info "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/knowledge_base"
fi

# 完成
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  设置完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "接下来："
echo -e "  1. 编辑 ${CYAN}apps/api/.env${NC} 配置您的 AI API Key"
echo -e "  2. 运行 ${CYAN}./start.sh${NC} 启动服务"
echo ""
echo -e "快速命令："
echo -e "  ${CYAN}./start.sh${NC}        启动所有服务"
echo -e "  ${CYAN}./stop.sh${NC}         停止所有服务"
echo -e "  ${CYAN}./status.sh${NC}       查看服务状态"
echo ""
