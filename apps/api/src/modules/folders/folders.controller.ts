import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { ReorderFoldersDto } from './dto/reorder-folders.dto';

@ApiTags('文件夹')
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  @ApiOperation({ summary: '获取文件夹树形结构' })
  @ApiResponse({ status: 200, description: '返回完整文件夹树' })
  getTree() {
    return this.foldersService.getTree();
  }

  // 注意：/reorder 路由必须放在 /:id 之前，防止被 UUID 路由拦截
  @Patch('reorder')
  @ApiOperation({ summary: '批量更新文件夹排序' })
  @ApiResponse({ status: 200, description: '排序更新成功' })
  reorder(@Body() dto: ReorderFoldersDto) {
    return this.foldersService.reorder(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单个文件夹详情' })
  @ApiParam({ name: 'id', description: '文件夹 ID (UUID)' })
  @ApiResponse({ status: 200, description: '返回文件夹详情' })
  @ApiResponse({ status: 404, description: '文件夹不存在' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.foldersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建文件夹' })
  @ApiResponse({ status: 201, description: '文件夹创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误或同名/超深度限制' })
  @ApiResponse({ status: 404, description: '父文件夹不存在' })
  create(@Body() dto: CreateFolderDto) {
    return this.foldersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新文件夹' })
  @ApiParam({ name: 'id', description: '文件夹 ID (UUID)' })
  @ApiResponse({ status: 200, description: '文件夹更新成功' })
  @ApiResponse({ status: 400, description: '请求参数错误或循环引用/超深度限制' })
  @ApiResponse({ status: 404, description: '文件夹不存在' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文件夹（级联删除子文件夹，文档解除关联）' })
  @ApiParam({ name: 'id', description: '文件夹 ID (UUID)' })
  @ApiResponse({ status: 200, description: '文件夹删除成功' })
  @ApiResponse({ status: 404, description: '文件夹不存在' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.foldersService.remove(id);
  }

  @Patch(':id/pin')
  @ApiOperation({ summary: '切换文件夹置顶状态' })
  @ApiParam({ name: 'id', description: '文件夹 ID (UUID)' })
  @ApiResponse({ status: 200, description: '置顶状态已切换' })
  @ApiResponse({ status: 404, description: '文件夹不存在' })
  togglePin(@Param('id', ParseUUIDPipe) id: string) {
    return this.foldersService.togglePin(id);
  }
}
