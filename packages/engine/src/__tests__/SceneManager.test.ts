import { describe, it, expect, beforeEach } from "vitest";
import { SceneManagerInstance } from "../core/SceneManager.js";
import { Scene } from "../core/Scene.js";

describe("SceneManager", () => {
  beforeEach(() => {
    // Reset internal state between tests.
    const sm = SceneManagerInstance as unknown as {
      _registry: Map<string, () => Scene>;
      _active: Scene | null;
      _pending: string | null;
      _transitioning: boolean;
      _elapsed: number;
      _isLoading: boolean;
    };
    sm._registry.clear();
    sm._active?.stop();
    sm._active = null;
    sm._pending = null;
    sm._transitioning = false;
    sm._elapsed = 0;
    sm._isLoading = false;
  });

  it("registers and loads a scene by name", () => {
    SceneManagerInstance.register("Main", () => new Scene("Main"));
    const scene = SceneManagerInstance.load("Main");
    expect(scene.name).toBe("Main");
    expect(scene.isRunning).toBe(true);
    expect(SceneManagerInstance.current).toBe(scene);
  });

  it("throws when loading an unregistered scene", () => {
    expect(() => SceneManagerInstance.load("Missing")).toThrow("Missing");
  });

  it("transitions to a new scene after duration", () => {
    SceneManagerInstance.register("A", () => new Scene("A"));
    SceneManagerInstance.register("B", () => new Scene("B"));
    SceneManagerInstance.load("A");
    SceneManagerInstance.transition("B", { duration: 0.1 });
    expect(SceneManagerInstance.isTransitioning).toBe(true);
    SceneManagerInstance.update(0.05);
    expect(SceneManagerInstance.current?.name).toBe("A");
    SceneManagerInstance.update(0.1);
    expect(SceneManagerInstance.current?.name).toBe("B");
    expect(SceneManagerInstance.isTransitioning).toBe(false);
  });

  it("queues a scene switch on next update when not transitioning", () => {
    SceneManagerInstance.register("X", () => new Scene("X"));
    SceneManagerInstance.register("Y", () => new Scene("Y"));
    SceneManagerInstance.load("X");
    SceneManagerInstance.queue("Y");
    SceneManagerInstance.update(0);
    expect(SceneManagerInstance.current?.name).toBe("Y");
  });

  it("calls onDestroy on the outgoing scene when loading a new one", () => {
    let destroyed = false;
    class TrackScene extends Scene {
      override onDestroy(): void {
        destroyed = true;
      }
    }
    SceneManagerInstance.register("Old", () => new TrackScene("Old"));
    SceneManagerInstance.register("New", () => new Scene("New"));
    SceneManagerInstance.load("Old");
    SceneManagerInstance.load("New");
    expect(destroyed).toBe(true);
  });

  it("calls onLoad on the incoming scene", async () => {
    let loaded = false;
    class LoadScene extends Scene {
      override onLoad(): Promise<void> {
        loaded = true;
        return Promise.resolve();
      }
    }
    SceneManagerInstance.register("L", () => new LoadScene("L"));
    SceneManagerInstance.load("L");
    // onLoad is async — give the microtask queue a tick
    await Promise.resolve();
    expect(loaded).toBe(true);
  });
});
