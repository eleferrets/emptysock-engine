import { describe, expect, it } from "vitest";
import { scanEnums, scanMacros } from "../scan.js";

describe("token-level scans", () => {
  it("finds enums and macros regardless of syntax errors elsewhere in the file", () => {
    const src = "x = = = ;\nwhile (( {\n#macro K 7\nenum Late { A, B }\n";
    expect(scanEnums(src).map((e) => e.name)).toEqual(["Late"]);
    expect(scanMacros(src).map((m) => [m.name, m.valueText])).toEqual([["K", "7"]]);
  });

  it("ignores declarations inside comments and strings", () => {
    const src = '// enum X { A }\n/* enum Y { B }\n#macro Z 1 */\ns = "enum W { C }"; // #macro V 2\n';
    expect(scanEnums(src)).toEqual([]);
    expect(scanMacros(src)).toEqual([]);
  });

  it("enum node offsets are absolute", () => {
    const src = "a = 1;\nenum E { A, B = 3 }";
    const [e] = scanEnums(src);
    expect(src.slice(e!.start, e!.end)).toBe("enum E { A, B = 3 }");
    expect(src.slice(e!.members[1]!.value!.start, e!.members[1]!.value!.end)).toBe("3");
  });

  it("finds an enum nested in a function body and one using begin/end", () => {
    expect(scanEnums("function f() { enum Inner { P } }\nenum B2 begin Q end").map((e) => e.name)).toEqual(["Inner", "B2"]);
  });

  it("macro with config, continuation and trailing comment", () => {
    const [m] = scanMacros("#macro Debug:LOG (1 + \\\n 2) // note\n");
    expect(m!.config).toBe("Debug");
    expect(m!.name).toBe("LOG");
    expect(m!.valueText).toBe("(1 +   2)");
  });
});
