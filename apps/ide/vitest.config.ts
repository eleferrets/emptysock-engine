import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Konva's package.json "main" points at its Node build (index-node.js),
    // which requires the real "canvas" native module — not installed here,
    // and not needed under jsdom, which already gives us a (mocked, via
    // vitest-canvas-mock) <canvas>. Force module resolution onto Konva's
    // "browser" entry so it uses that instead.
    mainFields: ["browser", "module", "main"],
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
  },
});
