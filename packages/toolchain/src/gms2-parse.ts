/**
 * GMS2 `.yyp`/`.yy` JSON pre-parsing.
 *
 * Real GMS2 project files are not strict JSON: GameMaker's IDE writes a
 * trailing comma before every closing `}`/`]`. See CLAUDE.md's "GMS2
 * `.yyp`/`.yy` are not strict JSON, and other real-format quirks" entry for
 * the full list of quirks this importer accounts for.
 */

export interface YYPResource {
  id: { name: string; path: string };
  order: number;
}

export interface YYIncludedFile {
  name: string;
  filePath?: string;
  // GameMaker's real per-platform deploy bitmask. -1 means "all targets";
  // any other value's bit-to-platform mapping is internal, per-install
  // target-module state that GameMaker itself never documents publicly
  // (confirmed: no public spec exists for individual platform bit
  // positions) — see `convertGms2IncludedFiles`'s own doc comment for how
  // this importer honestly handles that.
  CopyToMask?: number;
}

export interface YYProject {
  resources: YYPResource[];
  defaultScriptType: number; // 0 = GML, 1 = GML Visual
  // Real .yyp files carry the project name under "%Name" at the root —
  // there is no plain "name" key there (unlike most nested resources,
  // which redundantly carry both "%Name" and "name").
  name?: string;
  "%Name"?: string;
  // GameMaker's "Included Files" feature — real, arbitrary files bundled
  // with the build (data files, licence text, config, ...), physically
  // stored at "<filePath>/<name>" relative to the project root (real
  // GameMaker default: filePath is "datafiles", or "datafiles/<subfolder>").
  IncludedFiles?: YYIncludedFile[];
}

/**
 * Older/legacy real `.yyp` files (predating the `resources: [{ id: { name,
 * path } }]` shape the rest of this importer assumes) instead serialise the
 * resources list as a plain key/value dictionary array:
 * `resources: [{ Key: <guid>, Value: { id: <guid>, resourcePath: "objects\\
 * obj_foo\\obj_foo.yy", resourceType: "GMObject" } }]` — there is no `name`
 * field anywhere in the entry at all; the resource's name has to be derived
 * from its own path (the file's basename, minus the `.yy` extension).
 * `resourcePath` also uses Windows-style backslashes regardless of which OS
 * exported the project, which the rest of the importer's `startsWith("objects/
 * ")`-style checks need forward slashes for.
 */
interface LegacyYypResourceEntry {
  Key?: string;
  Value?: { id?: string; resourcePath?: string; resourceType?: string };
}

function isLegacyResourceEntry(
  entry: unknown,
): entry is LegacyYypResourceEntry {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "Value" in entry &&
    typeof (entry as { Value?: unknown }).Value === "object"
  );
}

/**
 * Normalises a raw, already trailing-comma-stripped `.yyp`'s `resources`
 * array into the one shape the rest of the importer understands
 * (`{ id: { name, path } }`), regardless of which of the two real on-disk
 * shapes it was written in. An entry this function cannot make sense of
 * (neither shape) is dropped rather than thrown on — callers already treat a
 * missing/empty name as a "resource with missing name" warning.
 */
/**
 * `resourceType`s that are real entries in a legacy `.yyp`'s `resources`
 * array but are not GML resources at all — an IDE-only asset-browser folder
 * grouping (`GMFolder`, one per view in the tree, with a real but
 * meaningless `views/<guid>.yy` file on disk) or a per-platform build
 * options blob (`GMWindowsOptions`/`GMMacOptions`/`GMLinuxOptions`/etc,
 * always exactly one per project per platform). Newer `.yyp` versions never
 * list these in `resources` at all (folders live in a separate top-level
 * `Folders` array instead), so surfacing them as a per-project "no import
 * path" warning here would be pure noise on every legacy-format project —
 * they were never a candidate GML asset to import in the first place.
 */
const NON_ASSET_RESOURCE_TYPES = new Set(["GMFolder"]);
function isNonAssetResourceType(resourceType: string | undefined): boolean {
  if (!resourceType) return false;
  return (
    NON_ASSET_RESOURCE_TYPES.has(resourceType) ||
    /^GM\w+Options$/.test(resourceType)
  );
}

export function normalizeYypResources(raw: unknown[]): YYPResource[] {
  const out: YYPResource[] = [];
  for (const entry of raw) {
    if (isLegacyResourceEntry(entry)) {
      if (isNonAssetResourceType(entry.Value?.resourceType)) continue;
      const resourcePath = entry.Value?.resourcePath ?? "";
      const forwardPath = resourcePath.replace(/\\/g, "/");
      const base = forwardPath.split("/").pop() ?? "";
      const name = base.replace(/\.yy$/i, "");
      out.push({ id: { name, path: forwardPath }, order: 0 });
      continue;
    }
    const typed = entry as { id?: { name?: string; path?: string } };
    if (typed.id) {
      out.push({
        id: {
          name: typed.id.name ?? "",
          path: (typed.id.path ?? "").replace(/\\/g, "/"),
        },
        order: 0,
      });
    }
  }
  return out;
}

/**
 * A legacy `.yyp`'s room instances reference their object by raw GUID —
 * `GMRInstance.objId: "<guid>"` — not by `{ name, path }` the way newer
 * `.yy` room instances do (`objectId: { name, path }`). That GUID matches
 * the legacy resource entry's own dictionary key (`entry.Key`, confirmed
 * against a real legacy-format project — *not* `entry.Value.id`, a
 * different, unrelated GUID also present on the same entry), so resolving
 * an instance's object name back from a legacy room needs a `Key ->
 * resource name` map built from the *raw*, still-legacy-shaped resources
 * array — `normalizeYypResources` above already discards each entry's `Key`
 * once it's flattened into the normalised `{ id: { name, path } }` shape,
 * so this needs its own pass over the same raw array. Returns an empty map
 * for a modern `.yyp` (no legacy entries to resolve — modern room
 * instances carry their own name directly and never need this map).
 */
export function buildLegacyResourceGuidMap(
  raw: unknown[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of raw) {
    if (!isLegacyResourceEntry(entry)) continue;
    const key = entry.Key;
    const resourcePath = entry.Value?.resourcePath;
    if (typeof key !== "string" || typeof resourcePath !== "string") continue;
    const forwardPath = resourcePath.replace(/\\/g, "/");
    const base = forwardPath.split("/").pop() ?? "";
    const name = base.replace(/\.yy$/i, "");
    if (name) map[key] = name;
  }
  return map;
}

/**
 * Real GMS2 .yy/.yyp files are not strict JSON: GameMaker's IDE writes a
 * trailing comma before every closing `}`/`]`. JSON.parse rejects this
 * outright. Strip trailing commas before parsing so real project files
 * (not just hand-written test fixtures) parse correctly.
 */
export function parseGmsJson(raw: string): unknown {
  const stripped = raw.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}
