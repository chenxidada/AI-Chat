import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';

/**
 * Cacheable decorator - marks method result to be cached
 * 
 * @param key - Cache key (supports placeholders like :id, :userId)
 * @param ttl - Time to live in milliseconds (default: 1 hour)
 * 
 * @example
 * @Cacheable('user:profile:id', 30 * 60 * 1000)
 * async getUserProfile(id: string) { ... }
 */
export const Cacheable = (key: string, ttl?: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    if (ttl) {
      SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    }
    return descriptor;
  };
};

/**
 * Cache Evict decorator - clears cache on method execution
 * 
 * @param keys - Cache keys to evict (supports placeholders)
 * 
 * @example
 * @CacheEvict('user:profile:id')
 * async updateUserProfile(id: string) { ... }
 */
export const CacheEvict = (...keys: string[]) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata('cache:evict', keys)(target, propertyKey, descriptor);
    return descriptor;
  };
};

/**
 * Cache Put decorator - always updates cache with method result
 * 
 * @param key - Cache key
 * @param ttl - Time to live in milliseconds
 * 
 * @example
 * @CachePut('user:profile:id', 30 * 60 * 1000)
 * async refreshUserProfile(id: string) { ... }
 */
export const CachePut = (key: string, ttl?: number) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    SetMetadata('cache:put', true)(target, propertyKey, descriptor);
    if (ttl) {
      SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    }
    return descriptor;
  };
};
