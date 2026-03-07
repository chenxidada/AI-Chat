import { IsString, IsOptional, IsUUID, IsInt, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ description: '文件夹名称', minLength: 1, maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: '父文件夹 ID' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ description: '排序序号', default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
