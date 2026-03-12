import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { FoldersModule } from './modules/folders/folders.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { TagsModule } from './modules/tags/tags.module';
import { SearchModule } from './modules/search/search.module';
import { ImagesModule } from './modules/images/images.module';
import { AiModule } from './modules/ai/ai.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import configuration from './config/configuration';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // 限流模块
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 分钟
        limit: 100, // 最多 100 次请求
      },
    ]),

    // 静态文件服务 - 上传的图片
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
      },
    }),

    // 数据库模块
    PrismaModule,

    // 业务模块
    HealthModule,
    FoldersModule,
    DocumentsModule,
    TagsModule,
    SearchModule,
    ImagesModule,

    // Phase 2: AI 对话模块
    AiModule,
    ConversationsModule,
    EmbeddingModule,
  ],
})
export class AppModule {}
