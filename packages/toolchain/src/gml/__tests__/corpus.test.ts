import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { printTokens, tokenize } from "../lexer.js";
import { parse } from "../parser.js";

/** Collect every `.gml` under a directory (empty when the fixture is not available). */
function collect(dir: string, out: string[] = []): string[] {
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const n of names) {
    const p = path.join(dir, n);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) collect(p, out);
    else if (n.endsWith(".gml")) out.push(p);
  }
  return out;
}

const FILES = collect(process.env["GMS_FIXTURE_DIR"] ?? "");

describe("gml corpus (set GMS_FIXTURE_DIR to a directory of a real project)", () => {
  it.skipIf(FILES.length === 0)("lexes losslessly and parses every .gml without throwing", () => {
    let recovered = 0;
    for (const f of FILES) {
      const src = readFileSync(f, "utf8");
      expect(printTokens(tokenize(src)), f).toBe(src);
      recovered += parse(src).recovered;
    }
    // Recovered statements are allowed (real projects contain invalid GML); reported, not asserted.
    console.info(`gml corpus: ${FILES.length} files, ${recovered} recovered statements`);
  });
});
