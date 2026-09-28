/**
 * Builds the ambient `.d.ts` that types `ctx.globals.get/set` for the
 * project's declared globals, via declaration merging into the flattened
 * engine module Monaco sees (see `engineTypesPlugin` in vite.config.ts).
 */
export const GLOBAL_STORE_MODULE =
  "@emptysock/engine/__internal/systems/GlobalStore";
const IDENT = /^[A-Za-z_$][\w$]*$/;

export function buildGameGlobalsDts(decls: Record<string, string>): string {
  const lines = Object.entries(decls)
    .filter(([name]) => IDENT.test(name))
    .map(([name, type]) => `    ${name}: ${type.trim() || "unknown"};`);
  return `declare module "${GLOBAL_STORE_MODULE}" {\n  interface GameGlobals {\n${lines.join("\n")}\n  }\n}\n`;
}

/** Minimal shape of Monaco's ts defaults this needs (so tests can stub it). */
export interface ExtraLibTarget {
  addExtraLib(content: string, uri: string): { dispose(): void };
}

const URI = "file:///node_modules/@emptysock/game-globals/index.d.ts";
const handles = new WeakMap<ExtraLibTarget, { dispose(): void }>();

export function syncGameGlobalsToMonaco(
  targets: ExtraLibTarget[],
  decls: Record<string, string>,
): void {
  const dts = buildGameGlobalsDts(decls);
  for (const t of targets) {
    handles.get(t)?.dispose();
    handles.set(t, t.addExtraLib(dts, URI));
  }
}
