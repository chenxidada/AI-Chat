# ============================================
# Knowledge Base Web - Production Dockerfile
# ============================================

# Stage 1: 依赖安装
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# 复制 package 文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# 安装依赖
RUN pnpm install --frozen-lockfile

# Stage 2: 构建
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.1.0 --activate

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# 复制源代码
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# 创建 public 目录（如果不存在）
RUN mkdir -p /app/apps/web/public

# 构建 shared 包
WORKDIR /app/packages/shared
RUN pnpm run build

# 设置构建时环境变量
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 构建 Web
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build

# Stage 3: 生产镜像
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 设置工作目录
WORKDIR /app/apps/web

# 复制 node_modules 和构建产物
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ../../node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/package.json ./package.json

USER nextjs

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000 || exit 1

EXPOSE 3000

CMD ["npx", "next", "start"]
