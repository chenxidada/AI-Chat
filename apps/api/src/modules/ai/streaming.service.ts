import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface StreamEvent {
  type: 'start' | 'chunk' | 'citations' | 'done' | 'error' | 'conversation';
  data: any;
}

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl =
      this.config.get<string>('AI_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.apiKey = this.config.get<string>('AI_API_KEY') || '';
    this.model = this.config.get<string>('AI_CHAT_MODEL') || 'deepseek-chat';
  }

  /**
   * 流式聊天
   */
  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    options?: { temperature?: number },
  ): AsyncGenerator<StreamEvent> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: options?.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Stream API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 发送开始事件
      yield { type: 'start', data: { timestamp: startTime } };

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let totalContent = '';
      let tokenCount = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            if (data === '[DONE]') {
              continue;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                totalContent += content;
                tokenCount++;
                yield { type: 'chunk', data: { content } };
              }

              // 捕获 usage 信息
              if (parsed.usage) {
                tokenCount = parsed.usage.total_tokens;
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }

      // 发送完成事件
      const processingTime = Date.now() - startTime;
      yield {
        type: 'done',
        data: {
          content: totalContent,
          tokenUsage: { totalTokens: tokenCount },
          processingTime,
        },
      };

      this.logger.log(
        `Stream completed in ${processingTime}ms, tokens: ${tokenCount}`,
      );
    } catch (error) {
      this.logger.error(`Stream error: ${error.message}`);
      yield { type: 'error', data: { message: error.message } };
    }
  }
}
