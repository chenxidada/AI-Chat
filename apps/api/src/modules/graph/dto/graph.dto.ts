import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

export class GetGraphDataDto {
  @ApiProperty({ description: '中心文档ID（可选，用于获取局部图谱）', required: false })
  @IsOptional()
  @IsString()
  centerDocId?: string;

  @ApiProperty({ description: '深度（从中心文档扩展几层）', default: 2, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  depth?: number;

  @ApiProperty({ description: '最大节点数', default: 50, required: false })
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(200)
  maxNodes?: number;

  @ApiProperty({ description: '文件夹ID（筛选特定文件夹）', required: false })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiProperty({ description: '标签ID（筛选特定标签）', required: false })
  @IsOptional()
  @IsString()
  tagId?: string;
}

export class ExportGraphDto {
  @ApiProperty({ description: '导出格式', enum: ['json', 'svg', 'png'], default: 'json' })
  @IsOptional()
  @IsString()
  format?: string;
}
