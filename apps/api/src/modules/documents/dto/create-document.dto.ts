import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  MaxLength,
  MinLength,
  IsIn,
  IsUrl,
} from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ description: '文档标题', minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @ApiPropertyOptional({ description: 'Markdown 内容', default: '' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: '所属文件夹 ID (UUID)' })
  @IsOptional()
  @IsUUID()
  folderId?: string;

  @ApiPropertyOptional({ description: '标签 ID 列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: '来源类型',
    enum: ['manual', 'import', 'web-clip'],
    default: 'manual',
  })
  @IsOptional()
  @IsIn(['manual', 'import', 'web-clip'])
  sourceType?: string;

  @ApiPropertyOptional({ description: '来源 URL' })
  @IsOptional()
  @IsUrl()
  sourceUrl?: string;
}
