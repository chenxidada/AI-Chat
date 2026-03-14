#!/bin/bash

# ============================================
# Knowledge Base - 停止脚本
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              停止 Knowledge Base 服务                     ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 停止 Node 进程
log_info "停止 Node.js 进程..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "nest start" 2>/dev/null || true
log_success "Node.js 进程已停止"

# 停止 Docker 服务
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    if [ -f "docker-compose.yml" ]; then
        log_info "停止 Docker 服务..."
        if command -v docker-compose >/dev/null 2>&1; then
            docker-compose down
        else
            docker compose down
        fi
        log_success "Docker 服务已停止"
    fi
fi

echo ""
log_success "所有服务已停止 ✓"
