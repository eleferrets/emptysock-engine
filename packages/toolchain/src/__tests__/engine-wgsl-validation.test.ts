import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseWgsl, validate } from "naga-wasm";
import { WgslReflect } from "wgsl_reflect/wgsl_reflect.module.js";

// Headless validation of the WGSL the ENGINE ships. Engine files are read as source (the toolchain does not depend on
// pixi); the WGSL strings and the vertex generator contain no pixi imports.
// This proves naga/wgsl_reflect accept the text. It does NOT prove it renders
// on a real WebGPU device.

const engineSystems = (f: string): string =>
  fileURLToPath(new URL(`../../../engine/src/systems/${f}`, import.meta.url));

function templateConst(file: string, name: string): string {
  const src = readFileSync(engineSystems(file), "utf-8");
  const m = new RegExp(
    `export const ${name} = /\\* wgsl \\*/ \`([\\s\\S]*?)\``,
  ).exec(src);
  if (m?.[1] === undefined) throw new Error(`${name} not found in ${file}`);
  return m[1];
}

function nagaAccepts(wgsl: string): void {
  const mod = parseWgsl(wgsl);
  validate(mod);
}

describe("engine WGSL validates under naga and wgsl_reflect", () => {
  const vertex = templateConst("RainGlassWgsl.ts", "RAIN_GLASS_WGSL_VERTEX");
  const fragment = templateConst(
    "RainGlassWgsl.ts",
    "RAIN_GLASS_WGSL_FRAGMENT",
  );

  it("rain glass vertex", () => {
    nagaAccepts(vertex);
    expect(new WgslReflect(vertex).entry.vertex[0]?.name).toBe("mainVertex");
  });

  it("rain glass fragment", () => {
    nagaAccepts(fragment);
    const r = new WgslReflect(fragment);
    expect(r.entry.fragment[0]?.name).toBe("mainFragment");
    const groups = r
      .getBindGroups()
      .map((g) => g.filter(Boolean).map((b) => b.name));
    expect(groups[0]).toEqual(["uTexture", "uSampler"]);
    expect(groups[1]).toEqual(["uniforms", "uDropMap", "uDropMapSampler"]);
  });
});
