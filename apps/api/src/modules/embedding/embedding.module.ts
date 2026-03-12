import { Module } from '@nestjs/common';
import { EmbeddingController } from './embedding.controller';
import { EmbeddingSyncService } from './embedding-sync.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [EmbeddingController],
  providers: [EmbeddingSyncService],
  exports: [EmbeddingSyncService],
})
export class EmbeddingModule {}
