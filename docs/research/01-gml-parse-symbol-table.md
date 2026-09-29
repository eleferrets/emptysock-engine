# 01 - GML parse + symbol table (replace name lists / regex guards)

Read-only research. Paths relative to `packages/`. Line refs are from the working tree at research time (branch sweep/housekeeping-research). Things I did not verify are marked (unverified).

## 0. Prior art in this repo

`docs/decisions/gml-transpiler.md` ("symbol pre-scan: stayed regex-based", ~line 87) already evaluated `@bscotch/gml-parser`, `gamemaker-language-parser` (Antlr4, pre-1.0) and `gml-pegjs` (unmaintained) and declined adoption. Its three reasons: (1) bscotch models a whole project and would duplicate `gms2-parse.ts`; (2) a second tokenizer risks disagreeing with `maskGmlStringLiterals` and the 15+ downstream regex passes; (3) no way to pin and validate a new dependency. It explicitly said "revisit if a future pass needs true AST-level transforms". The findings below are that revisit. Reason (2) is the real constraint and drives the migration order: the symbol table must land as an oracle first, and regex passes are retired one at a time behind parity tests.

Shape of the problem today: `transpileGML` (`toolchain/src/gms2-transpile.ts`, 5437 lines) is a string-to-string pipeline. Symbol knowledge lives in module-level `let` sets installed by `set*` functions before transpiling. Scope is inferred by regex. Each pass masks strings (`maskGmlStringLiterals`), then loops `for name of set` building a `new RegExp` per name (O(names x passes x source)).

## 1. Inventory: what the symbol table replaces

### 1a. Module-level name sets and their installers (transpile.ts)

| Item | Where | Consumer | Replaced by |
|---|---|---|---|
| `_macros` / `setGmlMacros` / `scanGmlMacros` | transpile.ts:25-28, 217-262 (`MACRO_RE` at :221) | macro expansion | `Symbol kind=macro` |
| `_enumNames` / `setGmlEnumNames` | :42-46, used :1218, :5420 | enum rewrite pass | `kind=enum` |
| `_objectNames` / `setGmlObjectNames` | :63-83; used :5098-5104, :5240 | cross-instance `obj_x.field` rewrite (per-name `new RegExp` loop) | `kind=asset(object)` |
| `_objectFieldNames` / `setGmlObjectFieldNames` | :94-97; used :1245-1273 | `with (obj) {}` field merging | `ObjectInfo.instanceFields` |
| `_spriteNames`, `_soundNames`, `_fontNames`, `_roomNames`, `_shaderNames` + 5 setters | :113-133, :162 | asset-value pass :5315-5395 | `kind=asset(sprite/sound/font/room/shader)` |
| `_missingFontNames/_missingSpriteNames/_missingObjectNames` / `setGmlMissingAssetNames` | :135-153; used :156, :5360-5372 | defined-safe placeholders | `Symbol.missing=true` flag |
| `_crossFileEntityRefFields` / `setGmlCrossFileEntityRefFields` | :184-190; used :5238 | field holds live Entity | `FieldInfo.holdsEntity` |
| `ENTITY_RETURNING_CALLS_NAMES` | :73-79 | local entity-ref scan (:3846) | built-in signature table `returns: "instance"` |
| `GML_RESERVED_IDENTIFIERS` | :579-620 (mixes JS and GML words: `let`, `class`, `yield`, `await`...) | `identifyGmlImplicitVars` | lexer keyword table |
| `localEntityRefs` scan | referenced :68, :173, :3846-3860 | same-function `inst.x` dotted access | `Local.type="instance"` inferred from initializer |

### 1b. Regex / heuristic scope guards (transpile.ts)

