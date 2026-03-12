## 🤖 Assistant

# **Phase 2: AI 对话与引用 - 详细执行 Spec**

## 📋 **文档信息**
| 项目 | 说明 |
|------|------|
| **文档版本** | v1.0 |
| **适用阶段** | Phase 2 |
| **预估工期** | 8-12 周 |
| **前置条件** | Phase 1 完成，文档管理功能可用 |
| **技术栈** | Next.js + NestJS + PostgreSQL + pgvector + DeepSeek/OpenAI |

---

## 🎯 **1. 总体目标**

### **1.1 核心价值**
将静态知识库升级为 **智能对话伙伴**，实现：
- 🤖 **基于知识的AI问答**：AI能理解并回答基于个人知识库的问题
- 🔗 **可信的引用溯源**：每个回答都有明确的文档来源
- 💬 **自然的多轮对话**：结合上下文的深度交流
- 🎛️ **灵活的范围控制**：可限定对话的知识范围

### **1.2 成功标准**
```
✅ 功能层面：
  1. 用户能用自然语言查询知识库
  2. AI回答准确并显示引用来源
  3. 能保存和回顾对话历史
  4. 可切换通用模式和知识库模式

✅ 技术层面：
  1. RAG（检索增强生成）流程完整
  2. 向量检索性能满足要求（<1秒）
  3. 流式输出支持良好体验
  4. 错误处理和降级策略完备
```

---

## 📊 **2. 阶段分解**

### **阶段 2.1: 基础架构搭建 (2周)**
**目标**：搭建数据库和核心服务框架

| 模块 | 任务 | 优先级 | 预估时间 |
|------|------|--------|----------|
| **数据库扩展** | 1. 创建 document_chunks 表<br>2. 添加向量索引<br>3. 扩展 conversations/messages 表 | P0 | 3天 |
| **向量化服务** | 1. 文档分块策略实现<br>2. 批量向量化流水线<br>3. 增量更新机制 | P0 | 4天 |
| **AI服务基础** | 1. AI服务接口定义<br>2. DeepSeek/OpenAI集成<br>3. 基础问答接口 | P1 | 3天 |

### **阶段 2.2: RAG 核心实现 (3周)**
**目标**：实现完整的检索增强生成流程

| 模块 | 任务 | 优先级 | 预估时间 |
|------|------|--------|----------|
| **向量检索** | 1. pgvector相似度搜索<br>2. 相关性排序算法<br>3. 过滤器支持 | P0 | 5天 |
| **RAG引擎** | 1. 提示词工程<br>2. 上下文构建<br>3. 引用提取算法 | P0 | 5天 |
| **对话管理** | 1. 对话CRUD服务<br>2. 上下文管理<br>3. 自动标题生成 | P1 | 3天 |

### **阶段 2.3: 前端界面开发 (3周)**
**目标**：构建用户友好的对话界面

| 模块 | 任务 | 优先级 | 预估时间 |
|------|------|--------|----------|
| **聊天界面** | 1. 聊天式UI组件<br>2. 消息气泡组件<br>3. 输入交互 | P0 | 6天 |
| **引用系统** | 1. 引用标记组件<br>2. 悬停预览<br>3. 原文跳转 | P0 | 4天 |
| **对话管理UI** | 1. 对话列表页面<br>2. 搜索过滤<br>3. 批量操作 | P1 | 3天 |

### **阶段 2.4: 高级功能与优化 (2周)**
**目标**：提升体验和性能

| 模块 | 任务 | 优先级 | 预估时间 |
|------|------|--------|----------|
| **流式输出** | 1. SSE流式接口<br>2. 打字机效果<br>3. 中断恢复 | P1 | 4天 |
| **性能优化** | 1. 向量检索优化<br>2. 缓存策略<br>3. 并发控制 | P1 | 3天 |
| **体验优化** | 1. 上下文选择器<br>2. 对话模板<br>3. 导出功能 | P2 | 3天 |

---

## 🗄️ **3. 数据库扩展详细设计**

### **3.1 新增表结构**

