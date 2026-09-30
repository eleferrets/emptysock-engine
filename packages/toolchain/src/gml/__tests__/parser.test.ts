import { describe, expect, it } from "vitest";
import type { Expr, Stmt } from "../ast.js";
import { isTrivia, tokenize } from "../lexer.js";
import { parse, parseExpression } from "../parser.js";

/** Compact s-expression rendering used to assert tree shape. */
function sx(n: Expr | Stmt | undefined): string {
  if (!n) return "_";
  switch (n.type) {
    case "Literal":
      return n.litKind === "string" || n.litKind === "verbatim"
        ? JSON.stringify(n.value)
        : String(n.raw);
    case "Identifier":
      return n.name;
    case "Member":
      return `(. ${sx(n.object)} ${n.property})`;
    case "Index":
      return `(idx${n.accessor} ${sx(n.object)} ${n.indices.map(sx).join(" ")})`;
    case "Call":
      return `(call ${sx(n.callee)}${n.args.map((a) => " " + sx(a)).join("")})`;
    case "New":
      return `(new ${sx(n.callee)}${n.args.map((a) => " " + sx(a)).join("")})`;
    case "Unary":
      return `(${n.op}u ${sx(n.arg)})`;
    case "Update":
      return `(${n.prefix ? "pre" : "post"}${n.op} ${sx(n.arg)})`;
    case "Binary":
      return `(${n.op} ${sx(n.left)} ${sx(n.right)})`;
    case "Assign":
      return `(${n.op} ${sx(n.left)} ${sx(n.right)})`;
    case "Conditional":
      return `(? ${sx(n.test)} ${sx(n.cons)} ${sx(n.alt)})`;
    case "ArrayLiteral":
      return `[${n.elements.map(sx).join(" ")}]`;
    case "StructLiteral":
      return `{${n.props.map((p) => `${p.key}:${sx(p.value)}`).join(" ")}}`;
    case "Paren":
      return `(paren ${sx(n.expr)})`;
    case "Delete":
      return `(delete ${sx(n.arg)})`;
    case "TemplateString":
      return `(tpl ${n.parts.map((p) => (p.kind === "text" ? JSON.stringify(p.raw) : sx(p.expr))).join(" ")})`;
    case "FunctionExpr":
      return `(fn ${n.name ?? ""} (${n.params.map((p) => p.name).join(",")})${n.isConstructor ? " ctor" : ""})`;
    case "ExprStmt":
      return sx(n.expr);
    case "VarDecl":
      return `(${n.declKind} ${n.decls.map((d) => d.name + (d.init ? "=" + sx(d.init) : "")).join(" ")})`;
    case "Block":
      return `{| ${n.body.map(sx).join(" ; ")} |}`;
    case "If":
      return `(if ${sx(n.test)} ${sx(n.cons)}${n.alt ? " else " + sx(n.alt) : ""})`;
    case "While":
      return `(while ${sx(n.test)} ${sx(n.body)})`;
    case "DoUntil":
      return `(do ${sx(n.body)} until ${sx(n.test)})`;
    case "For":
      return `(for ${sx(n.init)} ${sx(n.test)} ${sx(n.update)} ${sx(n.body)})`;
    case "Repeat":
      return `(repeat ${sx(n.count)} ${sx(n.body)})`;
    case "With":
      return `(with ${sx(n.target)} ${sx(n.body)})`;
    case "Switch":
      return `(switch ${sx(n.discriminant)} ${n.cases.map((c) => `[${c.test ? sx(c.test) : "default"}: ${c.body.map(sx).join(" ; ")}]`).join(" ")})`;
    case "Return":
      return `(return ${sx(n.arg)})`;
    case "Exit":
      return "(exit)";
    case "Break":
      return "(break)";
    case "Continue":
      return "(continue)";
    case "Throw":
      return `(throw ${sx(n.arg)})`;
    case "Try":
      return `(try ${sx(n.block)} catch(${n.param ?? ""}) ${sx(n.handler)} finally ${sx(n.finalizer)})`;
    case "FunctionDecl":
      return `(function ${n.name} (${n.params.map((p) => p.name + (p.default ? "=" + sx(p.default) : "")).join(",")})${n.parent ? ` :${n.parent.name}(${n.parent.args.map(sx).join(",")})` : ""}${n.isConstructor ? " ctor" : ""} ${sx(n.body)})`;
    case "EnumDecl":
      return `(enum ${n.name} ${n.members.map((m) => m.name + (m.value ? "=" + sx(m.value) : "")).join(" ")})`;
    case "MacroDecl":
      return `(macro ${n.config ? n.config + ":" : ""}${n.name} ${n.valueText})`;
    case "Empty":
      return "(empty)";
    case "ErrorStmt":
      return "(ERROR)";
  }
}

