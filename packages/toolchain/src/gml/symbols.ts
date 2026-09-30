/** Symbol and scope model for GML. No project knowledge here; see project-symbols.ts. */

export type SymbolKind =
  | "local"
  | "parameter"
  | "instance"
  | "global"
  | "static"
  | "asset"
  | "enum"
  | "enumMember"
  | "macro"
  | "builtin"
  | "function"
  | "constructor";

export type AssetKind =
  | "sprite"
  | "sound"
  | "font"
  | "room"
  | "shader"
  | "object"
  | "script"
  | "path"
  | "timeline"
  | "tileset"
  | "sequence"
  | "includedFile";

export interface Symbol {
  name: string;
  kind: SymbolKind;
  assetKind?: AssetKind;
  /** Referenced but not defined in the project (source-bug placeholders). */
  missing?: boolean;
  /** Only what transforms need. */
  type?: "instance" | "array" | "struct" | "string" | "number" | "unknown";
  /** Holds a live instance reference. */
  holdsEntity?: boolean;
  decl?: { file: string; range: [number, number] };
  macroValue?: string;
  enumValue?: number;
}

export type ResolvedVia =
  "lexical" | "instance" | "with" | "project" | "builtin" | "none";

export interface Resolved {
  symbol?: Symbol;
  via: ResolvedVia;
  /** Project-level symbols hidden by a lexical binding (e.g. a local named like a sprite). */
  shadowed?: Symbol[];
}

export type ScopeKind =
  "file" | "function" | "event" | "with" | "block" | "struct";

/** Instance-field lookup supplied by the owner of an `event`/`with`/`struct` scope. */
export interface FieldSource {
  has(name: string): boolean;
  get(name: string): Symbol | undefined;
}

/** Fallback lookup for project-level (asset/enum/macro/function) and builtin names. */
export interface OuterResolver {
  resolveOuter(name: string): Resolved;
}

export class Scope {
  private readonly symbols = new Map<string, Symbol>();

  constructor(
    readonly kind: ScopeKind,
    readonly parent?: Scope,
    /** For `event`, `with` and `struct` scopes: the instance fields visible bare in this scope. */
    readonly fields?: FieldSource,
    /** Root scopes only. */
    private readonly outer?: OuterResolver,
  ) {}

  declare(sym: Symbol): void {
    this.symbols.set(sym.name, sym);
  }

  hasOwn(name: string): boolean {
    return this.symbols.has(name);
  }

  own(name: string): Symbol | undefined {
    return this.symbols.get(name);
  }

  /** Nearest enclosing function (or file/event) scope; `var` declarations bind here. */
  functionScope(): Scope {
    let s: Scope = this;
    while (s.kind === "block" || s.kind === "with") {
      if (!s.parent) break;
      s = s.parent;
    }
    return s;
  }

  /**
   * Resolution order: block -> function locals/params -> with-target / struct /
   * object instance fields -> project (function, asset, enum, macro) -> builtin.
   */
  resolve(name: string): Resolved {
    let root: Scope = this;
    for (let s: Scope | undefined = this; s; s = s.parent) {
      root = s;
      const sym = s.symbols.get(name);
      if (sym) {
        const outer = this.rootOuter(root)?.(name);
        const shadowed =
          outer?.symbol && outer.via === "project" ? [outer.symbol] : undefined;
        return {
          symbol: sym,
          via: s.kind === "with" ? "with" : "lexical",
          ...(shadowed ? { shadowed } : {}),
        };
      }
      if (s.fields?.has(name)) {
        const fsym = s.fields.get(name);
        const outer = this.rootOuter(root)?.(name);
        const shadowed =
          outer?.symbol && outer.via === "project" ? [outer.symbol] : undefined;
        return {
          ...(fsym ? { symbol: fsym } : {}),
          via: s.kind === "with" ? "with" : "instance",
          ...(shadowed ? { shadowed } : {}),
        };
      }
    }
    const r = root.outer?.resolveOuter(name);
    return r ?? { via: "none" };
  }

  private rootOuter(root: Scope): ((n: string) => Resolved) | undefined {
    let r: Scope = root;
    while (r.parent) r = r.parent;
    const o = r.outer;
    return o ? (n) => o.resolveOuter(n) : undefined;
  }
}
