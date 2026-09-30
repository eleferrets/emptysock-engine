import fs from "fs/promises";
import path from "path";
import { parseGmsJson } from "./gms2-parse.js";
import { emitScript } from "./gml/emit/index.js";
import { buildProjectSymbols } from "./gml/project-symbols.js";

// ---------------------------------------------------------------------------
// GMS2 Extension (`resourceType: "GMExtension"`) import.
//
// Real on-disk format, confirmed against real GMS2 extension resources
// (searched live for this pass — GitHub code search across real
// extensions, e.g. Ttanasart-pt/Pixel-Composer's
// `extensions/patreon_key/patreon_key.yy`,
// `extensions/YYFirebaseFirestore/YYFirebaseFirestore.yy`, and GameMaker's
// own "Introduction to Creating Extensions" / "Creating An Extension"
// manual pages):
//
//   {
//     "resourceType": "GMExtension",
//     "extensionVersion": "1.0.0",
//     "files": [
//       { "resourceType": "GMExtensionFile", "filename": "patreon_key.gml",
//         "kind": 2, "functions": [
//           { "resourceType": "GMExtensionFunction", "name": "patreon_init_keys",
//             "externalName": "patreon_init_keys", "kind": 2, "argCount": 0, "args": [] },
//         ] },
//       { "resourceType": "GMExtensionFile", "filename": "SpoutLibrary.dll",
//         "kind": 1, "functions": [ { "name": "spout_initialized", "externalName": "isInitialized", ... } ] },
//       { "resourceType": "GMExtensionFile", "filename": "FirebaseFirestore.js",
//         "kind": ..., "functions": [ { "name": "FirebaseFirestore_SDK", ... } ] },
//     ],
//   }
//
// Each `GMExtensionFile` bundles one platform-specific implementation of the
// extension's functions: a native compiled library (Windows `.dll`,
// Linux/Android `.so`, macOS/iOS `.dylib`, Android `.jar`, or an Obj-C
// source for iOS), a GML source file (real `.gml`, transpilable the same
// way an object event or script is), or — for the HTML5 target — a
// JavaScript source file. GameMaker's own numeric `GMExtensionFile.kind`
// code for "which of these three" is NOT consistent across GameMaker
// versions in the real samples surveyed for this pass (both `1` and other
// values show up for native `.dll` files depending on export era), but the
// file's own extension is unambiguous and version-independent, so THAT is
// what this importer keys off of, not the numeric `kind` field.
//
// What converts:
// - A `.gml`-backed file: transpiled through the exact same `transpileGML()`
//   pipeline `gms2-codegen.ts`'s scripts/object events use, emitting one
//   real exported TS function per declared `GMExtensionFunction`.
//   Decision (W6-6): the body is emitted by `emitScript` (AST emitter), but the
//   exported signature keeps the extension's own parameters and gains no
//   `_entity`/`_ctx`: extension functions are free functions called from
//   outside any instance, and this importer has never threaded a calling
//   instance into them. A body that needs instance state therefore still
//   references the unbound `_entity`/`_ctx`, exactly as before; it is listed
//   for manual review like the rest of this output. GameMaker
//   extension `.gml` source is written as free functions (`function foo(a,
//   b) { ... }` in 2.3+, or a legacy bare-body-plus-`argumentN` script in
//   older exports) — the same two shapes `buildScriptModule` already
//   handles, so this reuses its signature-extraction approach rather than
//   inventing a second one.
// - A `.js`-backed file: the source is already real JavaScript — passed
//   through with minimal adaptation (wrapped as an exported function per
//   declared `GMExtensionFunction`, using the function's own
//   `externalName` to find its real implementation inside the file — GML/JS
//   extension code can reference GameMaker-runtime-specific globals
//   (`GMEXPORT`, `yyGetString`, `yyCreateArray`, the runner's own JS/GML
//   marshalling helpers) that have no engine-side equivalent; these are left
//   as genuinely unresolved identifiers in the emitted TS rather than faked
//   — the same "surface for manual review, don't silently drop" rule
//   untranspilable GML follows elsewhere in this importer.
//
// What never converts, by design (no source exists to convert): a
// `.dll`/`.so`/`.dylib`/`.jar`/Obj-C-backed file. Every function it declares
// is reported by name in the migration report as a real, permanent gap —
// not folded into a generic "extension skipped" note.
// ---------------------------------------------------------------------------

export interface ExtensionFunctionInfo {
  readonly name: string;
  readonly externalName: string;
}