| Regex/heuristic | Line(s) | What it approximates | Symbol-table replacement |
|---|---|---|---|
| `gmlDeclaredLocalNames` (`\b(?:var\|let\|const)\s+([^;\n]+)`) + hand comma splitter | :628-650 | local declarations | `Scope.declare(local)` from `VarDecl` nodes |
| `identifyGmlImplicitVars` + `GML_STATEMENT_PREFIX` line-start assignment guess | :663-800, prefix :804 | "undeclared assignment = instance var" | `resolve(name)` falls through to instance scope; assignment target with no binding defines an instance field |
| `scanGmlImplicitVars`, `scanGmlImplicitArrayVars` (exported, used by codegen) | :1084, :1106; `arrayAssignRe` :1110, :4741 | per-file implicit vars / arrays | `ObjectInfo.instanceFields[name].isArray` |
| `with` finders (`withRe`, `\bwith\s*\(`, bare-match regexes) | :910, :924, :954, :1053-1070, :1245, :1265 | with-target + body rescoping | AST `WithStatement`; body scope kind=`with-target` |
| `other` rescope `(?<!\.[ \t]*)\bother\b` | :1003, :1349 | `other` inside with/collision | scope-aware resolve: `other` is built-in only in event/with scope |
| `id` -> `_entity` `(?<!\.[ \t]*)\bid\b(?!\s*:)` | :1366 | built-in `id` vs struct key `id:` | AST: `id` as member-name / object-literal key is not an identifier reference |
| `(?<!\.[ \t]*)` dotted guard repeated in every pass | :1349, :1366, :5250, :5379 (the guard already caused a systemic bug, decisions doc line 216) | "not after a `.`" | AST `MemberExpression.property` never resolves |
| `and/or/xor/not/exit/var->let/#region` token rewrites | :1578-1651 | keyword mapping | codegen emit from tokens (or keep as token-level map; low value) |
| `bareAssignInCondition` (`condRe` :1141, `=` -> `==` :1167) | :1141-1167 | GML `if (a = b)` comparison | AST `AssignmentExpr` in test position |
| `wrapBareSingleStatementIf`, `stripTrailingSemicolonInForHeaders`, `forMatch` | :318-450 | brace-less if / for header | AST statement boundaries |
| Identifier-only string tests `/^[A-Za-z_]\w*$/` deciding "is this arg an asset/local?" | :2387, :2569, :3800, :3999, :4090 (`SPRITE_ASSET_RE`), :4390, :4445 | arg is bare identifier | `resolve(argNode)` returns Symbol |
| `knownVarsForObjArgs` / `identifyGmlImplicitVars(out, knownParams)` | :3795-3800, :4857 | param/instance/local disambiguation | `Scope` chain |
| asset-value pass: `kindByName` + `ambiguous` cross-kind collision resolution | :5315-5395 | which kind a bare name is; ambiguous names dropped silently | `resolve()` returns kind; collision is a diagnostic, not silent drop |
| `ds_list_create()`/`ds_map_create()` regex rewrites | :2105, :2180 | built-in call replace | built-in table + call node; not symbol-table critical (phase 3 optional) |
| `maskGmlStringLiterals`/`unmaskGmlStringLiterals`, `stripGmlCommentsAndStrings` | :497-548; source-bugs.ts:364 | protect strings/comments | lexer makes them unnecessary once passes consume the AST |
| `buildFunctionDepthProbe` | :550-577 | "is offset inside a function" | AST node ranges |

### 1c. Other files

