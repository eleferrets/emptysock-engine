/**
 * Generated TypeScript modules for GameMaker code: one `.behavior.ts` per
 * object (one exported function per event) and one `.ts` per script (its
 * top-level functions). Every GML body goes through the AST emitter
 * (`gml/emit`) against the project's `ProjectSymbols`; this module only
 * decides which files become which functions and assembles imports.
 */

import fs from "fs/promises";
import path from "path";
import { emitEvent, emitScript, type EmitResult } from "./gml/emit/index.js";
import type { BodyKind } from "./gml/emit/types.js";
import type { SourceFile } from "./gml/project-symbols.js";
import {
  resolveGmlObjectChain,
  resolveGmlObjectProperties,
  toPascalCase,
} from "./gms2-codegen.js";
import { loadGmlProject, type GmlProject } from "./gms2-project.js";

/** Indent each non-empty line of `code` by `spaces` spaces. */
export function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/** Collects what the emitted bodies of one module need imported. */
class ModuleImports {
  readonly functions = new Map<string, string>();
  usesEnums = false;
  usesMotion = false;

  add(r: Pick<EmitResult, "imports" | "usesEnums" | "usesMotion">): void {
    for (const [fn, module] of r.imports) this.functions.set(fn, module);
    this.usesEnums ||= r.usesEnums;
    this.usesMotion ||= r.usesMotion;
  }

  /** `import { a, b } from "./m.js";` lines, one per module, skipping `self`. */
  lines(quote: "'" | '"', self?: string): string[] {
    const byModule = new Map<string, string[]>();
    for (const [fn, module] of this.functions) {
      if (module === self) continue;
      byModule.set(module, [...(byModule.get(module) ?? []), fn]);
    }
    return [...byModule].map(
      ([module, fns]) =>
        `import { ${fns.sort().join(", ")} } from ${quote}./${module}.js${quote};`,
    );
  }
}

/** One generated event handler: the emitted body and where it came from. */
interface EventSource {
  owner: string;
  file: string;
}

const EVENT_PARAMS = "_entity: Entity, _ctx: GmlActionContext";

