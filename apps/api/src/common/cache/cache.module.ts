import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';

@Global()
@Module({
  providers: [
    CacheService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}
