/**
 * Calls the transpiler cannot bind statically.
 *
 * GameMaker scripts run in the caller's instance, so a generated script
 * function takes `(entity, ctx, ...args)`; a GML method (a function literal)
 * closes over its own instance and takes only its arguments. Script modules
 * register their functions here so `script_execute` and calls through a
 * variable (`callback()`, `grid[i][1](x)`) can tell the two apart and find a
 * script by name.
 */
import type { Entity } from "../Entity.js";
import type { GmlActionContext } from "./gmlActions.js";
/**
 * Marks `fn` as a script-level function (called with the caller's entity and
 * context). Accepts any parameter types: a generated script declares its own
 * (`a: number`), and the runtime only ever forwards GML values.
 */
export declare function registerGmlScript(
  fn: (entity: Entity, ctx: GmlActionContext, ...args: never[]) => unknown,
): void;
/**
 * GameMaker's `script_execute(script, ...args)`, also used for any call
 * through a value: a registered script (by function or by name) gets the
 * caller's entity and context, any other function just the arguments.
 * Anything that is not callable yields `undefined` with a warning.
 */
export declare function script_execute(
  entity: Entity,
  ctx: GmlActionContext,
  target: unknown,
  ...args: unknown[]
): unknown;
/**
 * Stand-in for a function the project calls but that neither the project
 * nor the engine defines: warns once per name and returns `undefined`, so
 * the rest of the event keeps running (GameMaker would refuse to compile;
 * the import report lists every such name).
 */
export declare function gmlUnknown(name: string): (...args: unknown[]) => any;
