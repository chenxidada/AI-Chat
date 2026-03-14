import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { PrismaModule } from './common/prisma/prisma.module';
import { CacheModule } from './common/cache/cache.module';
import { HealthModule } from './modules/health/health.module';
import { FoldersModule } from './modules/folders/folders.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { TagsModule } from './modules/tags/tags.module';
import { SearchModule } from './modules/search/search.module';
import { ImagesModule } from './modules/images/images.module';
import { AiModule } from './modules/ai/ai.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { LinksModule } from './modules/links/links.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { GraphModule } from './modules/graph/graph.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { PdfModule } from './modules/pdf/pdf.module';
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

    // 缓存模块
    CacheModule,

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

    // Phase 3-2: 双向链接模块
    LinksModule,

    // Phase 3-4: 导入导出模块
    ImportExportModule,

    // Phase 3-3: 知识图谱模块
    GraphModule,

    // Phase 3-1b: 模板模块
    TemplatesModule,

    // PDF 文件管理模块
    PdfModule,
  ],
})
export class AppModule {}
