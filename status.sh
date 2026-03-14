#!/bin/bash

# ============================================
# Knowledge Base - 状态检查脚本
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Knowledge Base 服务状态                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 检查服务状态
check_service() {
    local name=$1
    local port=$2
    
    if lsof -i :$port >/dev/null 2>&1; then
        echo -e "  ${GREEN}●${NC} $name (端口 $port) - ${GREEN}运行中${NC}"
        return 0
    else
        echo -e "  ${RED}○${NC} $name (端口 $port) - ${RED}未运行${NC}"
        return 1
    fi
}

# 检查 Docker 容器
check_docker() {
    echo -e "\n${CYAN}Docker 服务:${NC}"
    
    if ! command -v docker >/dev/null 2>&1; then
        echo -e "  ${YELLOW}○${NC} Docker 未安装"
        return
    fi
    
    if ! docker info >/dev/null 2>&1; then
        echo -e "  ${YELLOW}○${NC} Docker 未运行"
        return
    fi
    
    # 检查 PostgreSQL
    if docker ps --format '{{.Names}}' | grep -q postgres; then
        echo -e "  ${GREEN}●${NC} PostgreSQL - ${GREEN}运行中${NC}"
    else
        echo -e "  ${RED}○${NC} PostgreSQL - ${RED}未运行${NC}"
    fi
    
    # 检查 Redis
    if docker ps --format '{{.Names}}' | grep -q redis; then
        echo -e "  ${GREEN}●${NC} Redis - ${GREEN}运行中${NC}"
    else
        echo -e "  ${RED}○${NC} Redis - ${RED}未运行${NC}"
    fi
}

# 检查数据库连接
check_database() {
    echo -e "\n${CYAN}数据库连接:${NC}"
    
    if command -v psql >/dev/null 2>&1; then
        if PGPASSWORD=postgres psql -h localhost -U postgres -d knowledge_base -c "SELECT 1" >/dev/null 2>&1; then
            echo -e "  ${GREEN}●${NC} PostgreSQL 连接正常"
        else
            echo -e "  ${RED}○${NC} PostgreSQL 连接失败"
        fi
    else
        echo -e "  ${YELLOW}○${NC} psql 未安装，跳过检查"
    fi
    
    if command -v redis-cli >/dev/null 2>&1; then
        if redis-cli -h localhost ping >/dev/null 2>&1; then
            echo -e "  ${GREEN}●${NC} Redis 连接正常"
        else
            echo -e "  ${RED}○${NC} Redis 连接失败"
        fi
    else
        echo -e "  ${YELLOW}○${NC} redis-cli 未安装，跳过检查"
    fi
}

# 主程序
echo -e "${CYAN}应用服务:${NC}"
check_service "API Server" 4000
check_service "Web App" 3000

check_docker
check_database

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
