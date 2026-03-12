import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  Max,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ChatDto {
  @ApiProperty({ description: '用户问题', minLength: 1 })
  @IsString()
  @MinLength(1)
  question: string;

  @ApiPropertyOptional({ description: '对话 ID，不提供则创建新对话' })
  @IsOptional()
  @IsUUID('4')
  conversationId?: string;

  @ApiPropertyOptional({
    description: '对话模式',
    enum: ['general', 'knowledge_base'],
    default: 'general',
  })
  @IsOptional()
  @IsIn(['general', 'knowledge_base'])
  mode?: string;

  @ApiPropertyOptional({ description: '温度参数', minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;
}