export interface ConvertedGmlExtension {
  /** One `.ts` module per convertible file (`.gml` or `.js`-backed). */
  readonly modules: readonly {
    readonly fileName: string;
    readonly content: string;
  }[];
  /** Functions backed by a native library — no source exists to convert. Reported by name. */
  readonly nativeFunctions: readonly ExtensionFunctionInfo[];
}

interface YyExtensionFunction {
  name?: string;
  externalName?: string;
}

interface YyExtensionFile {
  filename?: string;
  functions?: YyExtensionFunction[];
}

interface YyExtension {
  resourceType?: string;
  files?: YyExtensionFile[];
}

function isYyExtension(val: unknown): val is YyExtension {
  return typeof val === "object" && val !== null;
}

const NATIVE_EXTENSIONS = new Set([
  ".dll",
  ".so",
  ".dylib",
  ".jar",
  ".m",
  ".mm",
  ".a",
  ".aar",
]);

function fileKind(filename: string): "gml" | "js" | "native" | "other" {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".gml") return "gml";
  if (ext === ".js") return "js";
  if (NATIVE_EXTENSIONS.has(ext)) return "native";
  return "other";
}

/**
 * `extractScriptSignature`-equivalent for extension `.gml` source: real
 * GMS2 2.3+ extension GML files are, like scripts, literally `function
 * <name>(<params>) { ... }` per declared function — but an extension file
 * commonly declares SEVERAL functions in one `.gml` file (unlike a script,
 * which is always exactly one function per file), so this scans for every
 * top-level `function <name>(...) { ... }` block rather than assuming
 * there's only one.
 */
function extractFunctionBodies(
  source: string,
): Map<string, { params: string[]; body: string }> {
  const out = new Map<string, { params: string[]; body: string }>();
  const fnRe = /function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
  let match: RegExpExecArray | null;
  while ((match = fnRe.exec(source)) !== null) {
    const fnName = match[1];
    const paramList = match[2] ?? "";
    if (fnName === undefined) continue;
    const params = paramList
      .split(",")
      .map((p) => p.trim().split("=")[0]?.trim() ?? "")
      .filter((p) => p.length > 0);
    const braceStart = match.index + match[0].length - 1;
    let depth = 0;
    let end = source.length;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    out.set(fnName, { params, body: source.slice(braceStart + 1, end) });
    fnRe.lastIndex = end;
  }
  return out;
}

/**
 * Converts one GMS2 Extension resource's real `.yy` (plus its real GML/JS
 * source files, found alongside the `.yy`) into ready-to-review TS modules,
 * one per convertible `GMExtensionFile`, and an honest, named list of every
 * function this importer genuinely cannot convert (native-library-backed).
 */
