import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { SearchModule } from '../search/search.module';
import { DocumentsService } from './documents.service';
import { DocumentsBatchService } from './documents-batch.service';
import { OutlineService } from './outline.service';
import { DocumentsController } from './documents.controller';

@Module({
  imports: [PrismaModule, SearchModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsBatchService, OutlineService],
  exports: [DocumentsService, DocumentsBatchService, OutlineService],
})
export class DocumentsModule {}
