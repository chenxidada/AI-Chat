import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';
import { BatchOperationDto } from './batch-operation.dto';

export class BatchMoveDto extends BatchOperationDto {
  @ApiPropertyOptional({
    description: '目标文件夹 ID，null 表示移至未分类',
    example: 'uuid-folder',
  })
  @IsOptional()
  @IsUUID('4')
  folderId?: string | null;
}
