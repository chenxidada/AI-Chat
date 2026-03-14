import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsIn, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryDocumentDto {
  @ApiPropertyOptional({ description: '页码（从 1 开始）', default: 1 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 20;

  @ApiPropertyOptional({ description: '按文件夹 ID 筛选' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional({ description: '按标签 ID 筛选' })
  @IsOptional()
  @IsUUID()
  tagId?: string;

  @ApiPropertyOptional({ description: '是否已归档', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  isArchived?: string;

  @ApiPropertyOptional({ description: '是否已收藏', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  isFavorite?: string;

  @ApiPropertyOptional({ description: '是否已置顶', enum: ['true', 'false'] })
  @IsOptional()
  @IsString()
  isPinned?: string;

  @ApiPropertyOptional({
    description: '排序字段',
    enum: ['updatedAt', 'createdAt', 'title', 'wordCount'],
    default: 'updatedAt',
  })
  @IsOptional()
  @IsIn(['updatedAt', 'createdAt', 'title', 'wordCount'])
  sortBy?: string = 'updatedAt';

  @ApiPropertyOptional({
    description: '排序方向',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: '关键字搜索（标题匹配）' })
  @IsOptional()
  @IsString()
  keyword?: string;
}
