/**
 * Project-wide symbol table and per-file scope analysis for GML.
 *
 * `buildProjectSymbols` is a pure function: it holds no module-level state, so
 * parallel imports/tests cannot collide (unlike the `set*` installers it is
 * meant to replace). `analyzeFile` resolves every identifier of one file
 * against a `ProjectSymbols`.
 */

import type {
  EnumDecl,
  Expr,
  FunctionDecl,
  FunctionExpr,
  Identifier,
  MacroDecl,
  Program,
  Stmt,
} from "./ast.js";
import {
  TRANSPILER_RESERVED_IDENTIFIERS,
  builtinConstant,
  isKnownBuiltinName,
  lookupBuiltin,
} from "./builtins.js";
import { isTrivia, tokenize } from "./lexer.js";
import { parse } from "./parser.js";
import { scanEnums, scanMacros } from "./scan.js";
import {
  Scope,
  type AssetKind,
  type FieldSource,
  type OuterResolver,
  type Resolved,
  type Symbol,
} from "./symbols.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FieldInfo {
  name: string;
  isArray: boolean;
  holdsEntity: boolean;
  /** Paths of the files that assign this field. */
  writers: string[];
}

export interface ObjectInfo {
  name: string;
  /** Instance variables assigned by this object's own event files. */
  instanceFields: ReadonlyMap<string, FieldInfo>;
  /** Fields assigned from other files through `with (this)` or `this.field = ...`. */
  externalFields: ReadonlyMap<string, FieldInfo>;
  files: string[];
}

export interface EnumInfo {
  name: string;
  members: ReadonlyMap<string, number>;
}

export interface MacroInfo {
  /** Map key: `NAME`, or `Config:NAME` for a config-scoped macro. */
  key: string;
  name: string;
  config?: string;
  valueText: string;
  file: string;
}

export interface Diagnostic {
  kind: "shadow" | "unresolved" | "asset-collision" | "parse";
  message: string;
  file?: string;
  range?: [number, number];
}

export interface SourceFile {
  path: string;
  text: string;
  /** Object whose event this is (its `self`). */
  object?: string;
  /** Script parameter names, when known. */
  params?: readonly string[];
  kind?: "object" | "script" | "other";
}

export interface ProjectInput {
  assets?: Partial<Record<AssetKind, Iterable<string>>>;
  missing?: Partial<Record<"font" | "sprite" | "object", Iterable<string>>>;
  files?: readonly SourceFile[];
}

export interface FileFacts {
  /** Every `var`/`static`/`globalvar`-declared name. */
  locals: ReadonlySet<string>;
  /** Instance variables the file assigns on its own `self`. */
  selfWrites: ReadonlyMap<string, { isArray: boolean; holdsEntity: boolean }>;
  /** Assignments made inside `with` bodies or through `object.field`; `target` is undefined when the with target is not a known object. */
  externalWrites: ReadonlyArray<{
    target: string | undefined;
    field: string;
    isArray: boolean;
    holdsEntity: boolean;
  }>;
  /** `global.name` assignments. */
  globalWrites: ReadonlySet<string>;
  /** Names assigned exactly `other.id` (variable, field or `var` initialiser) inside any `with` body, at any nesting depth. */
  entityFieldsFromWith: ReadonlySet<string>;
  /**
   * Owner-agnostic bare `name = expr` targets that are not lexical locals/parameters/functions
   * and not reserved words: the historical "undeclared assignment" set (built-in and asset names
   * included, `with`-body and constructor-body assignments included).
   */
  implicitScalars: ReadonlySet<string>;
  /** Owner-agnostic `name[..] = expr` targets (any accessor except `[|` / `[?`) under the same rules. */
  implicitArrays: ReadonlySet<string>;
}

export interface FileAnalysis {
  ast: Program;
  recovered: number;
  facts: FileFacts;
  /** Resolution of an identifier node of `ast` (undefined for nodes that are not references, e.g. member names). */
  resolve(node: Identifier): Resolved | undefined;
  /** All identifier references with their resolution, in source order. */
  references: ReadonlyArray<{ node: Identifier; resolved: Resolved }>;
  diagnostics: Diagnostic[];
}

