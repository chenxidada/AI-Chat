import { Suspense } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface ServiceStatus {
  status: string;
  message?: string;
  database?: string;
  pgvector?: string;
}

interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp?: string;
  services?: {
    api: ServiceStatus;
    database: ServiceStatus;
    meilisearch: ServiceStatus;
  };
  error?: string;
}

async function getApiStatus(): Promise<HealthResponse> {
  try {
    const res = await fetch(`${API_URL}/v1/health/services`, {
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('API not available');
    const data = await res.json();
    return data.data || data;
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ok: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    unknown: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.unknown}`}
    >
      {status}
    </span>
  );
}

async function ServiceStatus() {
  const data = await getApiStatus();

  if (data.status === 'error' && data.error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400 font-medium">无法连接到 API 服务</p>
        <p className="text-sm text-red-500 dark:text-red-400/80 mt-1">{data.error}</p>
        <p className="text-xs text-red-400 dark:text-red-500 mt-2">
          请确保后端服务已启动：pnpm dev:api
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="font-medium text-gray-900 dark:text-gray-100">整体状态</span>
        <StatusBadge status={data.status} />
      </div>
      {data.services &&
        Object.entries(data.services).map(([name, service]) => (
          <div
            key={name}
            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
          >
            <div>
              <span className="capitalize text-gray-900 dark:text-gray-100">{name}</span>
              {service.message && (
                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                  ({service.message})
                </span>
              )}
            </div>
            <StatusBadge status={service.status} />
          </div>
        ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse h-12 bg-gray-100 dark:bg-gray-800 rounded-lg" />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          {/* Logo & Title */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-4">📚</div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Knowledge Base
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">AI 驱动的个人知识库</p>
          </div>

          {/* Service Status */}
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">服务状态</h2>
            <Suspense fallback={<LoadingSkeleton />}>
              <ServiceStatus />
            </Suspense>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 gap-4">
            <a
              href={`${API_URL}/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="text-2xl mb-2">📖</div>
              <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                API 文档
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Swagger UI</div>
            </a>
            <a
              href="http://localhost:7700"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group"
            >
              <div className="text-2xl mb-2">🔍</div>
              <div className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Meilisearch
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">搜索引擎控制台</div>
            </a>
          </div>

          {/* Getting Started */}
          <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">快速开始</h3>
            <ol className="text-sm text-blue-800 dark:text-blue-300/90 space-y-2 list-decimal list-inside">
              <li>
                启动 Docker 服务：<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">pnpm docker:up</code>
              </li>
              <li>
                运行数据库迁移：<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">pnpm db:migrate</code>
              </li>
              <li>
                启动开发服务器：<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">pnpm dev</code>
              </li>
              <li>
                运行验证脚本：<code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">pnpm verify</code>
              </li>
            </ol>
          </div>

          {/* Version Info */}
          <div className="text-center mt-12 text-sm text-gray-400 dark:text-gray-600">
            Phase 0 - 基础设施层 | v0.1.0
          </div>
        </div>
      </div>
    </main>
  );
}