```sql
-- document_chunks 表（核心向量存储）
CREATE TABLE document_chunks (
    id VARCHAR(32) PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id VARCHAR(32) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    heading VARCHAR(500),
    token_count INTEGER DEFAULT 0,
    embedding VECTOR(1536),  -- OpenAI embedding-3-small 维度
    content_hash VARCHAR(64),  -- 用于去重
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_chunk_per_doc UNIQUE(document_id, chunk_index)
);

-- 创建向量索引
CREATE INDEX idx_document_chunks_embedding ON document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 添加索引
CREATE INDEX idx_document_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_created ON document_chunks(created_at DESC);
```

### **3.2 现有表扩展**

```sql
-- conversations 表扩展
ALTER TABLE conversations 
ADD COLUMN mode VARCHAR(20) DEFAULT 'general',
ADD COLUMN context_document_ids VARCHAR(32)[] DEFAULT '{}',
ADD COLUMN context_filter JSONB DEFAULT '{}',
ADD COLUMN model_used VARCHAR(100),
ADD COLUMN total_tokens INTEGER DEFAULT 0;

-- messages 表扩展  
ALTER TABLE messages
ADD COLUMN citations JSONB DEFAULT '[]',
ADD COLUMN token_usage JSONB,
ADD COLUMN model VARCHAR(100);
```

### **3.3 Prisma Schema 更新**

```prisma
// apps/api/prisma/schema.prisma 添加
model DocumentChunk {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  documentId  String   @map("document_id") @db.Uuid
  chunkIndex  Int      @map("chunk_index")
  chunkText   String   @map("chunk_text") @db.Text
  heading     String?  @db.VarChar(500)
  tokenCount  Int      @default(0) @map("token_count")
  embedding   Unsupported("vector(1536)")?
  contentHash String   @map("content_hash") @db.VarChar(64)
  createdAt   DateTime @default(now()) @map("created_at")

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)

  @@unique([documentId, chunkIndex])
  @@index([documentId])
  @@index([createdAt])
  @@map("document_chunks")
}

// 更新 Conversation 和 Message 模型
model Conversation {
  // ... 原有字段
  mode              String   @default("general") @db.VarChar(20)
  contextDocumentIds String[] @map("context_document_ids") @db.Uuid
  contextFilter     Json?    @map("context_filter")
  modelUsed         String?  @map("model_used") @db.VarChar(100)
  totalTokens       Int      @default(0) @map("total_tokens")
  
  @@map("conversations")
}

model Message {
  // ... 原有字段
  citations   Json    @default("[]")
  tokenUsage  Json?   @map("token_usage")
  model       String? @db.VarChar(100)
  
  @@map("messages")
}
```

---

## 🔧 **4. 后端服务详细设计**

### **4.1 模块结构**

```
apps/api/src/modules/
├── ai/
│   ├── ai.module.ts
│   ├── ai.controller.ts          # API入口
│   ├── ai.service.ts             # 主要业务逻辑
│   ├── rag.service.ts            # RAG引擎
│   ├── embedding.service.ts      # 向量化服务
│   ├── conversation.service.ts   # 对话逻辑
│   └── dto/
│       ├── ask-question.dto.ts
│       ├── create-conversation.dto.ts
│       └── streaming.dto.ts
├── vector-search/                # 新模块
│   ├── vector-search.module.ts
│   ├── vector-search.service.ts  # 向量检索
│   └── dto/search-query.dto.ts
└── conversations/                # Phase 1已有，需要扩展
    └── ...                       # 添加AI相关逻辑
```

### **4.2 核心服务实现**

#### **EmbeddingService（向量化服务）**
```typescript
// apps/api/src/modules/ai/embedding.service.ts
@Injectable()
export class EmbeddingService {
  private readonly embeddingModel = 'text-embedding-3-small';
  
  constructor(
    private config: ConfigService,
    private httpService: HttpService,
    private cacheManager: Cache,
  ) {}
  
  async embedText(text: string): Promise<number[]> {
    const cacheKey = `embedding:${this.hashText(text)}`;
    const cached = await this.cacheManager.get<number[]>(cacheKey);
    
    if (cached) return cached;
    
    // 调用 OpenAI 兼容 API
    const response = await this.httpService.axiosRef.post(
      `${this.config.get('AI_BASE_URL')}/embeddings`,
      {
        model: this.embeddingModel,
        input: text,
      },
      {
        headers: { Authorization: `Bearer ${this.config.get('AI_API_KEY')}` },
      }
    );
    
    const embedding = response.data.data[0].embedding;
    
    // 缓存 7 天
    await this.cacheManager.set(cacheKey, embedding, 60 * 60 * 24 * 7);
    
    return embedding;
  }
  
  async embedBatch(texts: string[]): Promise<number[][]> {
    // 批量处理，提高效率
  }
  
  private hashText(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }
}
```

