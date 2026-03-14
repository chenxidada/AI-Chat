import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  QueryTemplateDto,
  UseTemplateDto,
} from './dto/template.dto';

@ApiTags('文档模板')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post()
  @ApiOperation({ summary: '创建模板' })
  @ApiResponse({ status: 201, description: '创建成功' })
  create(@Body() dto: CreateTemplateDto) {
    return this.templatesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: '获取模板列表' })
  @ApiResponse({ status: 200, description: '模板列表' })
  findAll(@Query() query: QueryTemplateDto) {
    return this.templatesService.findAll(query);
  }

  @Get('categories')
  @ApiOperation({ summary: '获取模板分类列表' })
  @ApiResponse({ status: 200, description: '分类列表' })
  getCategories() {
    return this.templatesService.getCategories();
  }

  @Get('popular')
  @ApiOperation({ summary: '获取热门模板' })
  @ApiResponse({ status: 200, description: '热门模板列表' })
  getPopular(@Query('limit') limit: number = 10) {
    return this.templatesService.getPopular(limit);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取模板详情' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 200, description: '模板详情' })
  @ApiResponse({ status: 404, description: '模板不存在' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新模板' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 200, description: '更新成功' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除模板' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.remove(id);
  }

  @Post(':id/use')
  @ApiOperation({ summary: '使用模板创建文档' })
  @ApiParam({ name: 'id', description: '模板 ID' })
  @ApiResponse({ status: 201, description: '文档创建成功' })
  useTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UseTemplateDto,
  ) {
    return this.templatesService.useTemplate(id, dto);
  }
}