const prog = (src: string) => parse(src).ast.body.map(sx);
const one = (src: string) => {
  const r = parse(src);
  expect(r.diagnostics).toEqual([]);
  return sx(r.ast.body[0]);
};

describe("gml parser: expressions", () => {
  it("precedence and associativity", () => {
    expect(one("x = 1 + 2 * 3;")).toBe("(= x (+ 1 (* 2 3)))");
    expect(one("x = a || b && c;")).toBe("(= x (|| a (&& b c)))");
    expect(one("x = a << 1 + 2 & 3;")).toBe("(= x (& (<< a (+ 1 2)) 3))");
    expect(one("x = a < b == c;")).toBe("(= x (== (< a b) c))");
    expect(one("x = a ? b : c ? d : e;")).toBe("(= x (? a b (? c d e)))");
    expect(one("x = a ?? b ? c : d;")).toBe("(= x (? (?? a b) c d))");
  });

  it("word operators normalise", () => {
    expect(one("x = a and b or c xor d;")).toBe(
      "(= x (^^ (|| (&& a b) c) d))".replace(
        "(^^ (|| (&& a b) c) d)",
        "(|| (&& a b) (^^ c d))",
      ),
    );
    expect(one("x = a mod b div c;")).toBe("(= x (div (% a b) c))");
    expect(one("x = not a;")).toBe("(= x (!u a))");
    expect(one("x = a <> b;")).toBe("(= x (!= a b))");
  });

  it("= is comparison inside expressions but assignment at statement level", () => {
    expect(one("if (a = b) c = 1;")).toBe("(if (paren (== a b)) (= c 1))");
    expect(one("x = (a = b);")).toBe("(= x (paren (== a b)))");
    expect(one("x = a = b;")).toBe("(= x (== a b))");
    expect(one("f(a = 1);")).toBe("(call f (== a 1))");
    const r = parse("if (a = b) {}");
    const cond = (r.ast.body[0] as Extract<Stmt, { type: "If" }>).test;
    expect(cond.type).toBe("Paren");
  });

  it("compound assignment and nullish assign", () => {
    expect(one("a += 2;")).toBe("(+= a 2)");
    expect(one("a ??= 2;")).toBe("(??= a 2)");
    expect(one("a := 3;")).toBe("(= a 3)");
    expect(one("a.b[0] <<= 1;")).toBe("(<<= (idx[ (. a b) 0) 1)");
  });

  it("literals: hex, template strings, verbatim, escapes, booleans", () => {
    expect(one("x = $FF;")).toBe("(= x $FF)");
    const r = parse("x = $FF + 0x10 + 0b11;");
    const a = (r.ast.body[0] as Extract<Stmt, { type: "ExprStmt" }>)
      .expr as Extract<Expr, { type: "Assign" }>;
    const lits: number[] = [];
    (function walk(e: Expr) {
      if (e.type === "Binary") {
        walk(e.left);
        walk(e.right);
      } else if (e.type === "Literal") lits.push(e.value as number);
    })(a.right);
    expect(lits).toEqual([255, 16, 3]);
    expect(one('x = "a\\nb\\"c";')).toBe('(= x "a\\nb\\"c")');
    expect(one('x = @"a\\b";')).toBe('(= x "a\\\\b")');
    expect(one("x = true; ")).toBe("(= x true)");
    expect(one('x = $"hi {name}, {a + 1}!";')).toBe(
      '(= x (tpl "hi " name ", " (+ a 1) "!"))',
    );
    expect(one('x = $"{f("}")}";')).toBe('(= x (tpl (call f "}")))');
  });

  it("template expression offsets are absolute", () => {
    const src = 'y = 1;\nx = $"a{foo}";';
    const r = parse(src);
    const t = (
      (r.ast.body[1] as Extract<Stmt, { type: "ExprStmt" }>).expr as Extract<
        Expr,
        { type: "Assign" }
      >
    ).right as Extract<Expr, { type: "TemplateString" }>;
    const part = t.parts.find((p) => p.kind === "expr")! as Extract<
      (typeof t.parts)[number],
      { kind: "expr" }
    >;
    expect(src.slice(part.expr!.start, part.expr!.end)).toBe("foo");
    expect(src.slice(part.start, part.end)).toBe("foo");
  });

  it("member, call, index accessors", () => {
    expect(one("x = global.score;")).toBe("(= x (. global score))");
    expect(one("x = other.id;")).toBe("(= x (. other id))");
    expect(one("x = list[| 3];")).toBe("(= x (idx| list 3))");
    expect(one('x = m[? "k"];')).toBe('(= x (idx? m "k"))');
    expect(one("x = g[# 1, 2];")).toBe("(= x (idx# g 1 2))");
    expect(one("x = a[@ 1];")).toBe("(= x (idx@ a 1))");
    expect(one('x = s[$ "k"];')).toBe('(= x (idx$ s "k"))');
    expect(one("x = a[1][2];")).toBe("(= x (idx[ (idx[ a 1) 2))");
    expect(one("obj.method(1, 2);")).toBe("(call (. obj method) 1 2)");
  });

  it("struct and array literals; struct key `id:` is not an expression", () => {
    expect(one('s = { id: 1, name: "n", nested: { a: [1, 2, ] } };')).toBe(
      '(= s {id:1 name:"n" nested:{a:[1 2]}})',
    );
    const r = parse("s = { id: other.id };");
    expect(r.diagnostics).toEqual([]);
  });

  it("functions, constructors, inheritance, defaults", () => {
    expect(one("f = function(a, b) { return a; };")).toBe("(= f (fn  (a,b)))");
    expect(one("function Foo(a, b = 2) constructor { x = a; }")).toBe(
      "(function Foo (a,b=2) ctor {| (= x a) |})",
    );
    expect(one("function Bar(a) : Foo(a, 1) constructor { }")).toBe(
      "(function Bar (a) :Foo(a,1) ctor {|  |})",
    );
    expect(one("o = new Foo(1, 2);")).toBe("(= o (new Foo 1 2))");
    expect(one("o = new Foo;")).toBe("(= o (new Foo))");
    expect(one("delete o;")).toBe("(delete o)");
  });

  it("increment/decrement", () => {
    expect(one("i++;")).toBe("(post++ i)");
    expect(one("--i;")).toBe("(pre-- i)");
  });

  it("parseExpression helper", () => {
    expect(sx(parseExpression("1 << 2 | 3"))).toBe("(| (<< 1 2) 3)");
    expect(parseExpression("1 +")).toBeUndefined();
  });
});

