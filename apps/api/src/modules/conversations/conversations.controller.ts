import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';

@ApiTags('对话')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @ApiOperation({ summary: '创建新对话' })
  @ApiResponse({ status: 201, description: '对话创建成功' })
  create(@Body() dto: CreateConversationDto) {
    return this.conversationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取对话列表' })
  @ApiResponse({ status: 200, description: '对话列表' })
  findAll(@Query() query: QueryConversationDto) {
    return this.conversationsService.findAll({
      page: query.page,
      limit: query.limit,
      isArchived: query.isArchived === 'true',
      mode: query.mode,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取对话详情' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '对话详情' })
  @ApiResponse({ status: 404, description: '对话不存在' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新对话' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '对话更新成功' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除对话' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '对话已删除' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.remove(id);
  }
}
