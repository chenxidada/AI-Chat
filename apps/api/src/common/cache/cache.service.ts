import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCache, Cache } from 'cache-manager';
import { Keyv } from 'keyv';
import KeyvRedis from '@keyv/redis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private cache: Cache | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');
    
    try {
      // Create Redis store
      const redisStore = new KeyvRedis(redisUrl);
      const keyv = new Keyv({ store: redisStore });
      
      this.cache = createCache({ stores: [keyv] });
      this.isConnected = true;
      this.logger.log('Redis cache connected successfully');
    } catch (error: any) {
      this.logger.warn(`Redis connection failed, falling back to in-memory cache: ${error.message}`);
      // Fallback to in-memory cache
      const keyv = new Keyv();
      this.cache = createCache({ stores: [keyv] });
    }
  }

  async onModuleDestroy() {
    this.isConnected = false;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (!this.cache) return undefined;
    try {
      return await this.cache.get<T>(key);
    } catch (error: any) {
      this.logger.error(`Cache get error for key ${key}: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.set(key, value, ttl);
    } catch (error: any) {
      this.logger.error(`Cache set error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.del(key);
    } catch (error: any) {
      this.logger.error(`Cache del error for key ${key}: ${error.message}`);
    }
  }

  /**
   * Clear all cache (use with caution)
   */
  async reset(): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.clear();
      this.logger.log('Cache cleared');
    } catch (error: any) {
      this.logger.error(`Cache reset error: ${error.message}`);
    }
  }

  /**
   * Get or set cache value
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttl);
    return value;
  }

  /**
   * Check if cache is healthy
   */
  isHealthy(): boolean {
    return this.cache !== null;
  }

  /**
   * Check if using Redis
   */
  isRedisConnected(): boolean {
    return this.isConnected;
  }
}
