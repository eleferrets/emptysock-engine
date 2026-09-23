import { describe, expect, it } from "vitest";
import { Game } from "../../ecs/Game.js";

/**
 * `Game.instances` (CLAUDE.md's "Meta component gives QueryChannel..." /
 * the IDE preview-iframe bootstrap's discovery mechanism) is a pure,
 * DOM-free static registry — no engine environment boundary violation, and
 * it must actually track every constructed `Game`, since the preview host
 * has no other way to find a `Game` it never constructed itself.
 */
describe("Game.instances", () => {
  it("tracks every constructed Game instance", () => {
    const before = Game.instances.size;
    const a = new Game();
    const b = new Game();
    expect(Game.instances.size).toBe(before + 2);
    expect(Game.instances.has(a)).toBe(true);
    expect(Game.instances.has(b)).toBe(true);
  });
});
