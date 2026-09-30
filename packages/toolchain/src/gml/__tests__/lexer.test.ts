import { describe, expect, it } from "vitest";
import { isTrivia, printTokens, tokenize } from "../lexer.js";

const sig = (src: string) =>
  tokenize(src)
    .filter((t) => !isTrivia(t) && t.kind !== "eof")
    .map((t) => [t.kind, t.text] as const);

describe("gml lexer", () => {
  it("is lossless on mixed source", () => {
    const src = `#region A\nvar x = $FF + 0x1F; // c\n/* multi\nline */ s = @"a\\b" + "q\\"r";\n#macro M 1 + \\\n 2\n#endregion\r\nz = $"a{b}c";`;
    expect(printTokens(tokenize(src))).toBe(src);
  });

  it("lexes hex, numbers and floats", () => {
    expect(sig("$FF 0xAB 0b101 1.5 .5 1e3 42")).toEqual([
      ["number", "$FF"],
      ["number", "0xAB"],
      ["number", "0b101"],
      ["number", "1.5"],
      ["number", ".5"],
      ["number", "1e3"],
      ["number", "42"],
    ]);
  });

  it("does not treat a member access on an int as a float", () => {
    expect(sig("a.b 1.x")[0]).toEqual(["ident", "a"]);
  });

  it("lexes string escapes and single quotes", () => {
    const t = sig(`"a\\"b" 'c\\'d'`);
    expect(t).toEqual([
      ["string", `"a\\"b"`],
      ["string", `'c\\'d'`],
    ]);
  });

  it("verbatim strings have no escapes", () => {
    const t = tokenize(`@"C:\\dir\\" x`).filter((x) => !isTrivia(x));
    expect(t[0]!.kind).toBe("verbatim");
    expect(t[0]!.text).toBe(`@"C:\\dir\\"`);
    expect(t[1]!.text).toBe("x");
  });

  it("template strings capture expression parts incl. nested strings/braces", () => {
    const src = `$"a {f("}")} b {x}"`;
    const [t] = tokenize(src);
    expect(t!.kind).toBe("template");
    expect(t!.end).toBe(src.length);
    const exprs = t!
      .parts!.filter((p) => p.kind === "expr")
      .map((p) => src.slice(p.start, p.end));
    expect(exprs).toEqual([`f("}")`, "x"]);
  });

  it("unterminated string and comment do not throw", () => {
    expect(
      tokenize(`x = "abc`).some(
        (t) => t.kind === "string" && t.terminated === false,
      ),
    ).toBe(true);
    expect(printTokens(tokenize("/* open"))).toBe("/* open");
  });

  it("#macro spans continuation lines; #region is trivia", () => {
    const toks = tokenize("#macro A 1 + \\\n 2\nx");
    expect(toks[0]!.kind).toBe("macro");
    expect(toks[0]!.text).toBe("#macro A 1 + \\\n 2");
    const r = tokenize("#region Foo bar\nx\n#endregion");
    expect(r.filter((t) => t.kind === "region")).toHaveLength(2);
    expect(r.filter((t) => !isTrivia(t) && t.kind !== "eof")).toHaveLength(1);
  });

  it("# only starts a directive at line start", () => {
    expect(sig("a #macro")[1]![0]).toBe("error");
  });

  it("operators: ??, ??=, <>, :=, shifts, compound", () => {
    expect(sig("a ?? b ??= c <> d := e << f >>= g").map((x) => x[1])).toEqual([
      "a",
      "??",
      "b",
      "??=",
      "c",
      "<>",
      "d",
      ":=",
      "e",
      "<<",
      "f",
      ">>=",
      "g",
    ]);
  });

  it("accessor openers and [$ vs hex array", () => {
    expect(
      sig("a[| 0] a[? k] a[# 1,2] a[@ 3] a[$ k]")
        .filter((x) => x[0] === "punct" && x[1]!.startsWith("["))
        .map((x) => x[1]),
    ).toEqual(["[|", "[?", "[#", "[@", "[$"]);
    // array literal starting with a hex number is a plain `[` + number
    expect(sig("[$FF, 1]").slice(0, 2)).toEqual([
      ["punct", "["],
      ["number", "$FF"],
    ]);
  });

  it("keywords vs identifiers, special identifiers stay identifiers", () => {
    const t = sig(
      "begin end then repeat until self other all noone global constructor static",
    );
    expect(t.map((x) => x[0])).toEqual([
      "keyword",
      "keyword",
      "keyword",
      "keyword",
      "keyword",
      "ident",
      "ident",
      "ident",
      "ident",
      "ident",
      "keyword",
      "keyword",
    ]);
  });

  it("marks nlBefore", () => {
    const t = tokenize("a\nb c").filter((x) => !isTrivia(x));
    expect(t[1]!.nlBefore).toBe(true);
    expect(t[2]!.nlBefore).toBeUndefined();
  });

  it("unknown chars become error tokens, still lossless", () => {
    const src = "a ` b \u00e9";
    expect(printTokens(tokenize(src))).toBe(src);
    expect(tokenize(src).some((t) => t.kind === "error")).toBe(true);
  });

  it("fuzz: random truncations of a corpus never throw and stay lossless", () => {
    const corpus = `enum E { A, B = 2 }\n#macro M 5\nfunction f(a, b = 1) constructor { static s = 0; self.x = $"v{a}"; }\nwith (obj_x) { hp -= 1; } switch (x) { case 1: break; default: exit; }\nvar q = @"raw" ?? 'z';`;
    for (let i = 0; i <= corpus.length; i++) {
      const s = corpus.slice(0, i);
      expect(printTokens(tokenize(s))).toBe(s);
    }
  });
});
