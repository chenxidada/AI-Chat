import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

@ApiTags('AI 对话')
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  @ApiOperation({ summary: '发送消息并获取 AI 回复' })
  @ApiResponse({ status: 201, description: 'AI 回复成功' })
  async chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }
}
