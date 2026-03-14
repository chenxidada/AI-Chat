import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchConversationDto {
  @ApiProperty({ description: '搜索关键词', required: false })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiProperty({ description: '页码', default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({ description: '每页数量', default: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiProperty({ description: '对话模式', required: false })
  @IsOptional()
  @IsString()
  mode?: string;

  @ApiProperty({ description: '是否置顶', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPinned?: boolean;

  @ApiProperty({ description: '是否星标', required: false })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isStarred?: boolean;
}
