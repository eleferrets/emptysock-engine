import { describe, it, expect } from "vitest";
import {
  CoroutineSystem,
  waitFrames,
  waitSeconds,
  waitUntil,
} from "../systems/CoroutineSystem.js";
import type { CoroutineGen } from "../systems/CoroutineSystem.js";

describe("CoroutineSystem", () => {
  it("runs coroutine to completion", () => {
    const sys = new CoroutineSystem();
    let done = false;
    function* gen(): CoroutineGen {
      yield waitFrames(0);
      done = true;
    }
    sys.start("c1", gen());
    // waitFrames(0) — starts with remaining=0, first update completes
    sys.update(0.016);
    expect(done).toBe(true);
  });

  it("waitFrames(3) yields 3 times before continuing", () => {
    const sys = new CoroutineSystem();
    let reached = false;
    function* gen(): CoroutineGen {
      yield waitFrames(3);
      reached = true;
    }
    sys.start("c2", gen());
    sys.update(0.016); // frame 1: remaining 2
    expect(reached).toBe(false);
    sys.update(0.016); // frame 2: remaining 1
    expect(reached).toBe(false);
    sys.update(0.016); // frame 3: remaining 0 → step
    expect(reached).toBe(true);
  });

  it("waitSeconds(1) needs ~1s of delta to pass", () => {
    const sys = new CoroutineSystem();
    let reached = false;
    function* gen(): CoroutineGen {
      yield waitSeconds(1);
      reached = true;
    }
    sys.start("c3", gen());
    sys.update(0.5);
    expect(reached).toBe(false);
    sys.update(0.5);
    expect(reached).toBe(true);
  });

  it("waitUntil resolves when condition is true", () => {
    const sys = new CoroutineSystem();
    let flag = false;
    let reached = false;
    function* gen(): CoroutineGen {
      yield waitUntil(() => flag);
      reached = true;
    }
    sys.start("c4", gen());
    sys.update(0.016);
    expect(reached).toBe(false);
    flag = true;
    sys.update(0.016);
    expect(reached).toBe(true);
  });

  it("stop() halts coroutine", () => {
    const sys = new CoroutineSystem();
    let reached = false;
    function* gen(): CoroutineGen {
      yield waitFrames(1);
      reached = true;
    }
    sys.start("c5", gen());
    sys.stop("c5");
    sys.update(0.016);
    sys.update(0.016);
    expect(reached).toBe(false);
  });
});
