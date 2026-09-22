import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PointerSystem } from "../systems/PointerSystem.js";
import type { Gesture } from "../systems/PointerSystem.js";

describe("PointerSystem", () => {
  let ps: PointerSystem;

  beforeEach(() => {
    vi.useFakeTimers();
    ps = new PointerSystem();
  });

  afterEach(() => {
    ps.destroy();
    vi.useRealTimers();
  });

  // ─── Multi-pointer tracking ──────────────────────────────────────────────

  it("tracks multiple simultaneous pointers by id", () => {
    ps.dispatchPointerDown({
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: "touch",
    });
    ps.dispatchPointerDown({
      pointerId: 2,
      clientX: 50,
      clientY: 50,
      pointerType: "touch",
    });
    expect(ps.pointerCount).toBe(2);
    expect(ps.getPointer(1)?.x).toBe(10);
    expect(ps.getPointer(2)?.x).toBe(50);
  });

  it("removes a pointer on up", () => {
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    ps.dispatchPointerUp({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(ps.pointerCount).toBe(0);
  });

  it("removes a pointer on cancel", () => {
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    ps.dispatchPointerCancel({ pointerId: 1 });
    expect(ps.pointerCount).toBe(0);
  });

  it("computes per-pointer delta on move", () => {
    ps.dispatchPointerDown({ pointerId: 1, clientX: 10, clientY: 10 });
    ps.dispatchPointerMove({ pointerId: 1, clientX: 15, clientY: 20 });
    const p = ps.getPointer(1);
    expect(p?.dx).toBe(5);
    expect(p?.dy).toBe(10);
  });

  it("first pointer is primary by default", () => {
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(ps.primaryPointer?.id).toBe(1);
  });

  it("fires down/move/up handlers", () => {
    const down = vi.fn();
    const move = vi.fn();
    const up = vi.fn();
    ps.onPointerDown(down);
    ps.onPointerMove(move);
    ps.onPointerUp(up);
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    ps.dispatchPointerMove({ pointerId: 1, clientX: 1, clientY: 1 });
    ps.dispatchPointerUp({ pointerId: 1, clientX: 1, clientY: 1 });
    expect(down).toHaveBeenCalledOnce();
    expect(move).toHaveBeenCalledOnce();
    expect(up).toHaveBeenCalledOnce();
  });

  it("unsubscribe stops further callbacks", () => {
    const fn = vi.fn();
    const off = ps.onPointerDown(fn);
    off();
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(fn).not.toHaveBeenCalled();
  });

  // ─── Gestures: tap ────────────────────────────────────────────────────────

  it("emits a tap on a quick, near-stationary down+up", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(50);
    ps.dispatchPointerUp({ pointerId: 1, clientX: 102, clientY: 101 });
    expect(gestures).toHaveLength(1);
    expect(gestures[0]?.type).toBe("tap");
  });

  it("does not emit a tap if movement exceeds threshold", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(50);
    ps.dispatchPointerUp({ pointerId: 1, clientX: 50, clientY: 0 });
    expect(gestures.find((g) => g.type === "tap")).toBeUndefined();
  });

  it("does not emit a tap if held too long", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(400);
    ps.dispatchPointerUp({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(gestures.find((g) => g.type === "tap")).toBeUndefined();
  });

  // ─── Gestures: long-press ─────────────────────────────────────────────────

  it("emits a longpress when held past the threshold with minimal movement", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(600);
    ps.update();
    expect(gestures).toHaveLength(1);
    expect(gestures[0]?.type).toBe("longpress");
  });

  it("does not emit longpress before the threshold elapses", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(200);
    ps.update();
    expect(gestures.find((g) => g.type === "longpress")).toBeUndefined();
  });

  it("does not emit longpress if the pointer moved too far before the poll", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(100);
    ps.dispatchPointerMove({ pointerId: 1, clientX: 50, clientY: 0 });
    vi.advanceTimersByTime(500);
    ps.update();
    expect(gestures.find((g) => g.type === "longpress")).toBeUndefined();
  });

  it("does not also emit a tap after a longpress fires", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(600);
    ps.update();
    ps.dispatchPointerUp({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(gestures.filter((g) => g.type === "tap")).toHaveLength(0);
  });

  // ─── Gestures: swipe ──────────────────────────────────────────────────────

  it("emits a swipe for a fast, long, directional drag", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(50);
    ps.dispatchPointerUp({ pointerId: 1, clientX: 200, clientY: 0 });
    const swipe = gestures.find((g) => g.type === "swipe");
    expect(swipe).toBeDefined();
    expect(swipe?.type === "swipe" && swipe.direction).toBe("right");
  });

  it("classifies swipe direction correctly for each axis", () => {
    const dirs: string[] = [];
    ps.onGesture((g) => {
      if (g.type === "swipe") dirs.push(g.direction);
    });
    const cases: Array<[number, number, string]> = [
      [200, 0, "right"],
      [-200, 0, "left"],
      [0, 200, "down"],
      [0, -200, "up"],
    ];
    let id = 1;
    for (const [dx, dy] of cases) {
      ps.dispatchPointerDown({ pointerId: id, clientX: 0, clientY: 0 });
      vi.advanceTimersByTime(20);
      ps.dispatchPointerUp({ pointerId: id, clientX: dx, clientY: dy });
      id++;
    }
    expect(dirs).toEqual(["right", "left", "down", "up"]);
  });

  it("does not emit a swipe for a slow drag", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({ pointerId: 1, clientX: 0, clientY: 0 });
    vi.advanceTimersByTime(5000);
    ps.dispatchPointerUp({ pointerId: 1, clientX: 200, clientY: 0 });
    expect(gestures.find((g) => g.type === "swipe")).toBeUndefined();
  });

  // ─── Gestures: pinch ──────────────────────────────────────────────────────

  it("emits pinch events with increasing scale as two pointers spread apart", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      pointerType: "touch",
    });
    ps.dispatchPointerDown({
      pointerId: 2,
      clientX: 120,
      clientY: 100,
      pointerType: "touch",
    });
    ps.dispatchPointerMove({ pointerId: 2, clientX: 160, clientY: 100 });
    const pinches = gestures.filter((g) => g.type === "pinch");
    expect(pinches.length).toBeGreaterThan(0);
    const last = pinches[pinches.length - 1];
    expect(last?.type === "pinch" && last.scale).toBeGreaterThan(1);
  });

  it("emits pinch events with decreasing scale as two pointers move together", () => {
    const gestures: Gesture[] = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchPointerDown({
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    ps.dispatchPointerDown({
      pointerId: 2,
      clientX: 100,
      clientY: 0,
      pointerType: "touch",
    });
    ps.dispatchPointerMove({ pointerId: 2, clientX: 20, clientY: 0 });
    const pinches = gestures.filter((g) => g.type === "pinch");
    const last = pinches[pinches.length - 1];
    expect(last?.type === "pinch" && last.scale).toBeLessThan(1);
  });

  it("stops tracking pinch once one of the two pointers lifts", () => {
    ps.dispatchPointerDown({
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      pointerType: "touch",
    });
    ps.dispatchPointerDown({
      pointerId: 2,
      clientX: 100,
      clientY: 0,
      pointerType: "touch",
    });
    ps.dispatchPointerUp({ pointerId: 1, clientX: 0, clientY: 0 });
    expect(ps.pointerCount).toBe(1);
  });

  // ─── Wheel: trackpad vs mouse-wheel discrimination ───────────────────────

  it("classifies large integer pixel deltas as mouse-wheel", () => {
    const events: Array<{ source: string }> = [];
    ps.onWheel((w) => events.push(w));
    ps.dispatchWheel({ deltaX: 0, deltaY: 120, deltaMode: 0 });
    expect(events[0]?.source).toBe("mouse-wheel");
  });

  it("classifies small fractional pixel deltas as trackpad", () => {
    const events: Array<{ source: string }> = [];
    ps.onWheel((w) => events.push(w));
    ps.dispatchWheel({ deltaX: 0, deltaY: 3.33, deltaMode: 0 });
    expect(events[0]?.source).toBe("trackpad");
  });

  it("classifies non-pixel deltaMode (line/page) as mouse-wheel", () => {
    const events: Array<{ source: string }> = [];
    ps.onWheel((w) => events.push(w));
    ps.dispatchWheel({ deltaX: 0, deltaY: 3, deltaMode: 1 });
    expect(events[0]?.source).toBe("mouse-wheel");
  });

  it("flags ctrlKey wheel events as a pinch-zoom gesture", () => {
    const events: Array<{ isPinchZoom: boolean }> = [];
    ps.onWheel((w) => events.push(w));
    ps.dispatchWheel({ deltaX: 0, deltaY: -5, deltaMode: 0, ctrlKey: true });
    expect(events[0]?.isPinchZoom).toBe(true);
  });

  // ─── Safari GestureEvent: trackpad pinch, defense-in-depth signal ────────

  it("emits a pinch gesture from a Safari gesturechange with scale > 1 for spreading", () => {
    const gestures: Array<{ type: string }> = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchSafariGestureStart();
    ps.dispatchSafariGestureChange({ scale: 1.5, clientX: 10, clientY: 20 });
    const pinches = gestures.filter((g) => g.type === "pinch");
    expect(pinches.length).toBe(1);
    expect(pinches[0]).toMatchObject({
      type: "pinch",
      x: 10,
      y: 20,
      scale: 1.5,
      deltaScale: 0.5,
    });
  });

  it("deltaScale accumulates relative to the previous gesturechange, not gesture start", () => {
    const gestures: Array<{ type: string; deltaScale?: number }> = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchSafariGestureStart();
    ps.dispatchSafariGestureChange({ scale: 1.2, clientX: 0, clientY: 0 });
    ps.dispatchSafariGestureChange({ scale: 1.5, clientX: 0, clientY: 0 });
    const pinches = gestures.filter((g) => g.type === "pinch");
    expect(pinches[0]?.deltaScale).toBeCloseTo(0.2);
    expect(pinches[1]?.deltaScale).toBeCloseTo(0.3);
  });

  it("gestureend resets tracking so a later gesturechange starts fresh from scale 1", () => {
    const gestures: Array<{ type: string; deltaScale?: number }> = [];
    ps.onGesture((g) => gestures.push(g));
    ps.dispatchSafariGestureStart();
    ps.dispatchSafariGestureChange({ scale: 1.5, clientX: 0, clientY: 0 });
    ps.dispatchSafariGestureEnd();
    ps.dispatchSafariGestureChange({ scale: 1.1, clientX: 0, clientY: 0 });
    const pinches = gestures.filter((g) => g.type === "pinch");
    expect(pinches[1]?.deltaScale).toBeCloseTo(0.1);
  });

  // ─── attach/detach guard for Node/no-DOM environment ─────────────────────

  it("attach is a no-op when passed an undefined-like target (Node/no-DOM guard)", () => {
    const noDomPs = new PointerSystem();
    expect(() => {
      noDomPs.attach(undefined as unknown as EventTarget);
    }).not.toThrow();
    noDomPs.destroy();
  });
});
