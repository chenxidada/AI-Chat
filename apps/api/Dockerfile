# ============================================
# Knowledge Base API - Production Dockerfile
# ============================================

# Stage 1: 依赖安装
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# 复制 package 文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖
RUN pnpm install --frozen-lockfile

# Stage 2: 构建
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# 复制源代码
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api ./apps/api
COPY packages/shared ./packages/shared

# 生成 Prisma Client
WORKDIR /app/apps/api
RUN npx prisma generate

# 构建 shared 包
WORKDIR /app/packages/shared
RUN pnpm run build

# 构建 API
WORKDIR /app/apps/api
RUN pnpm run build

# Stage 3: 生产镜像
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl netcat-openbsd wget

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=4000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# 复制构建产物
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# 复制 package 文件
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# 复制启动脚本
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# 设置权限
RUN chown -R nestjs:nodejs /app

USER nestjs

WORKDIR /app/apps/api

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

EXPOSE 4000

ENTRYPOINT ["/docker-entrypoint.sh"]