| File | Item | Lines | Replaced by |
|---|---|---|---|
| `gms2-crossfile-refs.ts` | `scanGmlCrossFileEntityRefFields`: `WITH_BRACE_RE = /\bwith\s*\([^()]*\)\s*\{([^{}]*)\}/g`, `FIELD_ASSIGN_RE = /\b(\w+)\s*=\s*other\.id\s*;/g` (fails on nested braces and any body that is not exactly `field = other.id;`) | :62 (fn), :73, :78 | AST dataflow, section 4 |
| same | `scanGmlObjectFieldNames` | :156-186 | `ObjectInfo.instanceFields` built by the symbol table |
| `gms2-enums.ts` | `ENUM_RE = /enum\s+(\w+)\s*\{([^}]*)\}/g`, `parseEnumBody`, `evaluateEnumExpr` | :40, :72, :107 | `EnumDecl` node; keep `evaluateEnumExpr` semantic (constant folding) but on AST |
| `gms2-source-bugs.ts` | `KEYWORDS` set | :46 | lexer keywords |
| same | `GML_BUILTIN_VALUES` | :107 | built-in table |
| same | `GML_CONSTANT_PREFIX` (`^(?:c\|vk\|mb\|fa\|...)_...$`, 60+ prefixes) | :258 | built-in constant table (or keep as fallback classifier; see risks) |
| same | `OBJECT_ARG_FUNCS`, `SPRITE_ARG0_FUNCS` | :262, :542 | built-in signature table with param kinds (`asset:object`, `asset:sprite`) |
| same | `declaredLocals`, `bareReads` (`(?<![\w$.@#])([A-Za-z_]\w*)`), `blankWithBodies`, `blankDeclarationRegions`, `callRe` | :458, :498, :415, :441, :739 | this whole file's "bare read of undefined identifier" logic becomes `resolve() === undefined` diagnostics |
| same | `_unsetVarsByObject`, `_scriptInstanceVars`, `_projectInstanceVars` + setters/getters | :303-362 | `ObjectInfo` / `ProjectSymbols` queries |
| `gms2-codegen.ts` | `objectImplicitVars` / `objectArrayVars` union of per-event scans, merged with props, unsetVars, scriptVars | :418-493, passed :572-575 | `project.object(name).instanceFields` |
| same | `new RegExp('\\b'+script+'\\s*\\(')` script-usage probes | :910, :1129, :1382; :1083 `knownObjects` | `references(scriptSymbol)` |
| `gms2-import.ts` | the whole `setGml*` install block | :128-161, :267-320 (imports :20-42) | one `buildProjectSymbols(projectRoot)` call; also removes hidden global mutable state (parallel imports/tests can collide today) |

### 1d. Runtime shims (`engine/src/compat/gml*.ts`)

No name lists or guard regexes found there (grep for `new Set([`, `RegExp`, `.test(` in `gml.ts`, `gmlCrossInstance.ts`, `gmlInstanceVars.ts` found nothing relevant). They are the consumers: `getGmlVar`/`getGmlObjectVar`/`getGmlRefVar`/`getGmlArrayVar` are runtime fallbacks for what the transpiler could not statically classify. Once locals/instance/global are resolved statically, some `getGmlVar` calls become plain field access (optional, phase 6). The built-in table should be generated from or cross-checked against the exports of these files so "supported built-in" has a single source of truth (see 3).

## 2. Library comparison

Web checks done this session: only the `@bscotch/gml-parser` npm page (v1.17.2, MIT) was confirmed. A search for a tree-sitter or Lezer GML grammar returned nothing. Other cells are from the decisions doc (2 earlier sessions) or unverified.

