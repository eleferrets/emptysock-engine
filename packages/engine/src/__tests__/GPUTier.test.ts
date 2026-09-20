import { describe, it, expect } from "vitest";
import { detectGPUTier, classifyRenderer } from "../core/GPUTier.js";
import type { GPUTierAdapter } from "../core/GPUTier.js";
import type { GPUTier } from "@emptysock/types";
import { NullHostAdapter } from "@emptysock/types";

/**
 * Build a mock adapter that returns a specific GPU tier. Typed as
 * GPUTierAdapter (the minimal slice detectGPUTier needs) rather than the
 * full HostAdapter — detectGPUTier doesn't touch postMessage/message
 * listeners/timers, so the mock shouldn't have to supply them either.
 */
function makeAdapter(tier: GPUTier): GPUTierAdapter {
  return {
    detectGPUTier: () => tier,
  };
}

describe("detectGPUTier", () => {
  it("delegates to the adapter and returns its tier", () => {
    expect(detectGPUTier(makeAdapter("ultra"))).toBe("ultra");
    expect(detectGPUTier(makeAdapter("high"))).toBe("high");
    expect(detectGPUTier(makeAdapter("potato"))).toBe("potato");
  });

  it("NullHostAdapter returns mid", () => {
    expect(detectGPUTier(new NullHostAdapter())).toBe("mid");
  });
});

describe("classifyRenderer", () => {
  it('"RTX 4090" renderer → ultra', () => {
    expect(classifyRenderer("NVIDIA GeForce RTX 4090")).toBe("ultra");
  });

  it('"GTX 1060" renderer → high', () => {
    expect(classifyRenderer("NVIDIA GeForce GTX 1060")).toBe("high");
  });

  it("SwiftShader → potato", () => {
    expect(classifyRenderer("Google SwiftShader")).toBe("potato");
  });

  it("unknown renderer → mid", () => {
    expect(classifyRenderer("Some Unknown GPU XYZ")).toBe("mid");
  });
});