describe("gml parser: statements", () => {
  it("var forms, static, globalvar", () => {
    expect(one("var a = 1, b, c = a + 1;")).toBe("(var a=1 b c=(+ a 1))");
    expect(one("static n = 0;")).toBe("(static n=0)");
    expect(one("globalvar gx, gy;")).toBe("(globalvar gx gy)");
  });

  it("if / else with and without parens, then, brace-less bodies, begin/end", () => {
    expect(one("if a > b { x = 1; } else { x = 2; }")).toBe(
      "(if (> a b) {| (= x 1) |} else {| (= x 2) |})",
    );
    expect(one("if (a) x = 1; else x = 2;")).toBe(
      "(if (paren a) (= x 1) else (= x 2))",
    );
    expect(one("if (a) then x = 1")).toBe("(if (paren a) (= x 1))");
    expect(one("if (a) begin x = 1; end")).toBe("(if (paren a) {| (= x 1) |})");
    expect(one("if (a) (b) ? c() : d();")).not.toContain("ERROR");
    expect(one("if (a) && (b) { }")).toBe(
      "(if (&& (paren a) (paren b)) {|  |})",
    );
  });

  it("does not treat `if (a) (b)` as a call", () => {
    const r = parse("if (a) (b).c = 1;");
    expect(r.diagnostics).toEqual([]);
    expect(sx(r.ast.body[0])).toBe("(if (paren a) (= (. (paren b) c) 1))");
  });

  it("loops: for, while, repeat, do/until", () => {
    expect(one("for (var i = 0; i < 10; i++) { s += i; }")).toBe(
      "(for (var i=0) (< i 10) (post++ i) {| (+= s i) |})",
    );
    expect(one("for (;;) break;")).toBe("(for _ _ _ (break))");
    expect(one("for (i = 0; i < n; i += 2) x++;")).toBe(
      "(for (= i 0) (< i n) (+= i 2) (post++ x))",
    );
    expect(one("while (a) a--;")).toBe("(while (paren a) (post-- a))");
    expect(one("repeat (3) { x++; }")).toBe(
      "(repeat (paren 3) {| (post++ x) |})",
    );
    expect(one("repeat 3 x++;")).toBe("(repeat 3 (post++ x))");
    expect(one("do { x++; } until (x > 5);")).toBe(
      "(do {| (post++ x) |} until (paren (> x 5)))",
    );
    expect(one("do x++; until x > 5")).toBe("(do (post++ x) until (> x 5))");
  });

  it("with, incl. self/other/all/noone/global targets", () => {
    expect(one("with (obj_enemy) { hp -= 1; }")).toBe(
      "(with (paren obj_enemy) {| (-= hp 1) |})",
    );
    expect(one("with (all) x = 0;")).toBe("(with (paren all) (= x 0))");
    expect(one("with (other) { y = self.x; }")).toBe(
      "(with (paren other) {| (= y (. self x)) |})",
    );
    expect(one("with (noone) {}")).toBe("(with (paren noone) {|  |})");
    expect(one("global.g = 5;")).toBe("(= (. global g) 5)");
  });

  it("switch with fallthrough, default and multiple statements", () => {
    const s = one(
      "switch (x) { case 1: case 2: a = 1; break; case E.X: b = 2; default: exit; }",
    );
    expect(s).toBe(
      "(switch (paren x) [1: ] [2: (= a 1) ; (break)] [(. E X): (= b 2)] [default: (exit)])",
    );
  });

  it("try / catch / finally / throw", () => {
    expect(one("try { a(); } catch (e) { b(e); } finally { c(); }")).toBe(
      "(try {| (call a) |} catch(e) {| (call b e) |} finally {| (call c) |})",
    );
    expect(one('throw "x";')).toBe('(throw "x")');
  });

  it("enum with expressions, comments, trailing comma", () => {
    expect(
      one("enum E { A, /* c } */ B = 1 << 2, C = A | B, // }\n D, }"),
    ).toBe("(enum E A B=(<< 1 2) C=(| A B) D)");
  });

  it("#macro (incl. config and continuation) and #region", () => {
    const p = prog(
      "#macro MAXHP 100\n#macro Debug:LOG 1 + \\\n 2\n#region stuff\nx = MAXHP;\n#endregion",
    );
    expect(p).toEqual([
      "(macro MAXHP 100)",
      "(macro Debug:LOG 1 +   2)",
      "(= x MAXHP)",
    ]);
    const r = parse("#macro K (1 + 2) // trailing\n");
    const m = r.ast.body[0] as Extract<Stmt, { type: "MacroDecl" }>;
    expect(m.valueText).toBe("(1 + 2)");
    expect(m.value?.type).toBe("Paren");
  });

  it("legacy syntax mix: begin/end, then, optional semicolons, string-concat", () => {
    const p = prog('if (a) then\nbegin\n x = 1\n y = 2\nend\nz = "a" + "b"');
    expect(p).toEqual([
      "(if (paren a) {| (= x 1) ; (= y 2) |})",
      '(= z (+ "a" "b"))',
    ]);
  });

  it("static inside constructor and method definitions", () => {
    const s = one(
      "function C() constructor { static count = 0; hp = 1; hit = function(d) { hp -= d; }; }",
    );
    expect(s).toContain("(static count=0)");
    expect(s).toContain("(fn  (d))");
  });

  it("noone / undefined comparisons", () => {
    expect(one("if (inst == noone || v == undefined) exit;")).toBe(
      "(if (paren (|| (== inst noone) (== v undefined))) (exit))",
    );
  });
});

