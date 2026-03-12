import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator';

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: '对话标题' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: '是否归档' })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

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