export async function buildObjectBehavior(
  name: string,
  projectRoot: string,
  loaded?: GmlProject,
): Promise<string> {
  const project = loaded ?? (await loadGmlProject(projectRoot));
  const imports = new ModuleImports();
  const chain = await resolveGmlObjectChain(name, projectRoot);
  const filesOf = new Map<string, string[]>();
  for (const obj of chain) {
    const entries = await fs
      .readdir(path.join(projectRoot, "objects", obj))
      .catch(() => [] as string[]);
    filesOf.set(obj, entries.filter((e) => e.endsWith(".gml")).sort());
  }
  const parentExists = new Map<string, boolean>();
  for (const anc of chain.slice(1))
    parentExists.set(
      anc,
      await fs
        .access(path.join(projectRoot, "objects", anc, `${anc}.yy`))
        .then(() => true)
        .catch(() => false),
    );
  const inheritAliases = new Map<string, string>();

  /** The call `event_inherited()` in `owner`'s `handler` becomes, if its parent has a module. */
  const inherited = (owner: string, handler: string, args: string) => () => {
    const parent = chain[chain.indexOf(owner) + 1];
    if (parent === undefined || parentExists.get(parent) !== true)
      return undefined;
    const alias = `__Inherit_${parent.replace(/\W/g, "_")}`;
    inheritAliases.set(parent, alias);
    return `(${alias} as unknown as Record<string, ((...a: unknown[]) => void) | undefined>)[${JSON.stringify(handler)}]?.(${args})`;
  };

  async function emitFile(
    src: EventSource,
    handler: string,
    kind: BodyKind,
    args: string,
  ): Promise<string | undefined> {
    const text = await fs
      .readFile(path.join(projectRoot, "objects", src.owner, src.file), "utf8")
      .catch(() => undefined);
    if (text === undefined) return undefined;
    const file: SourceFile = {
      path: `objects/${src.owner}/${src.file}`,
      text,
      object: name,
      kind: "object",
    };
    const r = emitEvent(file, {
      project: project.symbols,
      kind,
      object: name,
      functionId: `${name}_${handler}`,
      callables: project.callables,
      spriteFrames: project.spriteFrames,
      inherited: inherited(src.owner, handler, args),
      path: file.path,
    });
    imports.add(r);
    return r.code;
  }

  /** The nearest object in the chain with a file matching `pattern` (GameMaker's event inheritance). */
  function sourceFor(pattern: RegExp): EventSource | undefined {
    for (const owner of chain) {
      const file = filesOf.get(owner)?.find((f) => pattern.test(f));
      if (file !== undefined) return { owner, file };
    }
    return undefined;
  }

  /** Emitted body of the event matching `pattern`, if this object or an ancestor has one. */
  async function eventBody(
    handler: string,
    pattern: RegExp,
  ): Promise<{ src: EventSource; body: string } | undefined> {
    const src = sourceFor(pattern);
    if (src === undefined) return undefined;
    const body = await emitFile(src, handler, "event", "_entity, _ctx");
    return body === undefined ? undefined : { src, body };
  }

  /** An exported handler; without any content, a TODO stub or nothing (`optional`). */
  function assemble(
    handler: string,
    label: string,
    params: string,
    event: { src: EventSource; body: string } | undefined,
    extra: {
      prelude?: readonly string[];
      epilogue?: readonly string[];
      optional?: boolean;
    } = {},
  ): string {
    const prelude = extra.prelude ?? [];
    const epilogue = extra.epilogue ?? [];
    if (event === undefined && prelude.length === 0 && epilogue.length === 0)
      return extra.optional === true
        ? ""
        : `export function ${handler}(${params}): void {\n  // TODO: migrate ${label}\n}`;
    const origin =
      event === undefined
        ? []
        : [
            event.src.owner === name
              ? "// [GML auto-transpiled — review carefully]"
              : `// [GML auto-transpiled from parent object '${event.src.owner}' — ${name} has no own ${label}, real GameMaker object-inheritance fallback, review carefully]`,
          ];
    const lines = [
      ...origin,
      ...prelude,
      ...(event ? [event.body] : []),
      ...epilogue,
    ];
    return `export function ${handler}(${params}): void {\n${indent(lines.join("\n"), 2)}\n}`;
  }

  // GMS2.3+ Variable Definitions: defaults applied before the Create event runs.
  const properties = await resolveGmlObjectProperties(name, projectRoot);
  const prelude: string[] = [];
  if (properties.size > 0) {
    prelude.push("// [GMS2.3+ variable-definition defaults]");
    for (const [prop, value] of properties) {
      if (typeof value === "object") {
        const r = emitEvent(
          {
            path: `objects/${name}/${name}.yy`,
            text: `${prop} = ${value.expr};`,
            object: name,
            kind: "object",
          },
          {
            project: project.symbols,
            kind: "event",
            object: name,
            functionId: `${name}_prop_${prop}`,
            callables: project.callables,
            spriteFrames: project.spriteFrames,
          },
        );
        imports.add(r);
        prelude.push(r.code);
      } else {
        prelude.push(
          `GmlActions.setGmlVarDefault(_entity, _ctx, ${JSON.stringify(prop)}, ${JSON.stringify(value)});`,
        );
      }
    }
  }

  const create = await eventBody("onCreate", /^Create_/i);
  const stepBegin = await eventBody("onStepBegin", /^Step_1\.gml$/i);
  const step = await eventBody("onUpdate", /^Step_0\.gml$/i);
  const stepEnd = await eventBody("onStepEnd", /^Step_2\.gml$/i);
  const draw = await eventBody("onDraw", /^Draw_0\.gml$/i);
  const drawGui = await eventBody("onDrawGui", /^Draw_64\.gml$/i);
  const destroy = await eventBody("onDestroy", /^Destroy_/i);
  const stepParams = "_entity: Entity, _dt: number, _ctx: GmlActionContext";
  const onCreate = assemble("onCreate", "Create event", EVENT_PARAMS, create, {
    prelude,
  });
  const onStepBegin = assemble(
    "onStepBegin",
    "Begin Step event",
    EVENT_PARAMS,
    stepBegin,
    { optional: true },
  );
  // DnD motion/alarm actions keep state that gmlActionsStep advances every Step.
  const onUpdate = assemble("onUpdate", "Step event", stepParams, step, {
    epilogue: imports.usesMotion ? ["GmlActions.gmlActionsStep(_entity);"] : [],
  });
  // Animation End (Other_7) fires when the sprite's animation wraps; checked once per step.
  const onStepEnd = assemble(
    "onStepEnd",
    "End Step event",
    EVENT_PARAMS,
    stepEnd,
    {
      optional: true,
      epilogue: (filesOf.get(name) ?? []).includes("Other_7.gml")
        ? [
            "if (GmlActions.gml_animation_ended(_entity)) onOther7(_entity, _ctx);",
          ]
        : [],
    },
  );
  const onDraw = assemble("onDraw", "Draw event", EVENT_PARAMS, draw);
  const onDrawGui = assemble(
    "onDrawGui",
    "Draw GUI event",
    EVENT_PARAMS,
    drawGui,
    { optional: true },
  );
  const onDestroy = assemble(
    "onDestroy",
    "Destroy event",
    EVENT_PARAMS,
    destroy,
  );

  const own = filesOf.get(name) ?? [];
  const extra: string[] = [];
  for (const f of own.filter((x) => /^Collision_/i.test(x))) {
    const other = f.replace(/^Collision_/i, "").replace(/\.gml$/i, "");
    const handler = `onCollideWith${toPascalCase(other)}`;
    const body = await emitFile(
      { owner: name, file: f },
      handler,
      "collision",
      "_entity, _other, _ctx",
    );
    extra.push(
      `export function ${handler}(_entity: Entity, _other: Entity, _ctx: GmlActionContext): void {\n  // [GML auto-transpiled from Collision_${other}.gml — review carefully]\n${body !== undefined ? indent(body, 2) : `  // TODO: migrate collision with ${other}`}\n}`,
    );
  }
  for (const [prefix, method, label] of [
    [/^KeyPress_/i, "onKeyPress", "KeyPress event"],
    [/^KeyRelease_/i, "onKeyRelease", "KeyRelease event"],
  ] as const) {
    for (const f of own.filter((x) => prefix.test(x))) {
      const code = /_(\d+)\.gml$/i.exec(f)?.[1] ?? "0";
      const handler = `${method}${VK_NAMES[code] ?? `Vk${code}`}`;
      const body = await emitFile(
        { owner: name, file: f },
        handler,
        "event",
        "_entity, _ctx",
      );
      extra.push(
        `export function ${handler}(${EVENT_PARAMS}): void {\n  // [GML auto-transpiled from ${f} — review carefully]\n${body !== undefined ? indent(body, 2) : `  // TODO: migrate ${label} (vk ${code})`}\n}`,
      );
    }
  }
  const known =
    /^(Create_|Step_[012]\.gml$|Draw_(0|64)\.gml$|Destroy_|Collision_|KeyPress_|KeyRelease_)/i;
  for (const f of own.filter((x) => !known.test(x))) {
    const base = f.replace(/\.gml$/i, "");
    const handler = `on${toPascalCase(base)}`;
    const body = await emitFile(
      { owner: name, file: f },
      handler,
      "event",
      "_entity, _ctx",
    );
    extra.push(
      `export function ${handler}(${EVENT_PARAMS}): void {\n  // [GML auto-transpiled from ${f} — review carefully; unmapped event kind, verify its real GameMaker semantics before wiring it up]\n${body !== undefined ? indent(body, 2) : `  // TODO: migrate ${base}`}\n}`,
    );
  }
  const extraBlock = extra.length > 0 ? "\n\n" + extra.join("\n\n") : "";

  const unset = project.unsetVarsByObject.get(name) ?? new Set<string>();
  const header =
    unset.size > 0
      ? `// [source bug] ${name}'s GML reads ${[...unset].map((v) => `"${v}"`).join(", ")} without any definition anywhere in the original project (see migration-report.md); these read as 0.\n`
      : "";
  const importLines = [
    ...(imports.usesEnums
      ? ["import * as GmlEnums from './assets/gml-enums.generated.js';"]
      : []),
    ...imports.lines("'"),
    ...[...inheritAliases].map(
      ([p, a]) => `import * as ${a} from './${p}.behavior.js';`,
    ),
  ];
  return `${header}// Auto-generated GMS2 behavior for object: ${name}
// Review and replace GML logic with EmptySock equivalents. Wire these
// functions up to your own prefab instances however your game dispatches
// per-prefab behavior — see ${name}.prefab.json for this object's
// structural (component) data.
//
// Every generated event handler takes a trailing \`_ctx: GmlActionContext\`
// so transpiled GameMaker 8.1 drag-and-drop actions (action_move,
// action_create_object, action_if_collision, ...) have a live Scene/Game to
// act against — see @emptysock/engine's GmlActionContext for what a real
// game needs to wire into it (at minimum { scene }; room/prefab/sound
// actions need more, see that type's own doc comment).
import type { Entity, GmlActionContext } from '@emptysock/engine';
import * as GmlActions from '@emptysock/engine';
${importLines.map((l) => `${l}\n`).join("")}
${onCreate}
${onStepBegin ? `\n${onStepBegin}\n` : ""}
${onUpdate}
${onStepEnd ? `\n${onStepEnd}\n` : ""}
${onDraw}
${onDrawGui ? `\n${onDrawGui}\n` : ""}
${onDestroy}${extraBlock}
`;
}

