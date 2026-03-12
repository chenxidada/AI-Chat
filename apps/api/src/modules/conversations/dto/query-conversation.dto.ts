import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryConversationDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: '是否归档', enum: ['true', 'false'] })
  @IsOptional()
  @IsIn(['true', 'false'])
  isArchived?: string;

  @ApiPropertyOptional({
    description: '对话模式',
    enum: ['general', 'knowledge_base'],
  })
  @IsOptional()
  @IsIn(['general', 'knowledge_base'])
  mode?: string;
}
