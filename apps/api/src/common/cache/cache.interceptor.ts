import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of, switchMap, tap } from 'rxjs';
import { CacheService } from './cache.service';
import {
  CACHE_KEY_METADATA,
  CACHE_TTL_METADATA,
} from './cache.decorator';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const cacheKey = this.reflector.get<string>(
      CACHE_KEY_METADATA,
      context.getHandler(),
    );
    const cacheTtl = this.reflector.get<number>(
      CACHE_TTL_METADATA,
      context.getHandler(),
    );
    const cacheEvict = this.reflector.get<string[]>(
      'cache:evict',
      context.getHandler(),
    );
    const cachePut = this.reflector.get<boolean>(
      'cache:put',
      context.getHandler(),
    );

    // No cache decorators found
    if (!cacheKey && !cacheEvict) {
      return next.handle();
    }

    const args = context.getArgs();
    const resolvedKey = this.resolveKey(cacheKey, args);

    // Handle cache eviction
    if (cacheEvict) {
      return next.handle().pipe(
        tap(() => {
          cacheEvict.forEach((key) => {
            const resolvedEvictKey = this.resolveKey(key, args);
            this.cacheService.del(resolvedEvictKey);
          });
        }),
      );
    }

    // Handle cache put (always update cache)
    if (cachePut && cacheKey) {
      return next.handle().pipe(
        tap((result) => {
          this.cacheService.set(resolvedKey, result, cacheTtl);
        }),
      );
    }

    // Handle cacheable (get from cache or set)
    if (cacheKey) {
      return from(this.cacheService.get(resolvedKey)).pipe(
        switchMap((cachedValue) => {
          if (cachedValue !== undefined) {
            this.logger.debug(`Cache hit for key: ${resolvedKey}`);
            return of(cachedValue);
          }

          this.logger.debug(`Cache miss for key: ${resolvedKey}`);
          return next.handle().pipe(
            tap((result) => {
              this.cacheService.set(resolvedKey, result, cacheTtl);
            }),
          );
        }),
      );
    }

    return next.handle();
  }

  /**
   * Resolve cache key with argument placeholders
   * Supports :0, :1, :2 etc for positional args
   * Supports :id, :userId etc for named args (from objects)
   */
  private resolveKey(key: string, args: any[]): string {
    if (!key) return '';

    let resolved = key;

    // Replace positional placeholders (:0, :1, etc)
    resolved = resolved.replace(/:(\d+)/g, (match, index) => {
      const argIndex = parseInt(index, 10);
      return args[argIndex] !== undefined ? String(args[argIndex]) : match;
    });

    // Replace named placeholders (:id, :userId, etc)
    resolved = resolved.replace(/:(\w+)/g, (match, name) => {
      // Look through all args for objects with this property
      for (const arg of args) {
        if (arg && typeof arg === 'object' && arg[name] !== undefined) {
          return String(arg[name]);
        }
      }
      return match;
    });

    return resolved;
  }
}