/** GameMaker key-event suffixes (virtual key codes) with a readable handler name. */
const VK_NAMES: Readonly<Record<string, string>> = {
  "8": "Backspace",
  "13": "Enter",
  "16": "Shift",
  "17": "Control",
  "27": "Escape",
  "32": "Space",
  "37": "Left",
  "38": "Up",
  "39": "Right",
  "40": "Down",
};

/**
 * A script module: every top-level function of `scripts/<name>/<name>.gml`
 * exported with the caller's `(_entity, _ctx)` first and registered for
 * `script_execute`; a legacy script (no `function`) is one function over the
 * whole file with `...args`. A missing file becomes an honest stub.
 */
export async function buildScriptModule(
  name: string,
  projectRoot: string,
  loaded?: GmlProject,
): Promise<string> {
  const gmlPath = path.join(projectRoot, "scripts", name, `${name}.gml`);
  const text = await fs.readFile(gmlPath, "utf-8").catch(() => undefined);
  if (text === undefined) {
    return `// Auto-generated from GMS2 script: ${name}
// The script's .gml source could not be read — likely a stale/orphaned
// project reference. Migrate the GML function body manually.

export function ${name}(
  _entity: unknown,
  _ctx: unknown,
  ...args: unknown[]
): unknown {
  // TODO: migrate GML script body
  return undefined;
}
`;
  }
  const project = loaded ?? (await loadGmlProject(projectRoot));
  const file: SourceFile = {
    path: `scripts/${name}/${name}.gml`,
    text,
    kind: "script",
  };
  const r = emitScript(name, file, {
    project: project.symbols,
    kind: "script",
    functionId: name,
    callables: project.callables,
    spriteFrames: project.spriteFrames,
    path: file.path,
  });
  const imports = new ModuleImports();
  imports.add(r);
  const functions = r.functions.map((fn) => {
    const params = fn.restArgs
      ? "...args: unknown[]"
      : fn.params.map((p) => `${p.name}: ${p.type}`).join(", ");
    const body = indent(fn.body, 2);
    return `export function ${fn.name}(_entity: Entity, _ctx: GmlActionContext, ${params}): ${fn.returnsValue ? "unknown" : "void"} {${body.length > 0 ? `\n${body}\n` : "\n"}}
GmlActions.registerGmlScript(${fn.name});`;
  });
  const dropped =
    r.droppedStatements > 0
      ? `// ${r.droppedStatements} top-level statement(s) outside any function run at game start in GameMaker; not converted.\n`
      : "";
  const importLines = [
    `import type { Entity, GmlActionContext } from "@emptysock/engine";`,
    `import * as GmlActions from "@emptysock/engine";`,
    ...(imports.usesEnums
      ? [`import * as GmlEnums from "./assets/gml-enums.generated.js";`]
      : []),
    ...imports.lines('"', name),
  ];
  return `// Auto-generated from GMS2 script: ${name}
${importLines.join("\n")}
${dropped}
${functions.join("\n\n")}
`;
}
