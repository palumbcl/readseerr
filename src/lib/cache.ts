/**
 * Simple in-memory cache with TTL support.
 * Protects external APIs (especially ComicVine) from excessive requests.
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class MemoryCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;

  constructor(ttlSeconds: number = 300) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: T): void {
    // Evict expired entries periodically
    if (this.cache.size > 500) {
      this.evictExpired();
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// Shared cache instances
export const searchCache = new MemoryCache<unknown>(300); // 5 min
export const detailsCache = new MemoryCache<unknown>(600); // 10 min
