import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateTemplateDto {
  @ApiProperty({ description: '模板名称', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '模板内容（Markdown）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '模板分类', default: 'general' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '模板图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '是否公开', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ description: '模板名称', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: '模板描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '模板内容（Markdown）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '模板分类' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '模板图标' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ description: '是否公开' })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class QueryTemplateDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: '分类筛选' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UseTemplateDto {
  @ApiProperty({ description: '新文档标题' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: '目标文件夹ID' })
  @IsOptional()
  @IsString()
  folderId?: string;
}
