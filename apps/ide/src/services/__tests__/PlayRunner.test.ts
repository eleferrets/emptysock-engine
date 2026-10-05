// @vitest-environment node
import { describe, it, expect, vi } from "vitest";

vi.mock("../GameBuildService.js", () => ({
  gameBuildService: {},
  GameBuildService: class {},
}));
import { buildIframeHtml } from "../PlayRunner";

describe("PlayRunner iframe html", () => {
  it("emits inline scripts that parse (runtime relay, error modal, hot reload)", () => {
    const html = buildIframeHtml("", "blob:test", "http://localhost/vendor");
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
      (m) => m[1] ?? "",
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const body of scripts) {
      // Constructing a Function parses without running: a SyntaxError here
      // means the whole runner would silently lose console relay and errors.
      expect(() => new Function(body)).not.toThrow();
    }
  });
});
