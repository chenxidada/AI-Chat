import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
}

export interface DocumentChunkData {
  chunkIndex: number;
  chunkText: string;
  heading: string | null;
  tokenCount: number;
  contentHash: string;
}

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  private readonly defaultOptions: Required<ChunkOptions> = {
    chunkSize: 500,
    chunkOverlap: 100,
    minChunkSize: 100,
  };

  /**
   * 将文档内容分块
   */
  chunkDocument(content: string, options?: ChunkOptions): DocumentChunkData[] {
    const opts = { ...this.defaultOptions, ...options };
    const chunks: DocumentChunkData[] = [];

    // 1. 按标题分割（Markdown 标题）
    const sections = this.splitByHeadings(content);

    // 2. 对每个部分进行分块
    let chunkIndex = 0;
    for (const section of sections) {
      const sectionChunks = this.chunkSection(section, opts);

      for (const chunk of sectionChunks) {
        chunks.push({
          chunkIndex: chunkIndex++,
          chunkText: chunk.text,
          heading: section.heading,
          tokenCount: this.estimateTokens(chunk.text),
          contentHash: this.hashContent(chunk.text),
        });
      }
    }

    this.logger.log(`Document chunked into ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * 按标题分割文档
   */
  private splitByHeadings(
    content: string,
  ): Array<{ heading: string | null; content: string }> {
    const sections: Array<{ heading: string | null; content: string }> = [];

    // 匹配 Markdown 标题 (# ## ### 等)
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const matches = [...content.matchAll(headingRegex)];

    if (matches.length === 0) {
      // 没有标题，整体作为一个部分
      return [{ heading: null, content }];
    }

    // 第一个标题之前的内容
    if (matches[0].index! > 0) {
      sections.push({
        heading: null,
        content: content.slice(0, matches[0].index).trim(),
      });
    }

    // 按标题分割
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const headingLevel = match[1].length;
      const headingText = match[2].trim();
      const startIndex = match.index! + match[0].length;
      const endIndex =
        i < matches.length - 1 ? matches[i + 1].index! : content.length;

      sections.push({
        heading: `${'#'.repeat(headingLevel)} ${headingText}`,
        content: content.slice(startIndex, endIndex).trim(),
      });
    }

    return sections;
  }

  /**
   * 对一个部分进行分块
   */
  private chunkSection(
    section: { heading: string | null; content: string },
    opts: Required<ChunkOptions>,
  ): Array<{ text: string }> {
    const chunks: Array<{ text: string }> = [];
    const text = section.heading
      ? `${section.heading}\n\n${section.content}`
      : section.content;

    if (text.length <= opts.chunkSize) {
      return [{ text }];
    }

    // 按段落分割
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // 如果单个段落超过块大小，需要进一步分割
      if (paragraph.length > opts.chunkSize) {
        // 先保存当前块
        if (currentChunk.length >= opts.minChunkSize) {
          chunks.push({ text: currentChunk.trim() });
          currentChunk = '';
        }

        // 按行分割大段落
        const lines = paragraph.split('\n');
        for (const line of lines) {
          if (currentChunk.length + line.length + 1 <= opts.chunkSize) {
            currentChunk += (currentChunk ? '\n' : '') + line;
          } else {
            if (currentChunk.length >= opts.minChunkSize) {
              chunks.push({ text: currentChunk.trim() });
            }
            currentChunk = line;
          }
        }
      } else {
        // 检查是否需要开始新块
        if (currentChunk.length + paragraph.length + 2 > opts.chunkSize) {
          if (currentChunk.length >= opts.minChunkSize) {
            chunks.push({ text: currentChunk.trim() });
            // 保留重叠部分
            currentChunk =
              this.getOverlap(currentChunk, opts.chunkOverlap) +
              '\n\n' +
              paragraph;
          } else {
            currentChunk += '\n\n' + paragraph;
          }
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        }
      }
    }

    // 保存最后一块
    if (currentChunk.trim().length >= opts.minChunkSize) {
      chunks.push({ text: currentChunk.trim() });
    }

    return chunks;
  }

  /**
   * 获取文本末尾的重叠部分
   */
  private getOverlap(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) return text;

    // 尝试在句子边界截断
    const lastPeriod = text.lastIndexOf('。', overlapSize);
    const lastNewline = text.lastIndexOf('\n', overlapSize);
    const cutPoint = Math.max(lastPeriod, lastNewline);

    if (cutPoint > 0) {
      return text.slice(cutPoint + 1).trim();
    }

    return text.slice(-overlapSize);
  }

  /**
   * 估算 token 数量
   */
  private estimateTokens(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }

  /**
   * 计算内容哈希
   */
  private hashContent(text: string): string {
    return createHash('md5').update(text).digest('hex');
  }
}