#### **RAGService（核心RAG引擎）**
```typescript
// apps/api/src/modules/ai/rag.service.ts
@Injectable()
export class RagService {
  private readonly promptTemplates = {
    knowledgeBase: `
你是一个专业的个人知识库助手。请基于以下参考资料回答问题。

参考资料：
{context}

用户问题：{question}

回答要求：
1. 严格基于提供的参考资料，不要编造信息
2. 在回答中引用资料来源，使用格式 [1]、[2] 对应参考资料编号
3. 如果资料中没有相关信息，请说明"根据提供的资料，没有找到相关信息"
4. 保持回答简洁专业

请开始回答：`.trim(),
    
    general: `你是一个乐于助人的AI助手。请回答用户问题：{question}`,
  };
  
  async generateAnswer(params: RagParams): Promise<RagResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 检索相关文档块
      const relevantChunks = await this.retrieveRelevantChunks(params);
      
      // 2. 构建提示词
      const prompt = this.buildPrompt(params.question, relevantChunks, params.mode);
      
      // 3. 调用AI生成回答
      const aiResponse = await this.callAI({
        prompt,
        temperature: params.temperature || 0.7,
        stream: params.stream,
      });
      
      // 4. 提取引用
      const citations = this.extractCitations(aiResponse.content, relevantChunks);
      
      // 5. 记录性能指标
      const processingTime = Date.now() - startTime;
      
      return {
        answer: aiResponse.content,
        citations,
        relevantChunks: relevantChunks.slice(0, 5),
        tokenUsage: aiResponse.tokenUsage,
        processingTime,
      };
      
    } catch (error) {
      // 降级策略：返回相关文档列表
      return await this.fallbackResponse(params);
    }
  }
  
  private async retrieveRelevantChunks(params: RagParams): Promise<DocumentChunk[]> {
    // 向量检索逻辑
    const questionEmbedding = await this.embeddingService.embedText(params.question);
    
    return this.vectorSearchService.search({
      queryEmbedding: questionEmbedding,
      limit: 8,
      filters: params.context?.filters,
      threshold: 0.7, // 相似度阈值
    });
  }
}
```

#### **VectorSearchService（向量检索）**
```typescript
// apps/api/src/modules/vector-search/vector-search.service.ts
@Injectable()
export class VectorSearchService {
  async search(params: VectorSearchParams): Promise<DocumentChunkWithSimilarity[]> {
    const { queryEmbedding, limit = 10, filters, threshold = 0.7 } = params;
    
    // 构建动态WHERE条件
    const whereConditions: string[] = ['1=1'];
    const queryParams: any[] = [queryEmbedding, limit, threshold];
    
    if (filters?.documentIds?.length) {
      const placeholders = filters.documentIds.map((_, i) => `$${i + 4}`).join(',');
      whereConditions.push(`d.id IN (${placeholders})`);
      queryParams.push(...filters.documentIds);
    }
    
    if (filters?.folderId) {
      whereConditions.push(`d.folder_id = $${queryParams.length + 1}`);
      queryParams.push(filters.folderId);
    }
    
    // 使用pgvector的余弦相似度
    const sql = `
      SELECT 
        dc.*,
        1 - (dc.embedding <=> $1::vector) as similarity,
        d.title as document_title,
        d.folder_id as folder_id
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE ${whereConditions.join(' AND ')}
        AND d.is_archived = false
        AND 1 - (dc.embedding <=> $1::vector) > $3
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2
    `;
    
    return this.prisma.$queryRawUnsafe(sql, ...queryParams);
  }
}
```

### **4.3 API接口规范**

