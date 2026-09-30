/**
 * The runtime value of a GameMaker asset used as a value. Membership comes
 * from the project's `.yyp` resource list (via `ProjectSymbols`), never from
 * a name prefix. The engine addresses every asset kind by its resource name
 * except sprites, which are addressed by texture path.
 */

import type { Symbol } from "../symbols.js";

export const MISSING_SPRITE_PATH =
  "./assets/sprites/__missing_sprite__/frame_0.png";

/**
 * Texture path of a sprite asset: the importer's `frame_{n}.png` template
 * for a multi-frame sprite (what its prefab's `Sprite.texturePath` holds, so
 * `sprite_index == spr_walk` compares equal), else `frame_0.png`.
 */
export function spriteTexturePath(
  name: string,
  frames: ReadonlyMap<string, number> | undefined,
): string {
  return (frames?.get(name) ?? 1) > 1
    ? `./assets/sprites/${name}/frame_{n}.png`
    : `./assets/sprites/${name}/frame_0.png`;
}

/** Emitted literal for an asset symbol used as a value (scripts excluded: they are functions). */
export function assetLiteral(
  sym: Symbol,
  frames: ReadonlyMap<string, number> | undefined,
): string {
  if (sym.assetKind === "sprite")
    return JSON.stringify(
      sym.missing === true
        ? MISSING_SPRITE_PATH
        : spriteTexturePath(sym.name, frames),
    );
  return JSON.stringify(sym.name);
}
