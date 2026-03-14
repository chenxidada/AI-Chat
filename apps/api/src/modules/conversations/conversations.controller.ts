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
import { BatchOperationDto } from './dto/batch-operation.dto';
import { SearchConversationDto } from './dto/search.dto';

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

  @Patch(':id/pin')
  @ApiOperation({ summary: '切换对话置顶状态' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '置顶状态已切换' })
  togglePin(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.togglePin(id);
  }

  @Patch(':id/star')
  @ApiOperation({ summary: '切换对话星标状态' })
  @ApiParam({ name: 'id', description: '对话 ID (UUID)' })
  @ApiResponse({ status: 200, description: '星标状态已切换' })
  toggleStar(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationsService.toggleStar(id);
  }

  @Post('batch')
  @ApiOperation({ summary: '批量操作对话' })
  @ApiResponse({ status: 200, description: '批量操作成功' })
  batchOperation(@Body() dto: BatchOperationDto) {
    return this.conversationsService.batchOperation(dto);
  }

  @Get('search/list')
  @ApiOperation({ summary: '搜索对话' })
  @ApiResponse({ status: 200, description: '搜索结果' })
  search(@Query() dto: SearchConversationDto) {
    return this.conversationsService.search(dto);
  }
}
