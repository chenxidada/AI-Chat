import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionResponse {
  content: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
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
   * 发送聊天请求
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<ChatCompletionResponse> {
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
          max_tokens: options?.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`LLM API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      this.logger.log(
        `LLM response in ${processingTime}ms, tokens: ${data.usage?.total_tokens}`,
      );

      return {
        content: data.choices[0].message.content,
        tokenUsage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        model: data.model || this.model,
      };
    } catch (error) {
      this.logger.error(`LLM request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成对话标题
   */
  async generateTitle(firstMessage: string): Promise<string> {
    const response = await this.chat(
      [
        {
          role: 'system',
          content:
            '请用简短的一句话（不超过20个字）概括以下对话的主题，直接输出标题，不要加引号或其他符号。',
        },
        {
          role: 'user',
          content: firstMessage,
        },
      ],
      { temperature: 0.3, maxTokens: 50 },
    );

    return response.content.trim().slice(0, 50);
  }
}
