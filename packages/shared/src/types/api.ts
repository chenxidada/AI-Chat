import type {
  Document,
  DocumentWithRelations,
  Folder,
  FolderTree,
  Tag,
  Conversation,
  Message,
} from './entities';

// ============================================
// 通用响应
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  error?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================
// 健康检查
// ============================================
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime?: number;
  services?: {
    api: { status: string };
    database: { status: string; pgvector?: string };
    meilisearch: { status: string; message?: string };
  };
}

// ============================================
// 文档 API
// ============================================
export interface CreateDocumentRequest {
  title: string;
  content?: string;
  folderId?: string;
  tagIds?: string[];
  sourceType?: 'manual' | 'import' | 'clip';
  sourceUrl?: string;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  folderId?: string | null;
  tagIds?: string[];
  isArchived?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DocumentListParams {
  page?: number;
  pageSize?: number;
  folderId?: string;
  tagId?: string;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  isArchived?: boolean;
}

export type DocumentListResponse = PaginatedResponse<DocumentWithRelations>;

// ============================================
// 文件夹 API
// ============================================
export interface CreateFolderRequest {
  name: string;
  parentId?: string;
}

export interface UpdateFolderRequest {
  name?: string;
  parentId?: string | null;
  sortOrder?: number;
}

export type FolderTreeResponse = FolderTree[];

// ============================================
// 标签 API
// ============================================
export interface CreateTagRequest {
  name: string;
  color?: string;
}

export interface UpdateTagRequest {
  name?: string;
  color?: string;
}

// ============================================
// 搜索 API
// ============================================
export interface SearchRequest {
  query: string;
  mode?: 'keyword' | 'semantic' | 'hybrid';
  filters?: {
    folderId?: string;
    tagIds?: string[];
    dateRange?: {
      start?: string;
      end?: string;
    };
  };
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  document: Document;
  score: number;
  highlights?: {
    title?: string;
    content?: string;
  };
}

export type SearchResponse = PaginatedResponse<SearchResult>;

// ============================================
// 对话 API
// ============================================
export interface CreateConversationRequest {
  title?: string;
  mode?: 'general' | 'knowledge_base';
}

export interface UpdateConversationRequest {
  title?: string;
  isArchived?: boolean;
}

// ChatRequest 已移至 ai.ts

export interface ChatStreamEvent {
  type: 'sources' | 'content' | 'done' | 'error';
  data: unknown;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