| Option | Maintained | License | ESM | GML coverage | Fit |
|---|---|---|---|---|---|
| `@bscotch/gml-parser` 1.17.2 | Yes (successor to retired Stitch), last publish ~8 months before the decisions doc | MIT | (unverified; repo is a TS monorepo, check `type`/`exports` before adopting) | Project-level model: structs, statics, constructors, JSDoc types, feather-ish typing; AST with positions. Fully-featured but not confirmed for `???`/`??=` (those are GMS2023+ ; (unverified)) or `#region` handling | Wrong granularity: its unit is a GameMaker project (`.yyp` graph). Overlaps `gms2-parse.ts` and asset importers. Large dep surface (unverified bundle size, node fs coupling). Types are useful but we would still need our own symbol categories (asset kinds, cross-file entity refs) |
| `gamemaker-language-parser` (Pizzaandy, Antlr4) | WIP, pre-1.0, Prettier-plugin focused | (unverified) | (unverified) | Grammar likely broad, but tooling-shaped and Antlr runtime is heavy | Not a stable consumable |
| `gml-pegjs` | Unmaintained | (unverified) | No | Pre-2.3 | Reject |
| Small Lezer grammar (`@lezer/generator` + `@lezer/lr`, both MIT, ESM, maintained by CodeMirror author) | Yes | MIT | Yes | We define coverage ourselves | Fits. LR, error-tolerant, incremental (unneeded), tiny runtime (~tens of KB, unverified exact). Cost: writing and maintaining a grammar incl. ASI-like GML quirks (optional semicolons, brace-less `if`, `=` as comparison in conditions, `begin/end`, `then`, `repeat`, `until`, `#macro` line-oriented, `@"..."` strings, `$"...{x}"` templates, `??`, `??=`, `#region` as comment) |
| Hand-rolled Pratt/recursive-descent parser in TS (zero deps) | n/a | n/a | Yes | Ours | Best control over GML quirks. About 1200-1800 lines (lexer ~300, parser ~900, scopes ~300). Error recovery is easy to do statement-wise, which the transpiler needs since real projects contain invalid GML (see `gms2-source-bugs.ts`) |

