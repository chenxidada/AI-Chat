import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, MaxLength, IsOptional, IsObject } from 'class-validator';

export class CreateLinkDto {
  @ApiProperty({ description: '源文档 ID' })
  @IsUUID('4')
  sourceDocId: string;

  @ApiProperty({ description: '目标文档 ID' })
  @IsUUID('4')
  targetDocId: string;

  @ApiPropertyOptional({ description: '链接显示文本' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  linkText?: string;

  @ApiPropertyOptional({ description: '链接位置信息' })
  @IsOptional()
  @IsObject()
  position?: { start: number; end: number };
}
