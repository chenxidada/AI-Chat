#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."

# 等待 PostgreSQL (使用 localhost 因为 host 网络模式)
max_retries=30
retry_count=0
while [ $retry_count -lt $max_retries ]; do
  if nc -z localhost 5432 2>/dev/null; then
    echo "PostgreSQL is up!"
    break
  fi
  retry_count=$((retry_count + 1))
  echo "PostgreSQL is unavailable - sleeping ($retry_count/$max_retries)"
  sleep 2
done

if [ $retry_count -eq $max_retries ]; then
  echo "Failed to connect to PostgreSQL after $max_retries retries"
  exit 1
fi

# 等待 Redis
echo "Waiting for Redis to be ready..."
retry_count=0
while [ $retry_count -lt $max_retries ]; do
  if nc -z localhost 6379 2>/dev/null; then
    echo "Redis is up!"
    break
  fi
  retry_count=$((retry_count + 1))
  echo "Redis is unavailable - sleeping ($retry_count/$max_retries)"
  sleep 2
done

# 等待 Meilisearch (使用 wget -q -O- 而不是 --spider)
echo "Waiting for Meilisearch to be ready..."
retry_count=0
while [ $retry_count -lt $max_retries ]; do
  if wget -q -O- http://localhost:7700/health 2>/dev/null | grep -q "available"; then
    echo "Meilisearch is up!"
    break
  fi
  retry_count=$((retry_count + 1))
  echo "Meilisearch is unavailable - sleeping ($retry_count/$max_retries)"
  sleep 2
done

# 运行数据库迁移
echo "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate

echo "Starting API server..."
exec node dist/main.js
