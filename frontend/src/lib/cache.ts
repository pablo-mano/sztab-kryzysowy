interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry && entry.expires > now) {
    return entry.data;
  }

  const data = await fn();
  store.set(key, { data, expires: now + ttlMs });
  return data;
}

export function invalidate(key: string) {
  store.delete(key);
}

export function invalidateAll() {
  store.clear();
}
