export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export const CACHE_TTL = {
  PREFERRED: 24 * 60 * 60 * 1000, // 24 hours
  MAX_STALE: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export function set<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
  };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('Failed to set cache:', error);
  }
}

export function get<T>(key: string): CacheEntry<T> | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item) as CacheEntry<T>;
  } catch (error) {
    console.error('Failed to get cache:', error);
    return null;
  }
}

export function isStale(key: string, maxAgeMs: number): boolean {
  const entry = get(key);
  if (!entry) return true;
  const age = Date.now() - entry.timestamp;
  return age > maxAgeMs;
}

export function clear(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}
