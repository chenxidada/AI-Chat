import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';

export class CreateConversationDto {
  @ApiPropertyOptional({ description: '对话标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: '对话模式',
    enum: ['general', 'knowledge_base'],
    default: 'general',
  })
  @IsOptional()
  @IsIn(['general', 'knowledge_base'])
  mode?: string;

  @ApiPropertyOptional({ description: '上下文文档 IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contextDocumentIds?: string[];

  @ApiPropertyOptional({ description: '上下文文件夹 ID' })
  @IsOptional()
  @IsUUID('4')
  contextFolderId?: string;

  @ApiPropertyOptional({ description: '上下文标签 IDs', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contextTagIds?: string[];
}
