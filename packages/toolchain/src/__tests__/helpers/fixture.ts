import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { normalizeYypResources, parseGmsJson } from "../../gms2-parse.js";

/**
 * Real-project fixture helpers shared by the fixture-gated tests. Fixtures
 * live outside the repository; nothing here names a project. A project is
 * identified in committed baselines only by `projectKey` (a hash of its
 * `.yyp` file name) and a single-letter label.
 */

/** The `.yyp` inside `GMS_FIXTURE_DIR`, or `""` when unset/absent. */
export function fixtureYyp(): string {
  const dir = process.env["GMS_FIXTURE_DIR"] ?? "";
  if (dir === "") return "";
  try {
    const yyp = readdirSync(dir).find((n) => n.endsWith(".yyp"));
    return yyp ? path.join(dir, yyp) : "";
  } catch {
    return "";
  }
}

/** Resource names of a `.yyp`, bucketed by the directory of their recorded path. */
export function yypResources(yyp: string): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const project = parseGmsJson(readFileSync(yyp, "utf8")) as {
    resources?: unknown[];
  };
  for (const r of normalizeYypResources(project.resources ?? [])) {
    const kind = r.id.path.split("/")[0] ?? "";
    let set = out.get(kind);
    if (!set) {
      set = new Set();
      out.set(kind, set);
    }
    set.add(r.id.name);
  }
  return out;
}

/**
 * True when the project declares every named resource. Tests hard-wired to
 * one project's rooms/objects call this and skip cleanly elsewhere, so a
 * different project reports "not applicable" instead of a false failure.
 */
export function yypDeclares(
  yyp: string,
  wanted: { rooms?: readonly string[]; objects?: readonly string[] },
): boolean {
  const res = yypResources(yyp);
  const has = (kind: string, names: readonly string[] = []): boolean =>
    names.every((n) => res.get(kind)?.has(n) === true);
  return has("rooms", wanted.rooms) && has("objects", wanted.objects);
}

/** Stable, non-identifying key for a project: a hash of its `.yyp` file name. */
export function projectKey(yyp: string): string {
  return createHash("sha256")
    .update(path.basename(yyp))
    .digest("hex")
    .slice(0, 12);
}
