// Guard: the committed compat parameter-kind table must equal a fresh read of
// the engine's compat declarations (run `node scripts/compat-signatures.mjs`).
// @vitest-environment node
import { readFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import { describe, expect, it } from "vitest";
import { generate, OUT, render } from "./compat-signatures.mjs";

describe("compat-signatures", () => {
  it("matches the engine's compat declarations", async () => {
    const fresh = await format(render(generate()), {
      ...(await resolveConfig(OUT)),
      filepath: OUT,
    });
    expect(readFileSync(OUT, "utf8")).toBe(fresh);
  });
});
