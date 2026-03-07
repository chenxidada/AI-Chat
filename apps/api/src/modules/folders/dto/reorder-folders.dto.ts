import { IsArray, ValidateNested, IsUUID, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ReorderItem {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty()
  @IsInt()
  sortOrder: number;
}

export class ReorderFoldersDto {
  @ApiProperty({ type: [ReorderItem] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items: ReorderItem[];
}
