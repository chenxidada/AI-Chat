import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { LlmService } from './llm.service';
import { EmbeddingService } from './embedding.service';
import { ChunkingService } from './chunking.service';
import { VectorSearchService } from './vector-search.service';
import { RagService } from './rag.service';
import { StreamingService } from './streaming.service';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [ConversationsModule],
  controllers: [AiController],
  providers: [
    AiService,
    LlmService,
    EmbeddingService,
    ChunkingService,
    VectorSearchService,
    RagService,
    StreamingService,
  ],
  exports: [
    AiService,
    LlmService,
    EmbeddingService,
    ChunkingService,
    VectorSearchService,
    RagService,
    StreamingService,
  ],
})
export class AiModule {}
