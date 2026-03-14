import { Controller, Post, Body, Sse, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('AI 对话')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: '发送消息并获取 AI 回复（非流式）' })
  @ApiResponse({ status: 201, description: 'AI 回复成功' })
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }

  @Sse('chat/stream')
  @ApiOperation({ summary: '发送消息并获取流式 AI 回复' })
  async chatStream(@Body() dto: ChatDto): Promise<Observable<MessageEvent>> {
    return this.aiService.chatStream(dto);
  }

  @Post('summarize/:id')
  @ApiOperation({ summary: '生成对话摘要' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '摘要生成成功' })
  async summarizeConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.summarizeConversation(id);
  }

  @Post('suggest/:id')
  @ApiOperation({ summary: '获取对话建议' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '建议获取成功' })
  async getSuggestions(@Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.getSuggestions(id);
  }
}
