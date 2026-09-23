/**
 * Caches des réponses d'API externes.
 * Protège les quotas (ComicVine : ~200 requêtes/heure) et accélère les recherches répétées.
 */
import { prisma } from "@/lib/prisma";

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

  set(key: string, data: T, expiresAt: number = Date.now() + this.ttlMs): void {
    // Evict expired entries periodically
    if (this.cache.size > 500) {
      this.evictExpired();
    }

    this.cache.set(key, { data, expiresAt });
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

/**
 * Cache à deux niveaux : mémoire (rapide) puis SQLite (survit aux redémarrages et mises à jour).
 * Une panne de la base ne casse jamais l'appelant : on retombe simplement sur l'API.
 */
export class PersistentCache<T> {
  private readonly memory: MemoryCache<T>;
  private readonly ttlMs: number;

  constructor(
    private readonly namespace: string,
    ttlSeconds: number
  ) {
    this.memory = new MemoryCache<T>(ttlSeconds);
    this.ttlMs = ttlSeconds * 1000;
  }

  private dbKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async get(key: string): Promise<T | null> {
    const hit = this.memory.get(key);
    if (hit !== null) return hit;

    try {
      const row = await prisma.cacheEntry.findUnique({ where: { key: this.dbKey(key) } });
      if (!row || row.expiresAt.getTime() <= Date.now()) return null;
      const data = JSON.parse(row.value) as T;
      this.memory.set(key, data, row.expiresAt.getTime());
      return data;
    } catch (error) {
      console.error(`Cache ${this.namespace} illisible:`, error);
      return null;
    }
  }

  /** `ttlSeconds` remplace la durée par défaut du cache pour cette entrée. */
  async set(key: string, data: T, ttlSeconds?: number): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds !== undefined ? ttlSeconds * 1000 : this.ttlMs);
    this.memory.set(key, data, expiresAt);
    try {
      const value = JSON.stringify(data);
      await prisma.cacheEntry.upsert({
        where: { key: this.dbKey(key) },
        create: { key: this.dbKey(key), value, expiresAt: new Date(expiresAt) },
        update: { value, expiresAt: new Date(expiresAt) },
      });
    } catch (error) {
      console.error(`Cache ${this.namespace} non enregistré:`, error);
    }
  }

  /** Durée de validité restante d'une entrée, en millisecondes (0 si absente ou expirée). */
  async remainingMs(key: string): Promise<number> {
    try {
      const row = await prisma.cacheEntry.findUnique({ where: { key: this.dbKey(key) }, select: { expiresAt: true } });
      return row ? Math.max(0, row.expiresAt.getTime() - Date.now()) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Lit le cache, sinon charge et met en cache.
   * `shouldCache` écarte les réponses à ne pas figer (ex. liste vide renvoyée par une API en difficulté).
   */
  async wrap(
    key: string,
    load: () => Promise<T>,
    shouldCache: (value: T) => boolean = () => true,
    ttlSeconds?: number
  ): Promise<T> {
    const hit = await this.get(key);
    if (hit !== null) return hit;
    const value = await load();
    if (shouldCache(value)) await this.set(key, value, ttlSeconds);
    return value;
  }
}

/** Supprime les entrées expirées du cache persistant (appelé périodiquement). */
export async function purgeExpiredCache(): Promise<number> {
  const { count } = await prisma.cacheEntry.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

// Sur globalThis : les routes et l'instrumentation partagent le même cache mémoire
const shared = globalThis as unknown as {
  readseerrCaches?: { search: PersistentCache<unknown>; details: PersistentCache<unknown> };
};
shared.readseerrCaches ??= {
  // Une recherche complète peut coûter des dizaines de pages ComicVine
  search: new PersistentCache<unknown>("search", 6 * 3600),
  details: new PersistentCache<unknown>("details", 6 * 3600),
};

export const searchCache = shared.readseerrCaches.search;
export const detailsCache = shared.readseerrCaches.details;
