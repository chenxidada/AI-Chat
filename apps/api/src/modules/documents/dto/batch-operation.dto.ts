import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class BatchOperationDto {
  @ApiProperty({
    description: '文档 ID 列表',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: '至少选择一个文档' })
  @ArrayMaxSize(100, { message: '单次最多操作 100 个文档' })
  @IsUUID('4', { each: true })
  documentIds: string[];
}