export interface ProjectSymbols {
  assets(kind?: AssetKind): ReadonlyMap<string, Symbol>;
  lookupAsset(name: string): { symbol?: Symbol; collisions: AssetKind[] };
  object(name: string): ObjectInfo | undefined;
  objects(): ReadonlyMap<string, ObjectInfo>;
  enums(): ReadonlyMap<string, EnumInfo>;
  macros(): ReadonlyMap<string, MacroInfo>;
  /** Script-level functions/constructors declared in `script` files. */
  functions(): ReadonlyMap<string, Symbol>;
  /** Field names that some `with` body assigns an entity reference to. */
  crossFileEntityRefFields(): ReadonlySet<string>;
  /** Instance variables assigned by script files' own bodies. */
  scriptInstanceVars(): ReadonlySet<string>;
  references(name: string): ReadonlyArray<{ file: string; start: number; end: number }>;
  diagnostics: readonly Diagnostic[];
  /** Analysis of an input file (as of the final build pass). */
  file(path: string): FileAnalysis | undefined;
  analyze(file: SourceFile): FileAnalysis;
  /** Resolve a name outside any file scope (project symbols, then builtins). */
  resolveOuter(name: string): Resolved;
}

// ---------------------------------------------------------------------------
// Enum constant folding
// ---------------------------------------------------------------------------

/** Evaluate a constant numeric expression; `undefined` when it cannot be resolved statically. */
export function evaluateConstExpr(
  e: Expr,
  lookup: (ident: string, member?: string) => number | undefined,
): number | undefined {
  switch (e.type) {
    case "Literal":
      return e.litKind === "number" ? (e.value as number) : undefined;
    case "Paren":
      return evaluateConstExpr(e.expr, lookup);
    case "Identifier":
      return lookup(e.name);
    case "Member":
      return e.object.type === "Identifier" ? lookup(e.object.name, e.property) : undefined;
    case "Unary": {
      const v = evaluateConstExpr(e.arg, lookup);
      if (v === undefined) return undefined;
      if (e.op === "-") return -v;
      if (e.op === "+") return v;
      if (e.op === "~") return ~v;
      return undefined;
    }
    case "Binary": {
      const a = evaluateConstExpr(e.left, lookup);
      const b = evaluateConstExpr(e.right, lookup);
      if (a === undefined || b === undefined) return undefined;
      switch (e.op) {
        case "+":
          return a + b;
        case "-":
          return a - b;
        case "*":
          return a * b;
        case "/":
          return b === 0 ? undefined : a / b;
        case "div":
          return b === 0 ? undefined : Math.trunc(a / b);
        case "%":
          return b === 0 ? undefined : a % b;
        case "<<":
          return a << b;
        case ">>":
          return a >> b;
        case "&":
          return a & b;
        case "|":
          return a | b;
        case "^":
          return a ^ b;
        default:
          return undefined;
      }
    }
    default:
      return undefined;
  }
}

/** Members of one enum declaration: implicit `previous + 1`, explicit `= expr` overrides, unresolvable overrides skipped. */
export function evaluateEnumDecl(
  decl: EnumDecl,
  known: ReadonlyMap<string, ReadonlyMap<string, number>> = new Map(),
): Map<string, number> {
  const members = new Map<string, number>();
  let next = 0;
  for (const m of decl.members) {
    if (!m.value) {
      members.set(m.name, next);
      next += 1;
      continue;
    }
    const v = evaluateConstExpr(m.value, (id, member) => {
      if (member === undefined) return members.get(id);
      return (id === decl.name ? members : known.get(id))?.get(member);
    });
    if (v === undefined) continue;
    members.set(m.name, v);
    next = v + 1;
  }
  return members;
}

// ---------------------------------------------------------------------------
// Statement walking helpers
// ---------------------------------------------------------------------------

/** Every statement of `stmts`, depth-first (descends into function declaration bodies too). */
export function walkStatements(stmts: readonly Stmt[], visit: (s: Stmt) => void): void {
  for (const s of stmts) walkStmt(s, visit);
}

