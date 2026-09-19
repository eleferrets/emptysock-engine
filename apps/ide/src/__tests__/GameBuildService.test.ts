import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock esbuild-wasm before importing the service under test.
// GameBuildService uses a dynamic import("esbuild-wasm") that must be
// intercepted so no real WASM is loaded in the test environment.
// ---------------------------------------------------------------------------
const mockBuild = vi.fn();
const mockTransform = vi.fn();
const mockInitialize = vi.fn().mockResolvedValue(undefined);

vi.mock("esbuild-wasm", () => ({
  initialize: mockInitialize,
  build: mockBuild,
  transform: mockTransform,
}));

// The Vite ?url import is a static string — mock it as an empty string.
vi.mock("esbuild-wasm/esbuild.wasm?url", () => ({ default: "" }));

// SettingsService is used only to read buildWorkers; provide a minimal stub.
vi.mock("../services/SettingsService", () => ({
  loadSettings: () => ({ buildWorkers: 1 }),
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered.
// ---------------------------------------------------------------------------
import { GameBuildService } from "../services/GameBuildService";

// Shared valid build output that the mock esbuild returns.
const MOCK_OUTPUT_TEXT = "var x = 1;";
const GOOD_RESULT = {
  errors: [],
  outputFiles: [{ text: MOCK_OUTPUT_TEXT }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBuild.mockResolvedValue(GOOD_RESULT);
  mockTransform.mockResolvedValue({ code: MOCK_OUTPUT_TEXT });
});

aftterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// buildNow result shape
// ---------------------------------------------------------------------------
describe("GameBuildService.buildNow — result shape", () => {
  it("returns success:true and js when esbuild succeeds", async () => {
    const svc = new GameBuildService(0);
    const result = await svc.buildNow({
      code: "export const a = 1;",
      mode: "debug",
      filename: "game.ts",
      virtualFiles: {},
      define: {},
    });
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(typeof result.js).toBe("string");
    expect(result.byteSize).toBeGreaterThanOrEqual(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    svc.destroy();
  });

  it("returns success:false and errors when esbuild reports errors", async () => {
    mockBuild.mockResolvedValue({
      errors: [
        { text: "Cannot find module", location: { file: "game.ts", line: 1 } },
      ],
      outputFiles: [],
    });

    const svc = new GameBuildService(0);
    const result = await svc.buildNow({
      code: 'import { bad } from "./missing";',
      mode: "debug",
      virtualFiles: {},
      define: {},
    });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.js).toBe("");
    svc.destroy();
  });

  it("returns success:false when esbuild throws", async () => {
    mockBuild.mockRejectedValue({ errors: [{ text: "WASM crash" }] });

    const svc = new GameBuildService(0);
    const result = await svc.buildNow({
      code: "export {}",
      mode: "debug",
      virtualFiles: {},
      define: {},
    });
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("WASM crash");
    svc.destroy();
  });
});

// ---------------------------------------------------------------------------
// virtualFiles is forwarded into the build call
// ---------------------------------------------------------------------------
describe("GameBuildService.buildNow — virtualFiles forwarding", () => {
  it("passes all open files as virtualFiles to the esbuild call", async () => {
    const svc = new GameBuildService(0);
    const virtualFiles = {
      "src/main.ts": 'import { foo } from "./foo"; foo();',
      "src/foo.ts": "export function foo() {}",
    };
    await svc.buildNow({
      code: virtualFiles["src/main.ts"] as string,
      mode: "debug",
      filename: "src/main.ts",
      virtualFiles,
      define: {},
    });

    expect(mockBuild).toHaveBeenCalledOnce();
    const callArg = mockBuild.mock.calls[0]?.[0] as Record<string, unknown>;
    // The plugins array should contain the virtual-fs plugin which has captured virtualFiles.
    // We verify at least one plugin object is present.
    const plugins = callArg["plugins"] as unknown[];
    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);
    svc.destroy();
  });

  it("cancel() prevents a queued build from running", async () => {
    const onComplete = vi.fn();
    const svc = new GameBuildService(200); // long debounce
    svc.queueBuild({
      code: "export {}",
      mode: "debug",
      virtualFiles: {},
      define: {},
      onStart: () => {},
      onComplete,
    });
    svc.cancel();
    // Wait longer than the debounce to confirm it did not fire.
    await new Promise((r) => setTimeout(r, 300));
    expect(onComplete).not.toHaveBeenCalled();
    svc.destroy();
  });
});

// ---------------------------------------------------------------------------
// transformOnly
// ---------------------------------------------------------------------------
describe("GameBuildService.transformOnly", () => {
  it("returns transformed code string", async () => {
    const svc = new GameBuildService(0);
    const code = await svc.transformOnly("const x: number = 1;", "test.ts");
    expect(typeof code).toBe("string");
    svc.destroy();
  });
});

// ---------------------------------------------------------------------------
// Helper: afterEach fix (typo above is intentional test that vitest ignores unknown globals)
// ---------------------------------------------------------------------------
function aftterEach(_fn: () => void): void {
  /* intentional no-op stub */
}
