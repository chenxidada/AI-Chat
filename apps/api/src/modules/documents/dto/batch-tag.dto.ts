import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsIn } from 'class-validator';
import { BatchOperationDto } from './batch-operation.dto';

export class BatchTagDto extends BatchOperationDto {
  @ApiProperty({
    description: '标签 ID 列表',
    type: [String],
    example: ['uuid-tag-1', 'uuid-tag-2'],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds: string[];

  @ApiProperty({
    description: '操作模式：add(添加)、remove(移除)、replace(替换)',
    enum: ['add', 'remove', 'replace'],
    example: 'add',
  })
  @IsIn(['add', 'remove', 'replace'])
  mode: 'add' | 'remove' | 'replace';
}
