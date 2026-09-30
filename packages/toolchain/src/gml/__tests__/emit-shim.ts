import { emitEvent } from "../emit/index.js";
import { buildProjectSymbols, type SourceFile } from "../project-symbols.js";
import type { AssetKind } from "../symbols.js";

const st = {
  macros: new Map<string, string>(),
  enums: new Set<string>(),
  assets: {} as Record<string, Set<string>>,
};
export const setGmlMacros = (m: Map<string, string>) => {
  st.macros = m;
};
export const setGmlEnumNames = (n: Set<string>) => {
  st.enums = n;
};
const setA = (k: string) => (n: Set<string>) => {
  st.assets[k] = n;
};
export const setGmlObjectNames = setA("object");
export const setGmlSpriteNames = setA("sprite");
export const setGmlSoundNames = setA("sound");
export const setGmlFontNames = setA("font");
export const setGmlRoomNames = setA("room");
export const setGmlShaderNames = setA("shader");
let xref = new Set<string>();
export const setGmlCrossFileEntityRefFields = (n: Set<string>) => {
  xref = n;
};

export function transpileGML(
  gml: string,
  knownParams: readonly string[] = [],
  knownImplicit: ReadonlySet<string> = new Set(),
  hasOther = false,
  functionId = "fn",
): string {
  void xref;
  let text = gml;
  if (knownParams.length)
    text = `function fn(${knownParams.join(",")}) {\n${gml}\n}`;
  const file: SourceFile = {
    path: "objects/obj_self/Step_0.gml",
    text,
    object: "obj_self",
    kind: "object",
  };
  const extra: SourceFile[] = [];
  if (knownImplicit.size)
    extra.push({
      path: "objects/obj_self/Create_0.gml",
      text: [...knownImplicit].map((v) => `${v} = 0;`).join("\n"),
      object: "obj_self",
      kind: "object",
    });
  const pre: SourceFile[] = [];
  for (const [k, v] of st.macros)
    pre.push({
      path: "scripts/m/m.gml",
      text: `#macro ${k} ${v}`,
      kind: "other",
    });
  const assets: Partial<Record<AssetKind, string[]>> = {};
  for (const [k, v] of Object.entries(st.assets))
    assets[k as AssetKind] = [...v];
  assets.object = [...new Set([...(assets.object ?? []), "obj_self"])];
  const project = buildProjectSymbols({
    assets,
    files: [...pre, file, ...extra],
  });
  return emitEvent(file, {
    project,
    kind: hasOther ? "collision" : "event",
    object: "obj_self",
    functionId,
    callables: new Map(),
  }).code;
}