#### **4.3.1 对话管理 API**
```yaml
# GET /api/v1/conversations - 获取对话列表
参数:
  page: number (默认1)
  limit: number (默认20, 最大100)
  search: string (搜索标题)
  mode: 'general' | 'knowledge_base'
  isArchived: boolean

响应:
{
  "items": [
    {
      "id": "conv_123",
      "title": "关于知识管理的讨论",
      "mode": "knowledge_base",
      "messageCount": 5,
      "updatedAt": "2024-01-15T10:30:00Z",
      "totalTokens": 1200
    }
  ],
  "total": 45,
  "page": 1,
  "totalPages": 3
}

# POST /api/v1/conversations - 创建对话
请求:
{
  "title": "新对话", // 可选，不提供则AI自动生成
  "mode": "knowledge_base",
  "context": {
    "documentIds": ["doc_1", "doc_2"],
    "folderId": "folder_1",
    "tagIds": ["tag_1", "tag_2"]
  }
}

# GET /api/v1/conversations/:id - 获取对话详情
# DELETE /api/v1/conversations/:id - 删除对话
# PATCH /api/v1/conversations/:id - 更新对话
```

#### **4.3.2 AI问答 API**
```yaml
# POST /api/v1/ai/ask - 发送消息（非流式）
请求:
{
  "conversationId": "conv_123", // 可选，没有则创建新对话
  "question": "知识管理有哪些方法？",
  "mode": "knowledge_base",
  "context": {
    "documentIds": ["doc_1"],
    "folderId": "folder_1"
  },
  "temperature": 0.7
}

响应:
{
  "conversationId": "conv_123",
  "messageId": "msg_456",
  "answer": "根据你的知识库...",
  "citations": [
    {
      "id": "cite_1",
      "chunkId": "chunk_789",
      "documentId": "doc_1",
      "documentTitle": "知识管理指南",
      "excerpt": "知识管理可以分为...",
      "similarity": 0.92,
      "position": { "start": 10, "end": 25 }
    }
  ],
  "relevantDocuments": [
    {
      "id": "doc_1",
      "title": "知识管理指南",
      "similarity": 0.92,
      "excerpt": "知识管理可以分为..."
    }
  ],
  "tokenUsage": {
    "prompt": 450,
    "completion": 120,
    "total": 570
  }
}

# POST /api/v1/ai/ask/stream - 流式输出（SSE）
请求头:
Accept: text/event-stream

响应流:
event: message
data: {"type": "chunk", "content": "根据"}

event: message  
data: {"type": "chunk", "content": "你的"}

event: citations
data: {"citations": [...]}

event: done
data: {"messageId": "msg_456", "tokenUsage": {...}}
```

---

## 🎨 **5. 前端界面详细设计**

### **5.1 页面结构**
```
app/(main)/
├── conversations/              # 对话列表页
│   ├── page.tsx               # 列表页面
│   ├── [id]/                  # 对话详情页
│   │   └── page.tsx
│   └── new/                   # 新建对话
│       └── page.tsx
├── ai/                        # AI快速问答（单次对话）
│   └── page.tsx
└── layout.tsx                 # 主布局（包含AI侧边栏）
```

### **5.2 组件结构**
```
components/ai/
├── chat-interface/           # 聊天主界面
│   ├── chat-interface.tsx
│   ├── chat-messages.tsx
│   ├── user-message.tsx
│   ├── ai-message.tsx
│   └── chat-input.tsx
├── citations/               # 引用相关组件
│   ├── citation-badge.tsx   # 引用标记 [1][2]
│   ├── citation-popover.tsx # 悬停预览
│   ├── citation-sidebar.tsx # 引用侧边栏
│   └── citation-list.tsx
├── conversation-list/       # 对话列表组件
│   ├── conversation-list.tsx
│   ├── conversation-card.tsx
│   └── conversation-search.tsx
├── context-selector/        # 上下文选择器
│   ├── context-selector.tsx
│   ├── mode-toggle.tsx
│   ├── folder-selector.tsx
│   ├── tag-selector.tsx
│   └── document-picker.tsx
├── ai-sidebar/             # AI侧边栏
│   ├── ai-assistant.tsx    # AI建议
│   ├── relevant-docs.tsx   # 相关文档
│   └── token-usage.tsx     # Token使用统计
└── streaming/              # 流式输出相关
    ├── streaming-message.tsx
    └── typing-indicator.tsx
```

