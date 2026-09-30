import {
  setGmlObjectNames,
  setGmlSpriteNames,
  transpileGML,
} from "../../gms2-transpile.js";

/** Project context of a transpiled snippet. */
export interface SnippetContext {
  objects?: readonly string[];
  sprites?: readonly string[];
  /** Instance variables some event of the snippet's object assigns. */
  instanceVars?: readonly string[];
  /** Array-valued instance variables known project-wide. */
  arrayVars?: readonly string[];
}

/** Transpiles one object-event snippet with the given project context. */
export function transpileSnippet(
  gml: string,
  ctx: SnippetContext = {},
): string {
  setGmlObjectNames(new Set(ctx.objects ?? []));
  setGmlSpriteNames(new Set(ctx.sprites ?? []));
  try {
    return transpileGML(
      gml,
      [],
      new Set(ctx.instanceVars ?? []),
      false,
      "fn",
      undefined,
      new Set(ctx.arrayVars ?? []),
    );
  } finally {
    setGmlObjectNames(new Set());
    setGmlSpriteNames(new Set());
  }
}
