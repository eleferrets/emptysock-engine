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

type GmlScript = (
  entity: Entity,
  ctx: GmlActionContext,
  ...args: unknown[]
) => unknown;

const scripts = new WeakSet<object>();
const scriptsByName = new Map<string, GmlScript>();

/**
 * Marks `fn` as a script-level function (called with the caller's entity and
 * context). Accepts any parameter types: a generated script declares its own
 * (`a: number`), and the runtime only ever forwards GML values.
 */
export function registerGmlScript(
  fn: (entity: Entity, ctx: GmlActionContext, ...args: never[]) => unknown,
): void {
  scripts.add(fn);
  scriptsByName.set(fn.name, fn as GmlScript);
}

/**
 * GameMaker's `script_execute(script, ...args)`, also used for any call
 * through a value: a registered script (by function or by name) gets the
 * caller's entity and context, any other function just the arguments.
 * Anything that is not callable yields `undefined` with a warning.
 */
export function script_execute(
  entity: Entity,
  ctx: GmlActionContext,
  target: unknown,
  ...args: unknown[]
): unknown {
  const fn = typeof target === "string" ? scriptsByName.get(target) : target;
  if (typeof fn !== "function") {
    console.warn(
      `[GML] script_execute: ${String(target)} is not a script or method.`,
    );
    return undefined;
  }
  if (scripts.has(fn)) return (fn as GmlScript)(entity, ctx, ...args);
  return (fn as (...a: unknown[]) => unknown)(...args);
}

const warned = new Set<string>();

/**
 * Stand-in for a function the project calls but that neither the project
 * nor the engine defines: warns once per name and returns `undefined`, so
 * the rest of the event keeps running (GameMaker would refuse to compile;
 * the import report lists every such name).
 */
// The call does nothing and yields `undefined`, but is typed `any`: generated code uses the result as a number, string or instance.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function gmlUnknown(name: string): (...args: unknown[]) => any {
  return () => {
    if (!warned.has(name)) {
      warned.add(name);
      console.warn(`[GML] ${name}() is not supported; the call does nothing.`);
    }
    return undefined;
  };
}