### **5.3 状态管理**
```typescript
// stores/ai-store.ts
interface AIStore {
  // 当前对话状态
  currentConversationId: string | null;
  currentMode: 'general' | 'knowledge_base';
  context: ConversationContext | null;
  
  // 消息状态
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  
  // UI状态
  isCitationSidebarOpen: boolean;
  activeCitationId: string | null;
  viewMode: 'chat' | 'split'; // 聊天模式或分屏模式
  
  // 操作
  actions: {
    sendMessage: (content: string) => Promise<void>;
    startNewConversation: (params?: NewConversationParams) => Promise<string>;
    switchMode: (mode: 'general' | 'knowledge_base') => void;
    updateContext: (context: ConversationContext) => void;
    archiveConversation: (conversationId: string) => Promise<void>;
    
    // 引用交互
    highlightCitation: (citationId: string) => void;
    openDocumentFromCitation: (citation: Citation) => void;
    copyCitationText: (citation: Citation) => void;
  };
}

// hooks/use-ai-chat.ts
export function useAIChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const sendMessage = async (content: string) => {
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/v1/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          conversationId: currentConversationId,
          question: content,
          mode: currentMode,
          context: currentContext,
        }),
      });
      
      const data = await response.json();
      
      setMessages(prev => [
        ...prev,
        { role: 'user', content },
        { 
          role: 'assistant', 
          content: data.answer,
          citations: data.citations,
          id: data.messageId,
        }
      ]);
      
    } catch (error) {
      // 错误处理
    } finally {
      setIsLoading(false);
    }
  };
  
  return { messages, sendMessage, isLoading, input, setInput };
}
```

### **5.4 关键组件实现**

