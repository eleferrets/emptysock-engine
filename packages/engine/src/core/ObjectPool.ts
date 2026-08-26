export interface Poolable {
  reset(): void;
}

export type PoolFactory<T extends Poolable> = () => T;

export class ObjectPool<T extends Poolable> {
  private readonly _pool: T[] = [];
  private readonly _factory: PoolFactory<T>;
  private _created: number = 0;

  constructor(factory: PoolFactory<T>, initialSize: number = 0) {
    this._factory = factory;
    for (let i = 0; i < initialSize; i++) {
      this._pool.push(factory());
    }
    this._created = initialSize;
  }

  acquire(): T {
    const obj = this._pool.pop();
    if (obj !== undefined) {
      return obj;
    }
    this._created++;
    return this._factory();
  }

  release(obj: T): void {
    obj.reset();
    this._pool.push(obj);
  }

  get available(): number {
    return this._pool.length;
  }

  get created(): number {
    return this._created;
  }

  clear(): void {
    this._pool.length = 0;
  }
}
