import { describe, expect, it, vi } from "vitest";

// Mock howler the same way v1's AudioSystem.test.ts does — AudioSystem is a
// straight port onto the ECS core (no per-entity audio components exist in the older systems, so
// there is nothing ECS-shaped to migrate; see CLAUDE.md's "Audio stays a
// Game-owned singleton" entry), so its behavior under mocked Howler is
// unchanged. This asserts the ECS-specific part: `Game` owns one `AudioSystem`
// for its lifetime and playback never throws headless (ENGINE_DESIGN.md §18).
vi.mock("howler", () => {
  const Howl = vi.fn().mockImplementation(function () {
    return {
      play: vi.fn().mockReturnValue(1),
      stop: vi.fn(),
      pause: vi.fn(),
      unload: vi.fn(),
      volume: vi.fn(),
    };
  });
  const Howler = { volume: vi.fn() };
  return { Howl, Howler };
});

import { Game, defineScene } from "../../ecs/Game.js";

describe("ECS Game-owned AudioSystem (ENGINE_DESIGN.md §18)", () => {
  it("game.audio exists and load/play/stop never throw headless", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    expect(() => {
      game.audio.load("theme", "assets/theme.ogg");
      game.audio.play("theme");
      game.audio.stop("theme");
    }).not.toThrow();

    await game.unloadScene();
  });

  it("audio is game-owned, not scene-owned: it persists across a scene reload", async () => {
    const game = new Game();
    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    game.audio.load("music", "assets/music.ogg");
    game.audio.play("music");

    await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });

    // Still the same AudioSystem instance — "music" is still a loaded sound,
    // not torn down just because the scene changed underneath it.
    expect(() => game.audio.play("music")).not.toThrow();
    await game.unloadScene();
  });

  it("SceneLifecycle.audio is the same instance as game.audio", async () => {
    const game = new Game();
    const lifecycle = await game.loadScene(defineScene({}), {
      physics: { gravity: { x: 0, y: 0 } },
    });
    expect(lifecycle.audio).toBe(game.audio);
    await game.unloadScene();
  });
});