#### **AIMessage 组件（含引用展示）**
```tsx
// components/ai/chat-interface/ai-message.tsx
interface AIMessageProps {
  content: string;
  citations?: Citation[];
  isLoading?: boolean;
  onCitationClick?: (citation: Citation) => void;
}

export function AIMessage({ content, citations = [], isLoading, onCitationClick }: AIMessageProps) {
  // 将内容中的引用标记 [1]、[2] 转换为可点击组件
  const renderContentWithCitations = () => {
    const parts = content.split(/(\[\d+\])/g);
    
    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const citationNumber = parseInt(match[1]);
        const citation = citations[citationNumber - 1];
        
        if (citation) {
          return (
            <CitationBadge
              key={index}
              number={citationNumber}
              onClick={() => onCitationClick?.(citation)}
              className="hover:bg-blue-100 cursor-pointer"
            />
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };
  
  return (
    <div className="flex gap-3 p-4 bg-gray-50 rounded-lg">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
        <Bot className="w-5 h-5 text-white" />
      </div>
      
      <div className="flex-1">
        <div className="prose prose-sm max-w-none">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-pulse">AI正在思考...</div>
              <TypingIndicator />
            </div>
          ) : (
            <>
              <div className="mb-3">{renderContentWithCitations()}</div>
              
              {citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">引用来源：</div>
                  <div className="flex flex-wrap gap-2">
                    {citations.map((citation, index) => (
                      <CitationBadge
                        key={citation.id}
                        number={index + 1}
                        onClick={() => onCitationClick?.(citation)}
                        size="sm"
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### **流式输出组件**
```tsx
// components/ai/streaming/streaming-message.tsx
export function StreamingMessage() {
  const [content, setContent] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    let mounted = true;
    
    const processStream = async () => {
      const response = await fetch('/api/v1/ai/ask/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(askParams),
      });
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) return;
      
      try {
        while (mounted) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'chunk':
                  if (mounted) {
                    setContent(prev => prev + data.content);
                  }
                  break;
                  
                case 'citations':
                  // 处理引用
                  break;
                  
                case 'done':
                  if (mounted) {
                    setIsComplete(true);
                  }
                  break;
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream error:', error);
      }
    };
    
    processStream();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  return (
    <AIMessage 
      content={content} 
      isLoading={!isComplete}
    />
  );
}
```

#### **上下文选择器**
```tsx
// components/ai/context-selector/context-selector.tsx
export function ContextSelector() {
  const { mode, context, updateContext, switchMode } = useAIStore();
  
  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-medium">对话模式</div>
        <ModeToggle
          value={mode}
          onChange={switchMode}
          options={[
            { value: 'general', label: '通用对话', icon: '🌐' },
            { value: 'knowledge_base', label: '知识库问答', icon: '📚' },
          ]}
        />
      </div>
      
      {mode === 'knowledge_base' && (
        <div className="space-y-4">
          <div className="text-sm font-medium">知识范围</div>
          
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="grid grid-cols-4">
              <TabsTrigger value="all">全部文档</TabsTrigger>
              <TabsTrigger value="folder">文件夹</TabsTrigger>
              <TabsTrigger value="tags">标签</TabsTrigger>
              <TabsTrigger value="documents">选择文档</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="py-2">
              <div className="text-sm text-gray-500">
                基于全部知识库内容进行回答
              </div>
            </TabsContent>
            
            <TabsContent value="folder" className="py-2">
              <FolderSelector
                selectedFolderId={context?.folderId}
                onChange={(folderId) => updateContext({ ...context, folderId })}
              />
            </TabsContent>
            
            <TabsContent value="tags" className="py-2">
              <TagSelector
                selectedTagIds={context?.tagIds || []}
                onChange={(tagIds) => updateContext({ ...context, tagIds })}
              />
            </TabsContent>
            
            <TabsContent value="documents" className="py-2">
              <DocumentPicker
                selectedDocumentIds={context?.documentIds || []}
                onChange={(documentIds) => updateContext({ ...context, documentIds })}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 **6. 测试方案**

### **6.1 单元测试**
```typescript
// 测试 RAG 服务
describe('RagService', () => {
  let service: RagService;
  
  beforeEach(() => {
    service = new RagService();
  });
  
  it('should extract citations from answer', () => {
    const answer = '知识管理有三种方法[1][2]。';
    const chunks = [
      { id: 'chunk1', chunkText: '第一种方法...' },
      { id: 'chunk2', chunkText: '第二种方法...' },
    ];
    
    const citations = service.extractCitations(answer, chunks);
    
    expect(citations).toHaveLength(2);
    expect(citations[0].chunkId).toBe('chunk1');
    expect(citations[1].chunkId).toBe('chunk2');
  });
  
  it('should fallback when AI fails', async () => {
    const params = { question: '测试问题', mode: 'knowledge_base' };
    
    // 模拟AI失败
    jest.spyOn(service, 'callAI').mockRejectedValue(new Error('AI服务失败'));
    
    const result = await service.generateAnswer(params);
    
    expect(result.fallback).toBe(true);
    expect(result.answer).toContain('相关文档');
  });
});
```

### **6.2 集成测试**
```typescript
describe('AI问答接口', () => {
  let app: INestApplication;
  
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    
    app = moduleRef.createNestApplication();
    await app.init();
  });
  
  it('POST /api/v1/ai/ask 应返回带引用的回答', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/ask')
      .send({
        question: '什么是知识管理？',
        mode: 'knowledge_base',
      });
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('answer');
    expect(response.body).toHaveProperty('citations');
    expect(response.body.citations).toBeInstanceOf(Array);
  });
  
  it('POST /api/v1/ai/ask/stream 应返回流式响应', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/ask/stream')
      .set('Accept', 'text/event-stream')
      .send({
        question: '测试流式输出',
        mode: 'general',
      });
    
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
  });
});
```

### **6.3 性能测试**
```bash
# 向量检索性能测试
ab -n 100 -c 10 -p test_question.json -T application/json http://localhost:4000/api/v1/ai/ask

# 流式输出延迟测试
node scripts/test-streaming-latency.js

# 内存使用测试
node --inspect scripts/test-memory-usage.js
```

---

## 🚀 **7. 部署与监控**

### **7.1 环境变量配置**
```bash
# .env.production
# AI配置
AI_API_KEY=sk-your-deepseek-api-key
AI_BASE_URL=https://api.deepseek.com/v1
AI_CHAT_MODEL=deepseek-chat
AI_EMBEDDING_MODEL=text-embedding-3-small

# 向量检索配置
VECTOR_SEARCH_LIMIT=8
SIMILARITY_THRESHOLD=0.7
ENABLE_CACHE=true
CACHE_TTL=604800  # 7天

# 性能配置
MAX_CONCURRENT_EMBEDDING=5
STREAMING_TIMEOUT=30000  # 30秒
```

### **7.2 监控指标**
```typescript
// 监控关键指标
interface AIMetrics {
  // 性能指标
  ragProcessingTime: Histogram;
  vectorSearchTime: Histogram;
  tokenUsage: Gauge;
  
  // 业务指标
  questionsAnswered: Counter;
  citationsGenerated: Counter;
  fallbackCount: Counter;  // 降级次数
  
  // 错误指标
  embeddingErrors: Counter;
  aiServiceErrors: Counter;
  timeoutErrors: Counter;
}

// 使用 Prometheus 或 OpenTelemetry 收集
const metrics = {
  rag_processing_time_seconds: new promClient.Histogram({
    name: 'rag_processing_time_seconds',
    help: 'RAG处理时间',
    buckets: [0.1, 0.5, 1, 2, 5],
  }),
  
  questions_total: new promClient.Counter({
    name: 'questions_total',
    help: '总提问数',
    labelNames: ['mode'],
  }),
};
```

### **7.3 健康检查端点**
```typescript
// GET /api/health/ai
@Get('ai')
async checkAIHealth() {
  const checks = {
    aiService: await this.checkAIService(),
    embeddingService: await this.checkEmbeddingService(),
    vectorSearch: await this.checkVectorSearch(),
    database: await this.checkDatabase(),
  };
  
  const allHealthy = Object.values(checks).every(c => c.healthy);
  
  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks,
  };
}
```

---

## 📋 **8. 验收标准清单**

### **功能验收**
- [ ] **基础对话**
 - [ ] 用户能发送消息并收到AI回复
 - [ ] 支持多轮对话（上下文保持）
 - [ ] 能创建新对话和切换对话

- [ ] **知识库问答**
 - [ ] AI能基于知识库内容回答问题
 - [ ] 回答中包含引用标记 [^1][^2]
 - [ ] 可点击引用标记查看原文

- [ ] **引用系统**
 - [ ] 引用信息准确（文档、位置、相似度）
 - [ ] 悬停预览引用内容
 - [ ] 点击引用跳转到原文

- [ ] **范围控制**
 - [ ] 可切换通用/知识库模式
 - [ ] 可限定回答范围（文件夹/标签/文档）
 - [ ] 范围选择器界面友好

- [ ] **对话管理**
 - [ ] 对话列表展示（标题、时间、消息数）
 - [ ] 搜索和过滤对话
 - [ ] 删除/归档对话

- [ ] **流式输出**
 - [ ] 打字机效果显示AI回答
 - [ ] 支持中断生成
 - [ ] 流式输出稳定不中断

### **性能验收**
- [ ] **响应时间**
 - [ ] 简单问题响应 < 3秒
 - [ ] 复杂RAG响应 < 10秒
 - [ ] 流式输出首字延迟 < 1秒

- [ ] **可靠性**
 - [ ] 99% 请求成功
 - [ ] AI服务失败时有降级策略
 - [ ] 大文档处理不超时

- [ ] **资源使用**
 - [ ] 内存使用稳定（无泄漏）
 - [ ] Token使用可监控
 - [ ] 向量索引不超预期大小

### **用户体验**
- [ ] **界面交互**
 - [ ] 聊天界面响应迅速
 - [ ] 移动端适配良好
 - [ ] 快捷键支持（Ctrl+Enter发送）

- [ ] **错误处理**
 - [ ] 网络错误有明确提示
 - [ ] AI服务失败有友好降级
 - [ ] 加载状态清晰

- [ ] **辅助功能**
 - [ ] 支持复制消息内容
 - [ ] 支持导出对话
 - [ ] 有使用指引

---

## 🔄 **9. 风险与缓解**

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **AI服务不稳定** | 问答功能不可用 | 中 | 1. 实现降级到搜索<br>2. 支持切换AI供应商<br>3. 本地模型后备 |
| **向量检索性能差** | 响应时间过长 | 中 | 1. 优化索引策略<br>2. 实现缓存<br>3. 分页检索 |
| **Token成本失控** | 费用超预期 | 高 | 1. 用量监控和告警<br>2. Token限制<br>3. 缓存策略 |
| **引用准确性低** | 用户体验差 | 中 | 1. 多策略引用提取<br>2. 人工校准机制<br>3. 可配置相似度阈值 |
| **大文档处理慢** | 系统卡顿 | 低 | 1. 异步处理<br>2. 进度提示<br>3. 分批处理 |

---

