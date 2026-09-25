import { describe, expect, it } from "vitest";
import {
  array_length,
  array_create,
  array_resize,
  array_push,
  array_pop,
  array_insert,
  array_delete,
  array_sort,
  array_contains,
  array_map,
  array_filter,
  array_reduce,
} from "../compat/gml.js";

describe("compat/gml.ts — GMS2.3+ array function family", () => {
  it("array_length/array_create/array_resize", () => {
    expect(array_length([1, 2, 3])).toBe(3);
    expect(array_create(3, 5)).toEqual([5, 5, 5]);
    expect(array_create(2)).toEqual([0, 0]);

    const arr = [1, 2, 3];
    array_resize(arr, 5);
    expect(arr).toEqual([1, 2, 3, 0, 0]);
    array_resize(arr, 2);
    expect(arr).toEqual([1, 2]);
  });

  it("array_push/array_pop mutate in place", () => {
    const arr: number[] = [1];
    array_push(arr, 2, 3);
    expect(arr).toEqual([1, 2, 3]);
    expect(array_pop(arr)).toBe(3);
    expect(arr).toEqual([1, 2]);
  });

  it("array_insert/array_delete mutate in place", () => {
    const arr = [1, 3];
    array_insert(arr, 1, 2);
    expect(arr).toEqual([1, 2, 3]);
    array_delete(arr, 1, 1);
    expect(arr).toEqual([1, 3]);
    array_delete(arr, 0);
    expect(arr).toEqual([3]);
  });

  it("array_sort sorts ascending/descending by boolean, or a comparator function", () => {
    expect(array_sort([3, 1, 2], true)).toEqual([1, 2, 3]);
    expect(array_sort([3, 1, 2], false)).toEqual([3, 2, 1]);
    const arr = [{ k: 3 }, { k: 1 }, { k: 2 }];
    array_sort(arr, (a, b) => (a as { k: number }).k - (b as { k: number }).k);
    expect(arr.map((o) => (o as { k: number }).k)).toEqual([1, 2, 3]);
  });

  it("array_contains", () => {
    expect(array_contains([1, 2, 3], 2)).toBe(true);
    expect(array_contains([1, 2, 3], 9)).toBe(false);
  });

  it("array_map/array_filter never mutate the source array", () => {
    const arr = [1, 2, 3];
    const doubled = array_map(arr, (v) => (v as number) * 2);
    expect(doubled).toEqual([2, 4, 6]);
    expect(arr).toEqual([1, 2, 3]);

    const evens = array_filter(arr, (v) => (v as number) % 2 === 0);
    expect(evens).toEqual([2]);
    expect(arr).toEqual([1, 2, 3]);
  });

  it("array_map/array_filter pass (value, index) to the callback", () => {
    const seen: Array<[unknown, number]> = [];
    array_map([10, 20], (v, i) => {
      seen.push([v, i]);
      return v;
    });
    expect(seen).toEqual([
      [10, 0],
      [20, 1],
    ]);
  });

  it("array_reduce folds with an explicit seed, or the array's first element when omitted", () => {
    expect(
      array_reduce([1, 2, 3], (acc, v) => (acc as number) + (v as number), 0),
    ).toBe(6);
    expect(
      array_reduce([1, 2, 3], (acc, v) => (acc as number) + (v as number)),
    ).toBe(6);
  });
});
