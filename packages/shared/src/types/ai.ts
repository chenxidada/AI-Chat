// ============================================
// AI 相关类型
// ============================================

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  chunkText: string;
  heading: string | null;
  tokenCount: number;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmbeddingStatus {
  documentId: string;
  totalChunks: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// ============================================
// AI 配置
// ============================================

export interface AIProviderConfig {
  provider: 'bailian' | 'openai' | 'deepseek';
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embeddingModel: string;
}

// 阿里云百炼默认配置
export const BAILIAN_DEFAULT_CONFIG: Partial<AIProviderConfig> = {
  provider: 'bailian',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  chatModel: 'deepseek-chat',
  embeddingModel: 'text-embedding-v3',
};

// ============================================
// 对话扩展类型
// ============================================

export interface ConversationContext {
  documentIds?: string[];
  folderId?: string | null;
  tagIds?: string[];
}

export interface ConversationListItem {
  id: string;
  title: string;
  mode: string;
  isArchived: boolean;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
}

// ============================================
// AI 聊天 API 类型
// ============================================

export interface ChatRequest {
  question: string;
  conversationId?: string;
  mode?: 'general' | 'knowledge_base';
  temperature?: number;
}

export interface ChatResponse {
  conversationId: string;
  messageId: string;
  answer: string;
  citations: ChatCitation[];
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface ChatCitation {
  id: string;
  chunkId: string;
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
}

export interface ConversationListResponse {
  items: ConversationListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
