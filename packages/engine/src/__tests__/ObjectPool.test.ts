import { describe, it, expect, vi } from 'vitest';
import { ObjectPool } from '../core/ObjectPool.js';

class Counter {
  public value: number = 0;
  reset(): void { this.value = 0; }
}

describe('ObjectPool', () => {
  it('creates objects via factory', () => {
    const factory = vi.fn(() => new Counter());
    const pool = new ObjectPool(factory, 2);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(pool.created).toBe(2);
    expect(pool.available).toBe(2);
  });

  it('acquires from pool then creates when empty', () => {
    const pool = new ObjectPool(() => new Counter(), 1);
    const a = pool.acquire();
    expect(pool.available).toBe(0);
    const b = pool.acquire(); // forces new creation
    expect(pool.created).toBe(2);
    expect(a).not.toBe(b);
  });

  it('release resets and returns to pool', () => {
    const pool = new ObjectPool(() => new Counter(), 0);
    const obj = pool.acquire();
    obj.value = 99;
    pool.release(obj);
    expect(pool.available).toBe(1);
    const reused = pool.acquire();
    expect(reused.value).toBe(0);
    expect(reused).toBe(obj);
  });

  it('clear empties the pool', () => {
    const pool = new ObjectPool(() => new Counter(), 3);
    pool.clear();
    expect(pool.available).toBe(0);
  });
});