GML syntax that dictates the choice: line-oriented `#macro` (with `\` continuation), `#region` lines, `begin`/`end`, `then`, optional parens on `if`/`while` (see `wrapBareSingleStatementIf`), `=` in condition position meaning `==`, `$"..{x}.."` templates, `@"raw"` strings, accessor sugar `[| ]`, `[? ]`, `[# ]`, `[@ ]`, `??`, `??=`, `with`, `repeat`, `until`, `switch` fallthrough, struct literals `{a: 1}`, `function` expressions, `constructor` with `: Parent(args)` inheritance, `static`, `new`, `delete`, `enum` with expressions and trailing commas, `exit`/`return`, `#macro` inside any file. LR grammars handle the ambiguous ones (`if (a) b` vs `if a b`, `=` vs `==`) awkwardly; a hand-written parser handles them with a flag on the condition parser.

Recommendation: hand-rolled lexer + recursive-descent/Pratt parser in `packages/toolchain/src/gml/` (standard library only), with error recovery per statement. Rationale: (a) the decision doc's reason (2) is best mitigated by owning the tokenizer, so it can produce exactly the masked-string and comment spans the regex passes assume, letting old passes run on the same spans in the transition; (b) the grammar has more than 10 context-dependent quirks that LR handles awkwardly; (c) `@bscotch/gml-parser` brings a project model we already have, and its symbol model does not have our asset kinds or cross-file entity-ref concept; (d) a hand-rolled parser has no dependency pinning problem (decisions doc reason 3). Take from bscotch only ideas and, if useful, its published test corpus behavior as a reference oracle in a throwaway spike (dev-only, not a dependency). Lezer is the fallback if the hand-rolled parser exceeds ~2000 lines or if editor tooling (syntax highlighting in the IDE) is wanted later; a shared grammar could then serve both.

## 3. Data model and API (proposed, `packages/toolchain/src/gml/`)

Files: `lexer.ts`, `ast.ts`, `parser.ts`, `builtins.ts`, `symbols.ts`, `project-symbols.ts`.

```ts
type SymbolKind =
  | "local" | "parameter" | "instance" | "global" | "static"
  | "asset" | "enum" | "enumMember" | "macro" | "builtin" | "function" | "constructor";
type AssetKind = "sprite"|"sound"|"font"|"room"|"shader"|"object"|"script"|"path"|"timeline"|"tileset"|"sequence"|"includedFile";

interface Symbol {
  name: string;
  kind: SymbolKind;
  assetKind?: AssetKind;
  missing?: boolean;            // referenced but not defined in project (source-bugs)
  type?: "instance"|"array"|"struct"|"string"|"number"|"unknown"; // only what transforms need
  holdsEntity?: boolean;        // field/local holds a live instance ref
  decl?: { file: string; range: [number, number] };
  macroValue?: string; enumValue?: number;
}

interface Scope {
  kind: "file"|"function"|"event"|"with"|"block"|"struct";
  parent?: Scope;
  declare(sym: Symbol): void;
  resolve(name: string): Resolved;   // walks: block -> function locals/params -> with-target/struct -> object instance -> global-prefixed -> project (assets/enums/macros/functions) -> builtins
}
interface Resolved { symbol?: Symbol; via: "lexical"|"instance"|"with"|"project"|"builtin"|"none"; shadowed?: Symbol[] }

interface ProjectSymbols {
  assets(kind?: AssetKind): ReadonlyMap<string, Symbol>;
  lookupAsset(name): { symbol?: Symbol; collisions: AssetKind[] };
  object(name): ObjectInfo | undefined;    // instanceFields: Map<string,{isArray,holdsEntity,writers:File[]}>
  enums(): ReadonlyMap<string, EnumInfo>;
  macros(): ReadonlyMap<string, MacroInfo>;
  references(sym: Symbol): Ref[];          // usage index for scripts/assets
  diagnostics: Diagnostic[];               // collisions, unresolved bare reads, shadowing
}

// Built once, immutable, no module-level mutable state:
function buildProjectSymbols(input: { files: {path,kind,text}[]; assets: Record<AssetKind, string[]>; missing: MissingAssets }): ProjectSymbols;
function analyzeFile(project: ProjectSymbols, file, ctx: { objectName?: string; params?: string[] }): { ast: Program; resolve(node: Ident): Resolved };
```

Built-in table (`builtins.ts`): `Map<string, {kind:"function"|"variable"|"constant", readOnly, params?: ParamKind[], returns?: "instance"|...}>`. Sources: the current function-name uses in the transpile passes, `GML_BUILTIN_VALUES`, `OBJECT_ARG_FUNCS`, `SPRITE_ARG0_FUNCS`, `ENTITY_RETURNING_CALLS_NAMES`, and constant prefix regex as a fallback classifier `builtinConstant(name)`. A parity test asserts every `GmlActions`/compat export named in the table exists.

Resolution order for a bare identifier `n` (this is GML's real order; today it is implicit in pass order): local/parameter (block then function) -> `with` target instance fields -> current object's instance fields -> `global.` only via member access -> script/function -> asset -> enum -> macro (macros expand pre-parse, kept as symbols for reports) -> builtin -> unresolved (instance-var-on-first-write if it is an assignment target). Members (`a.b`) resolve only `a`; `b` never resolves as an identifier (kills the `(?<!\.[ \t]*)` guard class).

## 4. What it subsumes

**Cross-file entity-ref scan** (`gms2-crossfile-refs.ts`). Today: the regex finds only `with (T) { f = other.id; }` with no nested braces. Symbol-table form: during `analyzeFile`, a light flow-insensitive typing pass marks a `Symbol` `holdsEntity` when assigned from (a) `instance_create_*`/`instance_place`/etc. (built-in `returns:"instance"`), (b) `other.id`/`id`/`self` inside a `with`, (c) another `holdsEntity` symbol. Assignment `f = <entityExpr>` inside a `with (T)` records `T.instanceFields[f].holdsEntity` (if T is an object asset) or, when the with target is unresolved, a project-wide field-name set (same over-approximation as today, now explicit). Then a dotted read `x.f` on any receiver uses `holdsEntity` of the receiver's symbol or of field `f`. Same-function `localEntityRefs` and the cross-file set become one mechanism (`Symbol.holdsEntity`). Fixed point over files: iterate until no new `holdsEntity` (usually 2 iterations).

**Shadowing.** Currently a local named like an object (`var obj_player = ...`) is protected only because `_objectNames` are "never variable names" (comment at transpile.ts:5091-5100 says "safe without a full per-file local-variable scope analysis", i.e. an admitted gap), and the asset-value pass skips assignment targets by lookahead. With `Scope.resolve`, a local/parameter/instance field named as an asset resolves lexically first, so the asset rewrite never fires on it. `Resolved.shadowed` feeds a report diagnostic ("local `spr_x` shadows sprite asset").

**Cross-kind asset collisions.** `kindByName`/`ambiguous` (transpile.ts:5323-5343) silently deletes names present in more than one kind (e.g. sprite and object both `spr_x`? or sound and script). Symbol table keeps all: `lookupAsset(name).collisions`. Resolution then uses syntactic position: argument position of a built-in with `ParamKind` (`draw_sprite` arg0 -> sprite; `instance_create_layer` arg3 -> object; `audio_play_sound` arg0 -> sound) picks the kind; otherwise emit a diagnostic and use the previous fallback (leave as is). This turns a silent drop into a typed decision. It also fixes the reverse: names treated as assets in positions where GML only accepts the other kind.

## 5. Migration plan (ordered, independently committable)

Rule for every step: existing toolchain suite (`vitest run`, 409 tests per decisions doc) plus a golden test on real-project output stays green; new code is additive until the flip step; each step has a single owner file set so they can be reviewed separately.

| # | Step | Files owned | Exit criteria |
|---|---|---|---|
| 1 | Lexer + AST types + parser with statement-level error recovery; corpus test parses every `.gml` of a real project with zero throws and reports recovered-error count | new `toolchain/src/gml/{lexer,ast,parser}.ts` + `gml/*.test.ts` | Round-trip: `print(parse(src))` token stream equals source token stream (lossless) on corpus; unit tests for each syntax in section 2 |
| 2 | Built-in table + cross-check against compat exports | new `gml/builtins.ts`, test `gml/builtins.test.ts` | Every builtin the transpile passes mention is in the table (script greps transpile.ts for `GmlActions.` and function names) |
| 3 | `symbols.ts` + `project-symbols.ts` (assets, enums, macros, objects, scopes, resolve). No consumer yet. Also `buildProjectSymbols` fed by the same directory lists `gms2-import.ts` already computes | new `gml/symbols.ts`, `gml/project-symbols.ts`, tests | Shadow-mode test: for the whole real project, compare `symbols.objects[o].instanceFields` with codegen.ts:418-493 union (`objectImplicitVars`), and `assets` with the `set*` sets; print diffs, gate on an allow-list |
| 4 | Enums + macros onto AST (`scanGmlEnums`, `scanGmlMacros`) | `gms2-enums.ts`, `gms2-transpile.ts` lines 217-262 only, tests | Same emitted `enums` module bytes on real project; unit test that nested-brace/comment/trailing comma enums work (current `[^}]*` cannot) |
| 5 | Cross-file entity-ref scan on AST | `gms2-crossfile-refs.ts`, `gms2-transpile.ts` 5238 region | Output set is a superset of the regex result on real project; every extra name manually justified; `localEntityRefs` unify last |
| 6 | Instance/array var detection: replace `identifyGmlImplicitVars`, `scanGmlImplicitVars/ArrayVars`, `gmlDeclaredLocalNames`, `GML_RESERVED_IDENTIFIERS`; codegen consumes `ObjectInfo` | `gms2-transpile.ts` (663-800, 1084-1130), `gms2-codegen.ts` (418-493), `gms2-source-bugs.ts` (`declaredLocals`, `bareReads`, sets) | Generated object TS byte-identical, or diff explained (expected differences: names formerly missed inside `case` prefix or multi-line) |
| 7 | Asset value pass + cross-instance dotted pass using `Scope.resolve` and AST identifier nodes (removes the per-name `new RegExp` loops :5098, :5335-5395) and the cross-kind collision handling | `gms2-transpile.ts` tail (5085-5395), `gms2-import.ts` install block, `gms2-source-bugs.ts` missing-asset flag | Golden diff plus perf: transpile time on real project should drop (no O(names) regex loops) |
| 8 | `with` / `other` / `id` rewrites on AST (:905-1070, :1349, :1366) | `gms2-transpile.ts` | These are the highest regression risk (decisions doc line 216 bug class); gated by the `tsc --noEmit` error count on the real project not increasing (was 413 lines) |
| 9 | Remove module-level `set*` globals; `transpileGML(gml, ctx: {project, object, params})` | `gms2-transpile.ts` signatures, `gms2-import.ts`, tests that call `setGml*` | No `let _...Names` left; tests construct `ProjectSymbols` directly |
| 10 | Optional: retire masking/keyword regexes by emitting from tokens; consider static resolution of runtime `getGmlVar` fallbacks | `gms2-transpile.ts`, `engine/src/compat/gml*.ts` (only after step 9) | Runtime call count of `getGmlVar` in output drops; engine tests green |

Steps 1-3 add files only. Steps 4-8 each touch a disjoint region, so they can be done by parallel sweeps only if step 3 landed; steps 6, 7, 9 all edit `gms2-transpile.ts`, so serialize those.

## 6. Risks and parity tests

Risks:
- Real GML in the wild is not always valid (the repo has `gms2-source-bugs.ts` for it). A strict parser that throws breaks import. Mitigation: statement-level recovery, produce an `ErrorNode` covering the bad statement, and let the old regex path handle recovered regions during steps 4-8 (fall back per file with a report entry).
- Two tokenizers disagreeing about strings/comments (decisions doc reason 2). Mitigation: step 1's lossless-token test, and old `maskGmlStringLiterals` run against the same spans.
- Over-approximation changes: the AST will find more implicit fields and more entity refs than the regexes. That should be a gain but changes emitted code; each diff must be reviewed once, then pinned in a golden.
- Field-name-based entity refs (`holdsEntity` by field name across files) stay heuristic even in the AST world: two objects with the same field name, one holding an entity and one a number. Document; keep it per-object when the `with` target resolves.
- Edge syntax: `#macro` continuation, `#region` inside expressions, `$"..."` templates with nested quotes, `@"..."`, accessors `[# ]`, `??`/`??=` (GMS 2023+), old `begin/end`, `then`. Each needs a lexer test.
- Built-in table drift: hundreds of built-in names (constants by prefix). Keep the prefix fallback in `builtinConstant` so unknown `vk_*`/`c_*` never become "unresolved".
- Perf: AST + scope chain per file is cheap; the current O(names) regex loops are the slow part, so expect a speedup. Measure in step 7.
- Hidden global state today (`set*`): parallel test files sharing module state is an existing hazard; step 9 removes it but touches many tests.

Tests that prove parity:
1. Lossless lex/parse round-trip over every `.gml` in a real project (step 1).
2. Golden snapshot: import a real project before/after each step; diff of emitted `.ts`; zero diff or a reviewed allow-list. Store the diff, not the project.
3. `tsc --noEmit` error-line count on the generated project must not increase from the recorded baseline (413 lines per decisions doc).
4. Existing `gms2-transpile.test.ts` (and the other 409 toolchain tests) unchanged and green at every step.
5. Set-equality/superset shadow tests in step 3 and 5: `symbols` vs the old `set*` sets and vs `scanGmlObjectFieldNames`/`scanGmlCrossFileEntityRefFields`.
6. Targeted unit tests for guards that were bugs: dotted-guard with a period in a preceding comment (decisions line 216), `list[| 0] = 5` double wrap (line 92), `case X: __res = ...;`, brace-less `if`, `id:` struct key, `other` inside nested `with`, local shadowing an asset name, sprite/object same-name collision, enum with expression values and comments.
7. Built-in coverage test: every function the transpiler emits (`GmlActions.*`, `ctx.*`) exists in `engine/src/compat`, and every table entry maps to an existing shim or is marked `unsupported`.
8. Property/fuzz test: random valid GML from a small generator parses; random truncation of real files never throws (only recovers).
