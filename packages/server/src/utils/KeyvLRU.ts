import LRUCache from 'lru-cache';
import Keyv, { Store, type Options } from 'keyv';

// LRUCache wrapper to implement the Keyv `Store` interface.
export class LRUStore<T> implements Store<T> {
  private cache: LRUCache<string, T>;

  constructor(lruCacheOpts: LRUCache.Options<string, T>) {
    this.cache = new LRUCache(lruCacheOpts);
  }

  set(key: string, value: T, ttl?: number) {
    const result = this.cache.set(key, value, { ttl });
    return result;
  }

  get(key: string) {
    return this.cache.get(key);
  }

  delete(key: string) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  keys() {
    const keys = [];
    for (const key of this.cache.keys()) {
      keys.push(key);
    }
    return keys;
  }

  sizeCalculation() {
    return this.cache.calculatedSize;
  }
}

export class KeyvLRU<T> extends Keyv<T, { maxSize?: number }> {
  constructor(opts?: Options<T>) {
    super({
      namespace: 'apollo',
      store: new LRUStore<T>({
        // FIXME: @glasser this was previously Infinity but no longer allowed,
        // do you propose something else here? I'm unsure about a sane default.
        maxSize: 999999999,
        sizeCalculation(obj) {
          return jsonBytesSizeCalculator(obj);
        }
      }),
      ...opts,
    });
  }

  getTotalSize() {
    if ('sizeCalculation' in this.opts.store) {
      return (
        this.opts.store as Store<T> & { sizeCalculation: () => number }
      ).sizeCalculation();
    }
    // TODO: probably don't throw here
    throw Error('`Keyv.store` does not implement `sizeCalculation()`');
  }
}

export class PrefixingKeyv<K> extends Keyv<K> {
  constructor(private wrapped: Keyv<K>, private prefix: string) {
    super();
  }

  override get<TRaw extends boolean = false>(
    key: string,
    opts?: { raw?: TRaw },
  ) {
    return this.wrapped.get(this.prefix + key, opts);
  }

  override set(key: string, value: K, ttl?: number) {
    return this.wrapped.set(this.prefix + key, value, ttl);
  }

  override delete(key: string) {
    return this.wrapped.delete(this.prefix + key);
  }

  getTotalSize() {
    if ('getTotalSize' in this.wrapped) {
      return (this.wrapped as Keyv & { getTotalSize(): number }).getTotalSize();
    }
    // TODO: probably don't throw here
    throw Error(
      '`PrefixingKeyv`s wrapped Keyv does not implement `sizeCalculation()`',
    );
  }
}

export function jsonBytesSizeCalculator<T>(obj: T) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}
