import { IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTagDto {
  @ApiProperty({ description: '标签名称', minLength: 1, maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'HEX 颜色值', example: '#3b82f6' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be a valid HEX color (e.g. #3b82f6)' })
  color?: string;
}