function walkStmt(s: Stmt, visit: (s: Stmt) => void): void {
  visit(s);
  switch (s.type) {
    case "Block":
      walkStatements(s.body, visit);
      break;
    case "If":
      walkStmt(s.cons, visit);
      if (s.alt) walkStmt(s.alt, visit);
      break;
    case "While":
    case "DoUntil":
    case "Repeat":
    case "With":
      walkStmt(s.body, visit);
      break;
    case "For":
      if (s.init) walkStmt(s.init, visit);
      if (s.update) walkStmt(s.update, visit);
      walkStmt(s.body, visit);
      break;
    case "Switch":
      for (const c of s.cases) walkStatements(c.body, visit);
      break;
    case "Try":
      walkStmt(s.block, visit);
      if (s.handler) walkStmt(s.handler, visit);
      if (s.finalizer) walkStmt(s.finalizer, visit);
      break;
    case "FunctionDecl":
      walkStmt(s.body, visit);
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// File analysis
// ---------------------------------------------------------------------------

/** `other.id`, the one right-hand side that marks a `with` body field as holding the outer instance. */
function isOtherId(e: Expr): boolean {
  while (e.type === "Paren") e = e.expr;
  return (
    e.type === "Member" && e.property === "id" && e.object.type === "Identifier" && e.object.name === "other"
  );
}

type Owner =
  | { kind: "self" }
  | { kind: "object"; name: string }
  | { kind: "unknown" }
  | { kind: "struct" };

class FileWalker {
  readonly locals = new Set<string>();
  readonly selfWrites = new Map<string, { isArray: boolean; holdsEntity: boolean }>();
  readonly externalWrites: Array<{
    target: string | undefined;
    field: string;
    isArray: boolean;
    holdsEntity: boolean;
  }> = [];
  readonly globalWrites = new Set<string>();
  readonly entityFieldsFromWith = new Set<string>();
  readonly implicitScalars = new Set<string>();
  readonly implicitArrays = new Set<string>();
  readonly references: Array<{ node: Identifier; resolved: Resolved }> = [];
  private owner: Owner = { kind: "self" };
  private withDepth = 0;
  private scope!: Scope;

  constructor(
    private readonly file: SourceFile,
    private readonly project: ProjectImpl,
    private readonly ownFields: ReadonlyMap<string, unknown>,
  ) {}

  run(ast: Program): void {
    const objInfo = this.file.object ? this.project.objectFieldSource(this.file.object) : undefined;
    const own = this.ownFields;
    const fields: FieldSource = {
      has: (n) => own.has(n) || (objInfo?.has(n) ?? false),
      get: (n) => {
        const s = objInfo?.get(n);
        if (s) return s;
        return own.has(n) ? { name: n, kind: "instance" } : undefined;
      },
    };
    this.scope = new Scope("event", undefined, fields, this.project);
    if (this.file.params) for (const p of this.file.params) this.scope.declare({ name: p, kind: "parameter" });
    this.stmts(ast.body);
  }

  // ---- scopes ----
  private push(kind: "block" | "function" | "with" | "struct", fields?: FieldSource): void {
    this.scope = new Scope(kind, this.scope, fields);
  }
  private pop(): void {
    this.scope = this.scope.parent!;
  }

  // ---- statements ----
  private stmts(list: readonly Stmt[]): void {
    for (const s of list) this.stmt(s);
  }

  private stmt(s: Stmt): void {
    switch (s.type) {
      case "VarDecl": {
        for (const d of s.decls) {
          if (d.init) this.expr(d.init);
          if (d.init && this.withDepth > 0 && isOtherId(d.init)) this.entityFieldsFromWith.add(d.name);
          this.locals.add(d.name);
          const holds = d.init ? this.isEntityExpr(d.init) : false;
          const sym: Symbol = {
            name: d.name,
            kind: s.declKind === "globalvar" ? "global" : s.declKind === "static" ? "static" : "local",
            ...(holds ? { holdsEntity: true, type: "instance" as const } : {}),
            ...(d.init?.type === "ArrayLiteral" ? { type: "array" as const } : {}),
            decl: { file: this.file.path, range: [d.start, d.end] },
          };
          this.scope.functionScope().declare(sym);
        }
        break;
      }
      case "ExprStmt":
        this.expr(s.expr);
        break;
      case "Block":
        this.push("block");
        this.stmts(s.body);
        this.pop();
        break;
      case "If":
        this.expr(s.test);
        this.stmt(s.cons);
        if (s.alt) this.stmt(s.alt);
        break;
      case "While":
        this.expr(s.test);
        this.stmt(s.body);
        break;
      case "DoUntil":
        this.stmt(s.body);
        this.expr(s.test);
        break;
      case "Repeat":
        this.expr(s.count);
        this.stmt(s.body);
        break;
      case "For":
        this.push("block");
        if (s.init) this.stmt(s.init);
        if (s.test) this.expr(s.test);
        if (s.update) this.stmt(s.update);
        this.stmt(s.body);
        this.pop();
        break;
      case "With":
        this.withStmt(s);
        break;
      case "Switch":
        this.expr(s.discriminant);
        this.push("block");
        for (const c of s.cases) {
          if (c.test) this.expr(c.test);
          this.stmts(c.body);
        }
        this.pop();
        break;
      case "Return":
        if (s.arg) this.expr(s.arg);
        break;
      case "Throw":
        this.expr(s.arg);
        break;
      case "Try":
        this.stmt(s.block);
        if (s.handler) {
          this.push("block");
          if (s.param) this.scope.declare({ name: s.param, kind: "local" });
          this.stmts(s.handler.body);
          this.pop();
        }
        if (s.finalizer) this.stmt(s.finalizer);
        break;
      case "FunctionDecl":
        this.func(s);
        break;
      default:
        break;
    }
  }

  private withStmt(s: Extract<Stmt, { type: "With" }>): void {
    this.expr(s.target);
    const savedOwner = this.owner;
    let target: string | undefined;
    let fields: FieldSource | undefined;
    let t = s.target;
    while (t.type === "Paren") t = t.expr;
    if (t.type === "Identifier") {
      if (t.name === "self") {
        // `with (self)` keeps the current owner and fields
        this.push("block");
        this.stmt(s.body);
        this.pop();
        return;
      }
      const r = this.scope.resolve(t.name);
      if (r.via === "project" && r.symbol?.kind === "asset" && r.symbol.assetKind === "object") {
        target = t.name;
        fields = this.project.objectFieldSource(t.name);
      }
    }
    this.owner = target ? { kind: "object", name: target } : { kind: "unknown" };
    this.withDepth++;
    this.push("with", fields);
    this.stmt(s.body);
    this.pop();
    this.withDepth--;
    this.owner = savedOwner;
  }

  private func(f: FunctionDecl | FunctionExpr): void {
    if (f.type === "FunctionDecl") {
      this.scope.functionScope().declare({
        name: f.name,
        kind: f.isConstructor ? "constructor" : "function",
        decl: { file: this.file.path, range: [f.start, f.end] },
      });
    }
    const savedOwner = this.owner;
    if (f.isConstructor) this.owner = { kind: "struct" };
    this.push(f.isConstructor ? "struct" : "function");
    for (const p of f.params) {
      if (p.default) this.expr(p.default);
      this.scope.declare({ name: p.name, kind: "parameter" });
    }
    if (f.parent) for (const a of f.parent.args) this.expr(a);
    this.stmts(f.body.body);
    this.pop();
    this.owner = savedOwner;
  }

  // ---- expressions ----
  private isEntityExpr(e: Expr): boolean {
    switch (e.type) {
      case "Paren":
        return this.isEntityExpr(e.expr);
      case "Call":
        return e.callee.type === "Identifier" && lookupBuiltin(e.callee.name)?.returns === "instance";
      case "Member":
        return e.object.type === "Identifier" && e.object.name === "other" && e.property === "id";
      case "Identifier": {
        if (e.name === "self") return true;
        if (e.name === "id") return this.withDepth > 0;
        const r = this.scope.resolve(e.name);
        return r.symbol?.holdsEntity === true;
      }
      default:
        return false;
    }
  }

  private recordWrite(name: string, isArray: boolean, holdsEntity: boolean, viaSelf: boolean): void {
    const o = this.owner;
    if (o.kind === "struct") return;
    if (o.kind === "self" || (viaSelf && o.kind !== "object" && o.kind !== "unknown")) {
      const prev = this.selfWrites.get(name);
      this.selfWrites.set(name, {
        isArray: (prev?.isArray ?? false) || isArray,
        holdsEntity: (prev?.holdsEntity ?? false) || holdsEntity,
      });
    } else {
      this.externalWrites.push({
        target: o.kind === "object" ? o.name : undefined,
        field: name,
        isArray,
        holdsEntity,
      });
    }
  }

  private assign(e: Extract<Expr, { type: "Assign" }>): void {
    const right = e.right;
    this.expr(right);
    if (e.op === "=" && this.withDepth > 0 && isOtherId(right)) {
      let t = e.left;
      while (t.type === "Paren") t = t.expr;
      if (t.type === "Identifier") this.entityFieldsFromWith.add(t.name);
      else if (t.type === "Member") this.entityFieldsFromWith.add(t.property);
    }
    const holds = e.op === "=" || e.op === "??=" ? this.isEntityExpr(right) : false;
    const isArr = right.type === "ArrayLiteral";
    let l = e.left;
    while (l.type === "Paren") l = l.expr;
    if (l.type === "Identifier") {
      const r = this.scope.resolve(l.name);
      this.references.push({ node: l, resolved: r });
      const plain = e.op === "=" || e.op === "??=";
      if (e.op === "=" && r.via !== "lexical" && !TRANSPILER_RESERVED_IDENTIFIERS.has(l.name)) {
        this.implicitScalars.add(l.name);
      }
      if (plain && (r.via === "none" || r.via === "instance" || r.via === "with")) {
        this.recordWrite(l.name, isArr, holds, false);
        if (holds && r.symbol) r.symbol.holdsEntity = true;
      } else if (plain && r.via === "lexical" && r.symbol) {
        if (holds) r.symbol.holdsEntity = true;
      }
      return;
    }
    if (l.type === "Index") {
      let base: Expr = l.object;
      while (base.type === "Paren" || base.type === "Index") base = base.type === "Paren" ? base.expr : base.object;
      if (base.type === "Identifier") {
        const r = this.scope.resolve(base.name);
        this.references.push({ node: base, resolved: r });
        // `[| [?` write into an existing ds_list/ds_map; every other accessor (`[`, `[@`, and, as the
        // historical regex did, `[# [$`) marks the variable array-like
        const arrayAccess = l.accessor !== "|" && l.accessor !== "?";
        if (e.op === "=" && arrayAccess && r.via !== "lexical" && !TRANSPILER_RESERVED_IDENTIFIERS.has(base.name)) {
          this.implicitArrays.add(base.name);
        }
        if (arrayAccess && (r.via === "none" || r.via === "instance" || r.via === "with")) {
          this.recordWrite(base.name, true, false, false);
        } else if (r.symbol && r.via === "lexical") {
          r.symbol.type = r.symbol.type ?? "array";
        }
      } else {
        this.expr(l.object);
      }
      for (const i of l.indices) this.expr(i);
      return;
    }
    if (l.type === "Member") {
      const o = l.object;
      if (o.type === "Identifier" && o.name === "global") {
        this.globalWrites.add(l.property);
        this.references.push({ node: o, resolved: this.scope.resolve("global") });
        return;
      }
      if (o.type === "Identifier" && o.name === "self") {
        this.references.push({ node: o, resolved: this.scope.resolve("self") });
        this.recordWrite(l.property, isArr, holds, true);
        return;
      }
      if (o.type === "Identifier") {
        const r = this.scope.resolve(o.name);
        this.references.push({ node: o, resolved: r });
        if (r.via === "project" && r.symbol?.kind === "asset" && r.symbol.assetKind === "object") {
          this.externalWrites.push({ target: o.name, field: l.property, isArray: isArr, holdsEntity: holds });
        }
        return;
      }
      this.expr(o);
      return;
    }
    this.expr(l);
  }

  private expr(e: Expr): void {
    switch (e.type) {
      case "Identifier": {
        const r = this.scope.resolve(e.name);
        this.references.push({ node: e, resolved: r });
        return;
      }
      case "Assign":
        this.assign(e);
        return;
      case "Member":
        this.expr(e.object);
        return;
      case "Index":
        this.expr(e.object);
        for (const i of e.indices) this.expr(i);
        return;
      case "Call":
      case "New":
        this.expr(e.callee);
        for (const a of e.args) this.expr(a);
        return;
      case "Unary":
      case "Delete":
      case "Update":
        this.expr(e.arg);
        return;
      case "Binary":
        this.expr(e.left);
        this.expr(e.right);
        return;
      case "Conditional":
        this.expr(e.test);
        this.expr(e.cons);
        this.expr(e.alt);
        return;
      case "ArrayLiteral":
        for (const x of e.elements) this.expr(x);
        return;
      case "StructLiteral": {
        this.push("struct");
        const saved = this.owner;
        this.owner = { kind: "struct" };
        for (const p of e.props) this.expr(p.value);
        this.owner = saved;
        this.pop();
        return;
      }
      case "FunctionExpr":
        this.func(e);
        return;
      case "Paren":
        this.expr(e.expr);
        return;
      case "TemplateString":
        for (const p of e.parts) if (p.kind === "expr" && p.expr) this.expr(p.expr);
        return;
      case "Literal":
        return;
    }
  }
}

// ---------------------------------------------------------------------------
// Project implementation
// ---------------------------------------------------------------------------

class ProjectImpl implements ProjectSymbols, OuterResolver {
  readonly diagnostics: Diagnostic[] = [];
  private readonly assetMaps = new Map<AssetKind, Map<string, Symbol>>();
  private readonly assetByName = new Map<string, AssetKind[]>();
  private readonly enumMap = new Map<string, EnumInfo>();
  private readonly macroMap = new Map<string, MacroInfo>();
  private readonly functionMap = new Map<string, Symbol>();
  private objectMap = new Map<string, ObjectInfo>();
  private crossFile = new Set<string>();
  private scriptVars = new Set<string>();
  private readonly analyses = new Map<string, FileAnalysis>();
  private readonly refIndex = new Map<string, Array<{ file: string; start: number; end: number }>>();
  private readonly macroSyms = new Map<string, Symbol>();
  private readonly enumSyms = new Map<string, Symbol>();
  private entityFields = new Map<string, Set<string>>();

  constructor(private readonly input: ProjectInput) {
    for (const [kind, names] of Object.entries(input.assets ?? {}) as Array<
      [AssetKind, Iterable<string> | undefined]
    >) {
      if (!names) continue;
      const m = new Map<string, Symbol>();
      for (const n of names) {
        m.set(n, { name: n, kind: "asset", assetKind: kind });
        const list = this.assetByName.get(n) ?? [];
        list.push(kind);
        this.assetByName.set(n, list);
      }
      this.assetMaps.set(kind, m);
    }
    for (const [n, kinds] of this.assetByName) {
      if (kinds.length > 1) {
        this.diagnostics.push({
          kind: "asset-collision",
          message: `asset name '${n}' is declared as ${kinds.join(", ")}`,
        });
      }
    }
    for (const [k, names] of Object.entries(input.missing ?? {})) {
      const kind = k as AssetKind;
      for (const n of names ?? []) {
        const m = this.assetMaps.get(kind) ?? new Map<string, Symbol>();
        const existing = m.get(n);
        if (existing) existing.missing = true;
        else {
          m.set(n, { name: n, kind: "asset", assetKind: kind, missing: true });
          const list = this.assetByName.get(n) ?? [];
          list.push(kind);
          this.assetByName.set(n, list);
        }
        this.assetMaps.set(kind, m);
      }
    }
  }

  // ---- build ----
  build(): void {
    const files = this.input.files ?? [];
    // (a) parse once for enums, macros and script-level functions
    for (const f of files) {
      const r = parse(f.text);
      for (const d of r.diagnostics) {
        this.diagnostics.push({ kind: "parse", message: d.message, file: f.path, range: [d.start, d.end] });
      }
      for (const m of scanMacros(f.text)) {
        if (m.valueText === "") continue;
        const key = m.config ? `${m.config}:${m.name}` : m.name;
        this.macroMap.set(key, {
          key,
          name: m.name,
          valueText: m.valueText,
          file: f.path,
          ...(m.config ? { config: m.config } : {}),
        }); // last declaration wins, like the regex scan it replaces
        if (!m.config) {
          this.macroSyms.set(m.name, {
            name: m.name,
            kind: "macro",
            macroValue: m.valueText,
            decl: { file: f.path, range: [m.start, m.end] },
          });
        }
      }
      for (const en of scanEnums(f.text)) {
        if (this.enumMap.has(en.name)) continue; // first declaration wins
        const known = new Map<string, ReadonlyMap<string, number>>();
        for (const [k, v] of this.enumMap) known.set(k, v.members);
        this.enumMap.set(en.name, { name: en.name, members: evaluateEnumDecl(en, known) });
        this.enumSyms.set(en.name, {
          name: en.name,
          kind: "enum",
          decl: { file: f.path, range: [en.start, en.end] },
        });
      }
      if (f.kind === "script") {
        for (const s of r.ast.body) {
          if (s.type === "FunctionDecl") {
            this.functionMap.set(s.name, {
              name: s.name,
              kind: s.isConstructor ? "constructor" : "function",
              decl: { file: f.path, range: [s.start, s.end] },
            });
          }
        }
      }
    }
    // (b) analyze every file; iterate until entity-holding fields settle
    for (let iter = 0; iter < 4; iter++) {
      this.analyses.clear();
      const perObject = new Map<
        string,
        { own: Map<string, FieldInfo>; ext: Map<string, FieldInfo>; files: string[] }
      >();
      const objectSlot = (n: string) => {
        let o = perObject.get(n);
        if (!o) {
          o = { own: new Map(), ext: new Map(), files: [] };
          perObject.set(n, o);
        }
        return o;
      };
      const crossFile = new Set<string>();
      const scriptVars = new Set<string>();
      for (const f of files) {
        const a = this.analyze(f);
        this.analyses.set(f.path, a);
        for (const c of a.facts.entityFieldsFromWith) crossFile.add(c);
        if (f.kind === "script") {
          for (const n of a.facts.selfWrites.keys()) scriptVars.add(n);
        }
        if (f.object) {
          const o = objectSlot(f.object);
          o.files.push(f.path);
          for (const [n, w] of a.facts.selfWrites) merge(o.own, n, w, f.path);
        }
        for (const w of a.facts.externalWrites) {
          if (!w.target) continue;
          merge(objectSlot(w.target).ext, w.field, w, f.path);
        }
      }
      const nextObjects = new Map<string, ObjectInfo>();
      const nextEntity = new Map<string, Set<string>>();
      for (const [name, o] of perObject) {
        nextObjects.set(name, { name, instanceFields: o.own, externalFields: o.ext, files: o.files });
        const ent = new Set<string>();
        for (const m of [o.own, o.ext]) for (const [n, fi] of m) if (fi.holdsEntity) ent.add(n);
        nextEntity.set(name, ent);
      }
      const settled = sameEntitySets(this.entityFields, nextEntity);
      this.objectMap = nextObjects;
      this.crossFile = crossFile;
      this.scriptVars = scriptVars;
      this.entityFields = nextEntity;
      if (settled) break;
    }
    // (c) reference index + diagnostics
    this.refIndex.clear();
    for (const [path, a] of this.analyses) {
      for (const r of a.references) {
        if (r.resolved.symbol && (r.resolved.via === "project" || r.resolved.via === "lexical")) {
          const k = r.resolved.symbol.name;
          const list = this.refIndex.get(k) ?? [];
          list.push({ file: path, start: r.node.start, end: r.node.end });
          this.refIndex.set(k, list);
        }
      }
      this.diagnostics.push(...a.diagnostics);
    }
  }

  // ---- lookups ----
  assets(kind?: AssetKind): ReadonlyMap<string, Symbol> {
    if (kind) return this.assetMaps.get(kind) ?? new Map();
    const all = new Map<string, Symbol>();
    for (const m of this.assetMaps.values()) for (const [n, s] of m) if (!all.has(n)) all.set(n, s);
    return all;
  }
  lookupAsset(name: string): { symbol?: Symbol; collisions: AssetKind[] } {
    const kinds = this.assetByName.get(name) ?? [];
    const first = kinds[0];
    const symbol = first ? this.assetMaps.get(first)?.get(name) : undefined;
    return { ...(symbol ? { symbol } : {}), collisions: kinds.length > 1 ? [...kinds] : [] };
  }
  object(name: string): ObjectInfo | undefined {
    return this.objectMap.get(name);
  }
  objects(): ReadonlyMap<string, ObjectInfo> {
    return this.objectMap;
  }
  enums(): ReadonlyMap<string, EnumInfo> {
    return this.enumMap;
  }
  macros(): ReadonlyMap<string, MacroInfo> {
    return this.macroMap;
  }
  functions(): ReadonlyMap<string, Symbol> {
    return this.functionMap;
  }
  crossFileEntityRefFields(): ReadonlySet<string> {
    return this.crossFile;
  }
  scriptInstanceVars(): ReadonlySet<string> {
    return this.scriptVars;
  }
  references(name: string): ReadonlyArray<{ file: string; start: number; end: number }> {
    return this.refIndex.get(name) ?? [];
  }
  file(path: string): FileAnalysis | undefined {
    return this.analyses.get(path);
  }

  objectFieldSource(name: string): FieldSource {
    return {
      has: (n) => {
        const o = this.objectMap.get(name);
        return !!o && (o.instanceFields.has(n) || o.externalFields.has(n));
      },
      get: (n) => {
        const o = this.objectMap.get(name);
        const f = o?.instanceFields.get(n) ?? o?.externalFields.get(n);
        return f
          ? {
              name: n,
              kind: "instance",
              ...(f.holdsEntity ? { holdsEntity: true } : {}),
              ...(f.isArray ? { type: "array" as const } : {}),
            }
          : undefined;
      },
    };
  }

  resolveOuter(name: string): Resolved {
    const fn = this.functionMap.get(name);
    if (fn) return { symbol: fn, via: "project" };
    const { symbol } = this.lookupAsset(name);
    if (symbol) return { symbol, via: "project" };
    const en = this.enumSyms.get(name);
    if (en) return { symbol: en, via: "project" };
    const mac = this.macroSyms.get(name);
    if (mac) return { symbol: mac, via: "project" };
    if (lookupBuiltin(name) || isKnownBuiltinName(name) || builtinConstant(name)) {
      return { symbol: { name, kind: "builtin" }, via: "builtin" };
    }
    return { via: "none" };
  }

  analyze(file: SourceFile): FileAnalysis {
    const parsed = parse(file.text);
    // pass 1: collect this file's own writes; pass 2: resolve reads against them
    const first = new FileWalker(file, this, new Map());
    first.run(parsed.ast);
    const second = new FileWalker(file, this, first.selfWrites);
    second.run(parsed.ast);
    const byNode = new Map<Identifier, Resolved>();
    for (const r of second.references) byNode.set(r.node, r.resolved);
    const diagnostics: Diagnostic[] = [];
    for (const r of second.references) {
      const sh = r.resolved.shadowed?.[0];
      if (sh) {
        diagnostics.push({
          kind: "shadow",
          message: `'${r.node.name}' shadows ${sh.assetKind ?? sh.kind} '${r.node.name}'`,
          file: file.path,
          range: [r.node.start, r.node.end],
        });
      }
    }
    return {
      ast: parsed.ast,
      recovered: parsed.recovered,
      facts: {
        locals: second.locals,
        selfWrites: second.selfWrites,
        externalWrites: second.externalWrites,
        globalWrites: second.globalWrites,
        entityFieldsFromWith: second.entityFieldsFromWith,
        implicitScalars: second.implicitScalars,
        implicitArrays: second.implicitArrays,
      },
      resolve: (n) => byNode.get(n),
      references: second.references,
      diagnostics,
    };
  }
}

function merge(
  into: Map<string, FieldInfo>,
  name: string,
  w: { isArray: boolean; holdsEntity: boolean },
  path: string,
): void {
  const prev = into.get(name);
  if (!prev) {
    into.set(name, { name, isArray: w.isArray, holdsEntity: w.holdsEntity, writers: [path] });
    return;
  }
  prev.isArray = prev.isArray || w.isArray;
  prev.holdsEntity = prev.holdsEntity || w.holdsEntity;
  if (!prev.writers.includes(path)) prev.writers.push(path);
}

function sameEntitySets(a: Map<string, Set<string>>, b: Map<string, Set<string>>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) {
    const w = b.get(k);
    if (!w || w.size !== v.size) return false;
    for (const x of v) if (!w.has(x)) return false;
  }
  return true;
}

/** Build the immutable symbol table for a project. Pure: no module-level state. */
export function buildProjectSymbols(input: ProjectInput): ProjectSymbols {
  const p = new ProjectImpl(input);
  p.build();
  return p;
}

/** Analyze one file of source text against an existing project table. */
export function analyzeFile(project: ProjectSymbols, file: SourceFile): FileAnalysis {
  return project.analyze(file);
}

/**
 * Field names one file's `with` bodies assign `other.id` to (see
 * `FileFacts.entityFieldsFromWith`). Needs no project knowledge: a `with`
 * target that is not a known object simply widens the result to the
 * project-wide field-name set, the same explicit over-approximation the
 * cross-file scan has always made.
 */
export function scanEntityRefFieldsInText(text: string): Set<string> {
  const project = buildProjectSymbols({});
  const analysis = project.analyze({ path: "", text });
  const fields = new Set(analysis.facts.entityFieldsFromWith);
  if (analysis.recovered > 0) {
    // Recovery fallback: inside a statement the parser could not parse, a token
    // sequence `name = other.id` after a `with` keyword still counts.
    walkStatements(analysis.ast.body, (s) => {
      if (s.type !== "ErrorStmt") return;
      const toks = tokenize(text.slice(s.start, s.end)).filter((t) => !isTrivia(t));
      let seenWith = false;
      for (let i = 0; i + 4 < toks.length; i++) {
        const t = toks[i]!;
        if (t.kind === "keyword" && t.text === "with") seenWith = true;
        if (
          seenWith &&
          t.kind === "ident" &&
          toks[i + 1]!.text === "=" &&
          toks[i + 2]!.text === "other" &&
          toks[i + 3]!.text === "." &&
          toks[i + 4]!.text === "id"
        ) {
          fields.add(t.text);
        }
      }
    });
  }
  return fields;
}

/**
 * Bare-assignment ("implicit instance variable") scan of one file's raw GML,
 * with no project knowledge. Replaces the regex-based `scanGmlImplicitVars` /
 * `scanGmlImplicitArrayVars`: same owner-agnostic contract, but statement
 * boundaries come from the parser (so `then`, `for` headers, comments and
 * multi-line `var` lists are handled exactly).
 */
export function scanImplicitVarsInText(text: string): { scalars: Set<string>; arrays: Set<string> } {
  const analysis = buildProjectSymbols({}).analyze({ path: "", text });
  const scalars = new Set(analysis.facts.implicitScalars);
  const arrays = new Set(analysis.facts.implicitArrays);
  if (analysis.recovered > 0) {
    // Real projects contain GML that does not parse (see gms2-source-bugs.ts). Inside a
    // statement the parser had to skip, keep the old tolerance: an identifier followed by a
    // single `=` at a statement boundary still counts as an assignment target.
    const locals = analysis.facts.locals;
    walkStatements(analysis.ast.body, (s) => {
      if (s.type !== "ErrorStmt") return;
      const toks = tokenize(text.slice(s.start, s.end)).filter((t) => !isTrivia(t) && t.kind !== "eof");
      for (let i = 0; i + 1 < toks.length; i++) {
        const t = toks[i]!;
        const n = toks[i + 1]!;
        if (t.kind !== "ident" || n.kind !== "punct" || n.text !== "=") continue;
        const prev = toks[i - 1];
        const boundary =
          !prev ||
          !!t.nlBefore ||
          (prev.kind === "punct" && (prev.text === ";" || prev.text === "{" || prev.text === "}" || prev.text === ")" || prev.text === ":")) ||
          (prev.kind === "keyword" && prev.text === "else");
        if (boundary && !locals.has(t.text) && !TRANSPILER_RESERVED_IDENTIFIERS.has(t.text)) scalars.add(t.text);
      }
    });
  }
  return { scalars, arrays };
}
