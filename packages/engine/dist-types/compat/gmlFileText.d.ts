/**
 * GameMaker's `file_text_*` family — real, plain function calls in GML
 * (not DnD actions), so these follow the exact `(entity, ctx, ...gmlArgs)`
 * shape `gmlCollisionQueries.ts` already establishes for that same reason.
 * All state lives in `ctx.game?.files` (a real `GmlFileSystem` — see that
 * class's own doc comment). `entity` is unused by every function here
 * (file handles are process-wide in real GameMaker too, not per-instance)
 * but kept for signature consistency with every other compat family in
 * this codebase.
 *
 * Real, confirmed usage this family covers end to end: GameMaker's own
 * save/load idiom (`file_text_open_write(working_directory + SAVEFILE)`,
 * `file_text_write_string`/`_real`, `file_text_close`) and reading a
 * bundled included file line by line (`file_text_open_read`,
 * `file_text_read_string`, `file_text_readln`, `file_text_eof`).
 */
import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
export declare function file_exists(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): boolean;
export declare function file_text_open_read(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): number;
export declare function file_text_open_write(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): number;
export declare function file_text_open_append(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): number;
export declare function file_text_read_string(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): string;
export declare function file_text_read_real(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): number;
export declare function file_text_readln(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): void;
export declare function file_text_eof(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): boolean;
export declare function file_text_write_string(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
  value: string,
): void;
export declare function file_text_write_real(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
  value: number,
): void;
export declare function file_text_writeln(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): void;
export declare function file_text_close(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): void;
export declare function file_delete(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): void;
//# sourceMappingURL=gmlFileText.d.ts.map
