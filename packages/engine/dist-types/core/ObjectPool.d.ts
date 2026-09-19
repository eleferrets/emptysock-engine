export interface Poolable {
  reset(): void;
}
export type PoolFactory<T extends Poolable> = () => T;
export declare class ObjectPool<T extends Poolable> {
  private readonly _pool;
  private readonly _factory;
  private _created;
  constructor(factory: PoolFactory<T>, initialSize?: number);
  acquire(): T;
  release(obj: T): void;
  get available(): number;
  get created(): number;
  clear(): void;
}
