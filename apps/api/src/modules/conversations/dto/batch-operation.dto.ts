import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsEnum, IsNotEmpty } from 'class-validator';

export class BatchOperationDto {
  @ApiProperty({ description: '对话 ID 列表', type: [String] })
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @ApiProperty({
    description: '操作类型',
    enum: ['archive', 'unarchive', 'delete', 'pin', 'unpin', 'star', 'unstar'],
  })
  @IsEnum(['archive', 'unarchive', 'delete', 'pin', 'unpin', 'star', 'unstar'])
  operation: 'archive' | 'unarchive' | 'delete' | 'pin' | 'unpin' | 'star' | 'unstar';
}
