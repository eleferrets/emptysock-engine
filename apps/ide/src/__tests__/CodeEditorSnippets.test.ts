import { describe, it, expect } from "vitest";
import { SNIPPETS } from "../components/panels/codeSnippets.js";

/**
 * The "Insert Snippet" feature hands these strings straight into a user's
 * ECS-targeted game file (apps/ide's Monaco types and runtime bundle only
 * cover @emptysock/engine/ecs now — RELEASE_PASS.md's "apps/ide ECS
 * migration" track). A snippet written against the classic API
 * (`extends Scene`, `createEntity`, `addComponent(new X())`, `hasTag`) would
 * not even typecheck in the Code editor, let alone run.
 */
describe("CodeEditor SNIPPETS target the ECS API, not the classic one", () => {
  it("contains no classic-only API shapes in any snippet body", () => {
    for (const snippet of SNIPPETS) {
      expect(snippet.body).not.toContain("extends Scene");
      expect(snippet.body).not.toContain("createEntity");
      expect(snippet.body).not.toContain("addComponent(");
      expect(snippet.body).not.toContain(".hasTag(");
    }
  });

  it("Camera follow / Timer once snippets use real, exported ECS classes", () => {
    const camera = SNIPPETS.find((s) => s.label === "Camera follow");
    const timer = SNIPPETS.find((s) => s.label === "Timer once");
    expect(camera?.body).toContain("new CameraSystem()");
    expect(timer?.body).toContain("new TweenManager()");
  });
});