export async function convertGms2Extension(
  name: string,
  projectRoot: string,
): Promise<ConvertedGmlExtension> {
  const extensionDir = path.join(projectRoot, "extensions", name);
  const yyPath = path.join(extensionDir, `${name}.yy`);
  const raw = await fs.readFile(yyPath, "utf-8");
  const parsed = parseGmsJson(raw);
  if (!isYyExtension(parsed)) {
    throw new Error(`"${yyPath}" is not a valid GMExtension .yy file`);
  }

  const modules: { fileName: string; content: string }[] = [];
  const nativeFunctions: ExtensionFunctionInfo[] = [];

  for (const file of parsed.files ?? []) {
    const filename = file.filename ?? "";
    const kind = fileKind(filename);
    const functions = file.functions ?? [];

    if (kind === "native") {
      for (const fn of functions) {
        nativeFunctions.push({
          name: fn.name ?? "",
          externalName: fn.externalName ?? fn.name ?? "",
        });
      }
      continue;
    }

    if (kind === "gml") {
      const gmlPath = path.join(extensionDir, filename);
      let source: string;
      try {
        source = await fs.readFile(gmlPath, "utf-8");
      } catch {
        // Declared in the .yy but the source file is missing on disk —
        // honest stub per function, not silent data loss.
        const stubFns = functions
          .map(
            (fn) =>
              `export function ${fn.name ?? "unknown"}(...args: unknown[]): unknown {\n  // TODO: source file "${filename}" not found on disk\n  return undefined;\n}`,
          )
          .join("\n\n");
        modules.push({
          fileName: `${moduleBaseName(filename)}.ts`,
          content: `// Auto-generated from GMS2 extension: ${name} (${filename})\n// Source file could not be read.\n\n${stubFns}\n`,
        });
        continue;
      }
      const bodies = extractFunctionBodies(source);
      const fnBlocks = functions.map((fn) => {
        const declaredName = fn.name ?? "unknown";
        const found =
          bodies.get(declaredName) ?? bodies.get(fn.externalName ?? "");
        if (found === undefined) {
          return `export function ${declaredName}(...args: unknown[]): unknown {\n  // TODO: could not locate this function's body in ${filename}\n  return undefined;\n}`;
        }
        const transpiled = emitExtensionBody(declaredName, found);
        const paramStr =
          found.params.length > 0
            ? found.params.map((p) => `${p}: unknown`).join(", ")
            : "...args: unknown[]";
        const hasReturn = /\breturn\b[^;{}]*;/.test(transpiled);
        const returnType = hasReturn ? "unknown" : "void";
        const body = transpiled.trim();
        return `export function ${declaredName}(${paramStr}): ${returnType} {\n${body ? "  " + body.split("\n").join("\n  ") : ""}\n}`;
      });
      modules.push({
        fileName: `${moduleBaseName(filename)}.ts`,
        content: `// Auto-generated from GMS2 extension: ${name} (${filename})\n// GML-backed extension functions — real source, transpiled like any\n// other GML script/event body. Review carefully before shipping.\n\n${fnBlocks.join("\n\n")}\n`,
      });
      continue;
    }

    if (kind === "js") {
      const jsPath = path.join(extensionDir, filename);
      let source: string;
      try {
        source = await fs.readFile(jsPath, "utf-8");
      } catch {
        const stubFns = functions
          .map(
            (fn) =>
              `export function ${fn.name ?? "unknown"}(...args: unknown[]): unknown {\n  // TODO: source file "${filename}" not found on disk\n  return undefined;\n}`,
          )
          .join("\n\n");
        modules.push({
          fileName: `${moduleBaseName(filename)}.ts`,
          content: `// Auto-generated from GMS2 extension: ${name} (${filename})\n// Source file could not be read.\n\n${stubFns}\n`,
        });
        continue;
      }
      // JS-backed extension functions (HTML5 target) are already real
      // JavaScript — passed through with minimal adaptation: wrap the
      // original source (kept verbatim, since it can reference other local
      // helpers/state within the same file) and re-export each declared
      // function under its declared GML-facing `name`, aliasing to its
      // `externalName` symbol in the source. GameMaker/HTML5-runtime
      // globals the source references (GMEXPORT wrappers, YYRunnerInterface
      // marshalling helpers, etc.) have no engine-side equivalent and are
      // left as genuinely unresolved identifiers — not faked.
      const exportLines = functions
        .map((fn) => {
          const declaredName = fn.name ?? "unknown";
          const external = fn.externalName ?? declaredName;
          return declaredName === external
            ? undefined
            : `export const ${declaredName} = ${external};`;
        })
        .filter((line): line is string => line !== undefined);
      const exportBlock =
        exportLines.length > 0 ? "\n\n" + exportLines.join("\n") : "";
      modules.push({
        fileName: `${moduleBaseName(filename)}.ts`,
        content: `// Auto-generated from GMS2 extension: ${name} (${filename})\n// JS-backed extension (HTML5 target) — original source passed through\n// with minimal adaptation. GameMaker/HTML5-runtime-specific globals this\n// file references (if any) are left as real unresolved identifiers, not\n// faked — review before shipping.\n\n${source.trimEnd()}\n${exportBlock}\n`,
      });
      continue;
    }

    // "other" (e.g. a proxy/manifest file with no functions of its own, or
    // a genuinely unrecognised extension file kind) — nothing to convert
    // and nothing to report as a hard gap either, since it declares no
    // functions.
  }

  return { modules, nativeFunctions };
}

/**
 * Emits one extension function body through the AST emitter. The body is
 * wrapped back into `function name(params) { ... }` so its parameters resolve
 * as lexical locals (not instance variables), then only the emitted body text
 * is kept: the extension module declares its own signature, which has no
 * `_entity`/`_ctx` parameters (see the header note on calling convention). An
 * empty project is used because an extension is self-contained GML.
 */
function emitExtensionBody(
  name: string,
  found: { params: string[]; body: string },
): string {
  const text = `function ${name}(${found.params.join(", ")}) {\n${found.body}\n}\n`;
  const project = buildProjectSymbols({});
  const out = emitScript(
    name,
    { path: `extensions/${name}.gml`, text, kind: "script" },
    {
      project,
      kind: "script",
      functionId: `ext_${name}`,
      callables: new Map(),
    },
  );
  return out.functions[0]?.body ?? "";
}

function moduleBaseName(filename: string): string {
  const base = filename.replace(/\.(gml|js)$/i, "");
  return base.length > 0 ? base : "extension";
}
