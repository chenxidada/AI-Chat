// ============================================
// 基础类型
// ============================================
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 文件夹
// ============================================
export interface Folder extends Omit<BaseEntity, 'updatedAt'> {
  name: string;
  parentId: string | null;
  sortOrder: number;
  updatedAt: Date;
}

export interface FolderTree extends Folder {
  children: FolderTree[];
  documentCount?: number;
}

// ============================================
// 文档
// ============================================
export interface Document extends BaseEntity {
  folderId: string | null;
  title: string;
  content: string;
  contentPlain: string;
  sourceType: DocumentSourceType;
  sourceUrl: string | null;
  wordCount: number;
  isArchived: boolean;
  metadata: DocumentMetadata;
}

export type DocumentSourceType = 'manual' | 'import' | 'clip';

export interface DocumentMetadata {
  author?: string;
  description?: string;
  coverImage?: string;
  [key: string]: unknown;
}

export interface DocumentWithRelations extends Document {
  folder: Folder | null;
  tags: Tag[];
}

// ============================================
// 标签
// ============================================
export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
}

// ============================================
// 对话
// ============================================
export interface Conversation extends BaseEntity {
  title: string;
  mode: ConversationMode;
  isArchived: boolean;
}

export type ConversationMode = 'general' | 'knowledge_base';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  tokenUsage: TokenUsage | null;
  model: string | null;
  createdAt: Date;
}

export type MessageRole = 'user' | 'assistant' | 'system';

export interface Citation {
  documentId: string;
  chunkId?: string;
  title: string;
  snippet: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

// ============================================
// 系统设置
// ============================================
export interface SystemSettings {
  id: string;
  settings: AppSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  aiConfig?: AIConfig;
}

export interface AIConfig {
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  chatModel?: string;
  embeddingModel?: string;
}
