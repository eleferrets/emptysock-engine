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

function files(ctx: GmlActionContext) {
  const f = ctx.game?.files;
  if (f === undefined) {
    console.warn(
      "[gmlFileText] called with no ctx.game wired — file_text_* is a no-op.",
    );
  }
  return f;
}

export function file_exists(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): boolean {
  return files(ctx)?.fileExists(fname) ?? false;
}

export function file_text_open_read(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): number {
  return files(ctx)?.openRead(fname) ?? -1;
}

export function file_text_open_write(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): number {
  return files(ctx)?.openWrite(fname) ?? -1;
}

export function file_text_open_append(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): number {
  return files(ctx)?.openAppend(fname) ?? -1;
}

export function file_text_read_string(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): string {
  return files(ctx)?.readString(file) ?? "";
}

export function file_text_read_real(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): number {
  return files(ctx)?.readReal(file) ?? 0;
}

export function file_text_readln(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): void {
  files(ctx)?.readln(file);
}

export function file_text_eof(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): boolean {
  return files(ctx)?.eof(file) ?? true;
}

export function file_text_write_string(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
  value: string,
): void {
  files(ctx)?.writeString(file, value);
}

export function file_text_write_real(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
  value: number,
): void {
  files(ctx)?.writeReal(file, value);
}

export function file_text_writeln(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): void {
  files(ctx)?.writeln(file);
}

export function file_text_close(
  _entity: Entity,
  ctx: GmlActionContext,
  file: number,
): void {
  files(ctx)?.close(file);
}

export function file_delete(
  _entity: Entity,
  ctx: GmlActionContext,
  fname: string,
): void {
  files(ctx)?.deleteFile(fname);
}