describe("gml parser: error recovery", () => {
  it("recovers per statement and keeps parsing", () => {
    const r = parse("a = 1;\nb = = ;\nc = 3;\nd = (1 + ;\ne = 5;");
    expect(r.recovered).toBeGreaterThanOrEqual(2);
    const shapes = r.ast.body.map(sx);
    expect(shapes[0]).toBe("(= a 1)");
    expect(shapes).toContain("(= c 3)");
    expect(shapes).toContain("(= e 5)");
    expect(shapes.filter((s) => s === "(ERROR)").length).toBe(r.recovered);
  });

  it("an error inside a block does not lose the block or later statements", () => {
    const r = parse("if (x) {\n a = 1;\n b = ) ;\n c = 2;\n}\nd = 4;");
    const shapes = r.ast.body.map(sx);
    expect(shapes[0]).toBe("(if (paren x) {| (= a 1) ; (ERROR) ; (= c 2) |})");
    expect(shapes[1]).toBe("(= d 4)");
  });

  it("stray closers and keywords make progress", () => {
    const r = parse("} end else x = 1;");
    expect(r.ast.body.map(sx)).toEqual([
      "(ERROR)",
      "(ERROR)",
      "(ERROR)",
      "(= x 1)",
    ]);
  });

  it("unterminated block reports a diagnostic, does not throw", () => {
    const r = parse("function f() { x = 1;");
    expect(r.diagnostics.length).toBeGreaterThan(0);
    expect(r.ast.body[0]!.type).toBe("FunctionDecl");
  });

  it("fuzz: every truncation of a corpus parses without throwing, always terminates", () => {
    const corpus = [
      'enum E { A, B = 2 }\n#macro M 5\nfunction f(a, b = 1) : P(a) constructor { static s = 0; self.x = $"v{a}"; }',
      "with (obj_x) { hp -= 1; if (a = b) { other.hp ??= 3; } } switch (x) { case 1: break; default: exit; }",
      "var q = @\"raw\" ?? 'z'; repeat (3) do { i++ } until i > 2; try { throw {a: [1,2]}; } catch (e) {} finally {}",
    ].join("\n");
    for (let i = 0; i <= corpus.length; i++) {
      const r = parse(corpus.slice(0, i));
      expect(r.ast.type).toBe("Program");
    }
  });

  it("fuzz: random token soup never throws", () => {
    const words = [
      "if",
      "(",
      ")",
      "{",
      "}",
      "=",
      "x",
      "1",
      ";",
      "else",
      "end",
      "begin",
      "function",
      "with",
      "case",
      ":",
      "[",
      "]",
      ".",
      '$"a{',
      '}"',
      "var",
      ",",
      "??",
      "#macro Q",
      "\n",
      "switch",
      "enum",
      "try",
      "catch",
      "do",
      "until",
      "new",
      "then",
    ];
    let seed = 12345;
    const rnd = () =>
      (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let k = 0; k < 300; k++) {
      const n = 1 + Math.floor(rnd() * 25);
      let src = "";
      for (let j = 0; j < n; j++)
        src += words[Math.floor(rnd() * words.length)] + " ";
      expect(() => parse(src)).not.toThrow();
    }
  });
});

describe("gml parser: source coverage", () => {
  it("every significant token lies inside some top-level statement range", () => {
    const src = `#macro A 1\nenum E { X, Y }\nfunction f(a) { with (o) { hp -= a; } }\nvar s = $"x{f(1)}";\nb = = ;\nswitch (q) { case 1: break; }`;
    const r = parse(src);
    for (const t of tokenize(src)) {
      if (isTrivia(t) || t.kind === "eof") continue;
      expect(r.ast.body.some((s) => s.start <= t.start && t.end <= s.end)).toBe(
        true,
      );
    }
  });

  it("node ranges slice back to their source text", () => {
    const src = "x = foo.bar(1, [2, 3]);";
    const r = parse(src);
    const stmt = r.ast.body[0] as Extract<Stmt, { type: "ExprStmt" }>;
    const a = stmt.expr as Extract<Expr, { type: "Assign" }>;
    expect(src.slice(a.right.start, a.right.end)).toBe("foo.bar(1, [2, 3])");
    expect(src.slice(stmt.start, stmt.end)).toBe(src);
  });
});
