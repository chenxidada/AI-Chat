export default () => ({
  // 应用配置
  port: parseInt(process.env.API_PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // 数据库
  database: {
    url: process.env.DATABASE_URL,
  },

  // Meilisearch
  meilisearch: {
    host: process.env.MEILI_HOST || 'http://localhost:7700',
    apiKey: process.env.MEILI_API_KEY,
  },

  // AI 配置
  ai: {
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL || 'https://api.deepseek.com/v1',
    chatModel: process.env.AI_CHAT_MODEL || 'deepseek-chat',
    embeddingModel: process.env.AI_EMBEDDING_MODEL || 'text-embedding-3-small',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  },
});
