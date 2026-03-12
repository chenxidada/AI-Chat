import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  // 内存缓存
  private readonly cache = new Map<string, { embedding: number[]; expiry: number }>();
  private readonly cacheTTL = 7 * 24 * 60 * 60 * 1000; // 7 天

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('AI_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.apiKey = this.config.get<string>('AI_API_KEY') || '';
    this.model =
      this.config.get<string>('AI_EMBEDDING_MODEL') || 'text-embedding-v3';
  }

  /**
   * 获取文本的向量表示
   */
  async embedText(text: string): Promise<EmbeddingResult> {
    const cacheKey = this.hashText(text);

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return {
        embedding: cached.embedding,
        tokenCount: this.estimateTokens(text),
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
          encoding_format: 'float',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Embedding API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;
      const tokenCount = data.usage?.total_tokens || this.estimateTokens(text);

      // 缓存结果
      this.cache.set(cacheKey, {
        embedding,
        expiry: Date.now() + this.cacheTTL,
      });

      return { embedding, tokenCount };
    } catch (error) {
      this.logger.error(`Embedding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 批量获取向量
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // 阿里云百炼支持批量请求，但限制每批最多 25 条
    const batchSize = 25;
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((text) => this.embedText(text)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * 估算 token 数量（粗略估计：中文约 1.5 字/token，英文约 4 字符/token）
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 计算文本哈希用于缓存
   */
  private hashText(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }

  /**
   * 清理过期缓存
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }
}
