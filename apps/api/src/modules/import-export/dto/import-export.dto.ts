import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsArray } from 'class-validator';

export enum ExportFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
  HTML = 'html',
}

export enum ImportSource {
  MARKDOWN = 'markdown',
  JSON = 'json',
  NOTION = 'notion',
  OBSIDIAN = 'obsidian',
}

export class ExportDocumentDto {
  @ApiProperty({ description: '导出格式', enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({ description: '文档ID', required: false })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiProperty({ description: '是否包含元数据', required: false, default: true })
  @IsOptional()
  includeMetadata?: boolean;
}

export class ExportBatchDto {
  @ApiProperty({ description: '文档ID列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  documentIds: string[];

  @ApiProperty({ description: '导出格式', enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiProperty({ description: '是否包含文件夹结构', required: false, default: true })
  @IsOptional()
  includeFolderStructure?: boolean;
}

export class ImportDocumentDto {
  @ApiProperty({ description: '导入来源', enum: ImportSource })
  @IsEnum(ImportSource)
  source: ImportSource;

  @ApiProperty({ description: '目标文件夹ID', required: false })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiProperty({ description: '文件内容（Markdown或JSON）' })
  @IsString()
  content: string;

  @ApiProperty({ description: '文件名', required: false })
  @IsOptional()
  @IsString()
  filename?: string;
}

export class BackupDto {
  @ApiProperty({ description: '是否包含文档内容', default: true })
  @IsOptional()
  includeDocuments?: boolean;

  @ApiProperty({ description: '是否包含文件夹结构', default: true })
  @IsOptional()
  includeFolders?: boolean;

  @ApiProperty({ description: '是否包含标签', default: true })
  @IsOptional()
  includeTags?: boolean;

  @ApiProperty({ description: '是否包含链接关系', default: true })
  @IsOptional()
  includeLinks?: boolean;
}
