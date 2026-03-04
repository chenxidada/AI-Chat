#!/bin/bash
set -e

# ============================================
# Knowledge Base - Phase 0 验证脚本
# ============================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
PASSED=0
FAILED=0

# 打印标题
print_header() {
  echo ""
  echo -e "${BLUE}============================================${NC}"
  echo -e "${BLUE}   Knowledge Base - Phase 0 验证脚本${NC}"
  echo -e "${BLUE}============================================${NC}"
  echo ""
}

# 检查函数
check() {
  local name=$1
  local cmd=$2
  echo -n "  检查 $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗${NC}"
    ((FAILED++))
    return 1
  fi
}

# 可选检查（失败不计入失败数）
check_optional() {
  local name=$1
  local cmd=$2
  echo -n "  检查 $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
    ((PASSED++))
    return 0
  else
    echo -e "${YELLOW}⚠ (可选)${NC}"
    return 1
  fi
}

print_header

# ============================================
# 1. 环境检查
# ============================================
echo -e "${YELLOW}[1/5] 环境检查${NC}"

check "Node.js >= 20" "node -v | grep -E 'v2[0-9]|v[3-9][0-9]'"
check "pnpm" "pnpm -v"
check "Docker" "docker info"
check "Docker Compose" "docker compose version"

# ============================================
# 2. Docker 服务检查
# ============================================
echo -e "\n${YELLOW}[2/5] Docker 服务检查${NC}"

# 检查容器是否运行
if ! docker ps | grep -q kb-postgres; then
  echo -e "  ${YELLOW}PostgreSQL 容器未运行，尝试启动...${NC}"
  docker compose up -d postgres
  sleep 5
fi

if ! docker ps | grep -q kb-meilisearch; then
  echo -e "  ${YELLOW}Meilisearch 容器未运行，尝试启动...${NC}"
  docker compose up -d meilisearch
  sleep 3
fi

check "PostgreSQL 容器运行" "docker ps | grep kb-postgres"
check "Meilisearch 容器运行" "docker ps | grep kb-meilisearch"

# ============================================
# 3. 数据库检查
# ============================================
echo -e "\n${YELLOW}[3/5] 数据库检查${NC}"

check "PostgreSQL 连接" "docker exec kb-postgres pg_isready -U kb_user -d knowledge_base"
check "pgvector 扩展" "docker exec kb-postgres psql -U kb_user -d knowledge_base -c \"SELECT extname FROM pg_extension WHERE extname='vector'\" | grep -q vector"
check "uuid-ossp 扩展" "docker exec kb-postgres psql -U kb_user -d knowledge_base -c \"SELECT extname FROM pg_extension WHERE extname='uuid-ossp'\" | grep -q uuid-ossp"

# ============================================
# 4. 服务检查
# ============================================
echo -e "\n${YELLOW}[4/5] 服务检查${NC}"

check "Meilisearch 健康" "curl -sf http://localhost:7700/health | grep -q available"

# API 检查（如果运行）
if curl -sf http://localhost:4000/api/health > /dev/null 2>&1; then
  check "API 健康检查" "curl -sf http://localhost:4000/api/health | grep -q ok"
  check "API 数据库连接" "curl -sf http://localhost:4000/api/health/db | grep -q connected"
  check "API pgvector 状态" "curl -sf http://localhost:4000/api/health/db | grep -q installed"
else
  echo -e "  ${YELLOW}API 服务未运行 (请运行 pnpm dev:api)${NC}"
fi

# ============================================
# 5. 前端检查
# ============================================
echo -e "\n${YELLOW}[5/5] 前端检查${NC}"

# 前端检查（如果运行）
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  check "前端可访问" "curl -sf http://localhost:3000 | grep -qi 'knowledge'"
else
  echo -e "  ${YELLOW}前端服务未运行 (请运行 pnpm dev:web)${NC}"
fi

# ============================================
# 结果汇总
# ============================================
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   验证结果汇总${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "  通过: ${GREEN}${PASSED}${NC}"
echo -e "  失败: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 Phase 0 验证全部通过!${NC}"
  echo ""
  echo "访问地址:"
  echo "  - 前端:       http://localhost:3000"
  echo "  - API:        http://localhost:4000/api"
  echo "  - Swagger:    http://localhost:4000/api/docs"
  echo "  - Meilisearch: http://localhost:7700"
  echo "  - DB Studio:  pnpm db:studio"
  exit 0
else
  echo -e "${RED}❌ 部分验证未通过，请检查上述失败项${NC}"
  echo ""
  echo "常见问题:"
  echo "  1. Docker 服务未启动: pnpm docker:up"
  echo "  2. 数据库未迁移: pnpm db:migrate"
  echo "  3. API 未启动: pnpm dev:api"
  echo "  4. 前端未启动: pnpm dev:web"
  exit 1
fi
