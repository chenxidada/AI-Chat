import { IsOptional, IsUUID } from 'class-validator';

export class UploadImageDto {
  @IsOptional()
  @IsUUID()
  documentId?: string;
}
