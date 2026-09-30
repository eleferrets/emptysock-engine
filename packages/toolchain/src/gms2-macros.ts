import fs from "fs/promises";
import path from "path";
import { scanMacros } from "./gml/scan.js";

/**
 * Walks every `.gml` file under `projectRoot` and extracts every real
 * `#macro NAME value` declaration into a `name -> value` map. Declarations
 * come from the GML lexer (`gml/scan.ts`): a `#macro` line inside a comment
 * or string is not a declaration, `\` line continuations are joined, and
 * trailing line and block comments are dropped from the value. A
 * config-scoped macro (`#macro Config:NAME value`) is keyed `Config:NAME`,
 * exactly as before, so it never substitutes a bare `NAME`. The last
 * declaration of a name wins.
 */
export async function scanGmlMacros(
  projectRoot: string,
): Promise<Map<string, string>> {
  const macros = new Map<string, string>();

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (stat === null) continue;
      if (stat.isDirectory()) {
        await walk(full);
      } else if (entry.endsWith(".gml")) {
        const content = await fs.readFile(full, "utf-8").catch(() => "");
        for (const m of scanMacros(content)) {
          if (m.valueText !== "") {
            macros.set(
              m.config ? `${m.config}:${m.name}` : m.name,
              m.valueText,
            );
          }
        }
      }
    }
  }

  await walk(projectRoot);
  return macros;
}
