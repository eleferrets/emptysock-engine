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

export interface YYProject {
  resources: YYPResource[];
  defaultScriptType: number; // 0 = GML, 1 = GML Visual
  // Real .yyp files carry the project name under "%Name" at the root —
  // there is no plain "name" key there (unlike most nested resources,
  // which redundantly carry both "%Name" and "name").
  name?: string;
  "%Name"?: string;
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
