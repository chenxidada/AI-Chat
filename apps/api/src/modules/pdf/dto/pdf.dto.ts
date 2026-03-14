import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class QueryPdfDto {
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

  @ApiPropertyOptional({ description: '关联文档ID' })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ description: '搜索关键词（搜索PDF内容）' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class UpdatePdfDto {
  @ApiPropertyOptional({ description: '原始文件名', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originalName?: string;

  @ApiPropertyOptional({ description: '关联文档ID' })
  @IsOptional()
  @IsString()
  documentId?: string;
}

export class PdfUploadResult {
  @ApiProperty({ description: 'PDF 文件 ID' })
  id: string;

  @ApiProperty({ description: '原始文件名' })
  originalName: string;

  @ApiProperty({ description: '文件大小（字节）' })
  size: number;

  @ApiProperty({ description: '页数' })
  pageCount: number;

  @ApiProperty({ description: '访问 URL' })
  url: string;

  @ApiPropertyOptional({ description: '缩略图 URL' })
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: '错误信息' })
  error?: string;
}
