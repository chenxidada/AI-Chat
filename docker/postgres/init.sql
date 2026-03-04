-- ============================================
-- Knowledge Base - PostgreSQL 初始化脚本
-- ============================================

-- 启用 pgvector 扩展（向量搜索）
CREATE EXTENSION IF NOT EXISTS vector;

-- 启用 uuid 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 验证扩展安装
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE EXCEPTION 'pgvector extension not installed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
    RAISE EXCEPTION 'uuid-ossp extension not installed';
  END IF;
END
$$;

-- 打印确认信息
SELECT 'Database initialized successfully' AS status,
       (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS pgvector_version;
