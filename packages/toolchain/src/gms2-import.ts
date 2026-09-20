import fs from "fs/promises";
import path from "path";
import { convertGms2Sprite } from "./gms2-sprite-import.js";
import { convertGms2Room } from "./gms2-room-import.js";

interface YYPResource {
  id: { name: string; path: string };
  order: number;
}

interface YYProject {
  resources: YYPResource[];
  defaultScriptType: number; // 0 = GML, 1 = GML Visual
  // Real .yyp files carry the project name under "%Name" at the root —
  // there is no plain "name" key there (unlike most nested resources,
  // which redundantly carry both "%Name" and "name").
  name?: string;
  "%Name"?: string;
}

export interface ImportResult {
  converted: number;
  skipped: string[];
  warnings: string[];
}

/**
 * Real GMS2 .yy/.yyp files are not strict JSON: GameMaker's IDE writes a
 * trailing comma before every closing `}`/`]`. JSON.parse rejects this
 * outright. Strip trailing commas before parsing so real project files
 * (not just hand-written test fixtures) parse correctly.
 */
export function parseGmsJson(raw: string): unknown {
  const stripped = raw.replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// ---------------------------------------------------------------------------
// GML pattern-level transpiler
// ---------------------------------------------------------------------------

/**
 * Apply regex-based pattern replacements to a GML source string and return
 * the resulting TypeScript snippet.
 *
 * Transformations are applied in order; later passes do not re-process text
 * produced by earlier ones (single-pass sequential replacement).
 */
function transpileGML(gml: string): string {
  let out = gml;

  // -- Variable declarations -------------------------------------------------
  // global.x = expr  →  export let x = expr; // was global.x
  out = out.replace(
    /\bglobal\.(\w+)\s*=\s*([^;\n]+)/g,
    (_m, varName: string, expr: string) =>
      `export let ${varName} = ${expr.trimEnd()}; // was global.${varName}`,
  );
  // var x = expr  →  let x = expr;
  out = out.replace(/\bvar\b(\s+\w+\s*=)/g, "let$1");

  // -- Control flow ----------------------------------------------------------
  // repeat(n) { ... }  →  for (let _i = 0; _i < n; _i++) { ... }
  out = out.replace(
    /\brepeat\s*\(([^)]+)\)/g,
    (_m, n: string) => `for (let _i = 0; _i < ${n.trim()}; _i++)`,
  );
  // for loops: var → let inside for initialiser
  out = out.replace(/\bfor\s*\(\s*var\b/g, "for (let");
  // exit  →  return;
  out = out.replace(/\bexit\b/g, "return;");

  // -- GML built-ins → EmptySock / JS equivalents ---------------------------

  // instance_create_layer
  out = out.replace(
    /\binstance_create_layer\s*\([^)]*\)\s*;?/g,
    "// TODO: scene.createEntity() and add ObjX component",
  );
  // instance_destroy
  out = out.replace(
    /\binstance_destroy\s*\(\s*\)\s*;?/g,
    "// entity.destroy();",
  );

  // audio_play_sound(snd, priority, loop)
  out = out.replace(
    /\baudio_play_sound\s*\(\s*([^,)]+)\s*,\s*[^,)]+\s*,\s*([^)]+)\s*\)\s*;?/g,
    (_m, _snd: string, loop: string) =>
      `// audioSystem.play('sound_name', { loop: ${loop.trim()} });`,
  );

  // room_goto(rm_next)
  out = out.replace(
    /\broom_goto\s*\(\s*([^)]+)\s*\)\s*;?/g,
    (_m, rm: string) => `// sceneManager.load('${rm.trim()}');`,
  );

  // draw_sprite
  out = out.replace(
    /\bdraw_sprite\s*\([^)]*\)\s*;?/g,
    "// Sprite component handles drawing declaratively",
  );

  // alarm[n] = expr
  out = out.replace(
    /\balarm\s*\[\s*\d+\s*\]\s*=\s*([^;\n]+)/g,
    (_m, expr: string) =>
      `// entity.startCoroutine(waitFrames(${expr.trimEnd()}));`,
  );

  // show_message(msg)
  out = out.replace(
    /\bshow_message\s*\(\s*([^)]+)\s*\)\s*;?/g,
    (_m, msg: string) => `console.log(${msg.trim()});`,
  );

  // Math helpers — order matters: more specific first
  out = out.replace(
    /\birandom_range\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, a: string, b: string) =>
      `Math.floor(Math.random() * (${b.trim()} - ${a.trim()} + 1)) + ${a.trim()}`,
  );
  out = out.replace(
    /\birandom\s*\(\s*([^)]+)\s*\)/g,
    (_m, n: string) => `Math.floor(Math.random() * (${n.trim()} + 1))`,
  );
  out = out.replace(
    /\brandom\s*\(\s*([^)]+)\s*\)/g,
    (_m, n: string) => `Math.random() * ${n.trim()}`,
  );

  out = out.replace(
    /\blerp\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, a: string, b: string, t: string) =>
      `${a.trim()} + (${b.trim()} - ${a.trim()}) * ${t.trim()}`,
  );
  out = out.replace(
    /\bclamp\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, v: string, lo: string, hi: string) =>
      `Math.min(Math.max(${v.trim()}, ${lo.trim()}), ${hi.trim()})`,
  );
  out = out.replace(
    /\babs\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.abs(${x.trim()})`,
  );
  out = out.replace(
    /\bfloor\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.floor(${x.trim()})`,
  );
  out = out.replace(
    /\bceil\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.ceil(${x.trim()})`,
  );
  out = out.replace(
    /\bround\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.round(${x.trim()})`,
  );
  out = out.replace(
    /\bsqrt\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.sqrt(${x.trim()})`,
  );
  out = out.replace(
    /\bpower\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, x: string, y: string) => `Math.pow(${x.trim()}, ${y.trim()})`,
  );
  out = out.replace(
    /\blengthdir_x\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, len: string, dir: string) =>
      `${len.trim()} * Math.cos(${dir.trim()} * Math.PI / 180)`,
  );
  out = out.replace(
    /\blengthdir_y\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, len: string, dir: string) =>
      `${len.trim()} * Math.sin(${dir.trim()} * Math.PI / 180)`,
  );
  out = out.replace(
    /\bpoint_distance\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, x1: string, y1: string, x2: string, y2: string) =>
      `Math.hypot(${x2.trim()} - ${x1.trim()}, ${y2.trim()} - ${y1.trim()})`,
  );
  out = out.replace(
    /\bstring_length\s*\(\s*([^)]+)\s*\)/g,
    (_m, s: string) => `${s.trim()}.length`,
  );
  out = out.replace(
    /\bstring\s*\(\s*([^)]+)\s*\)/g,
    (_m, v: string) => `String(${v.trim()})`,
  );

  return out;
}

/**
 * Attempt to read and transpile a GML event file. Returns the transpiled
 * method body lines (indented), or null if the file doesn't exist.
 */
async function readAndTranspileGML(gmlPath: string): Promise<string | null> {
  try {
    const source = await fs.readFile(gmlPath, "utf-8");
    return transpileGML(source);
  } catch {
    return null;
  }
}

/**
 * Indent each non-empty line of a multi-line string by `spaces` spaces.
 */
function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

async function buildObjectStub(
  name: string,
  projectRoot: string,
): Promise<string> {
  const className = toPascalCase(name);

  // Look for GML event files alongside the .yy file.
  const objectDir = path.join(projectRoot, "objects", name);

  // Scan for available .gml files in the object dir, matching known event prefixes.
  let gmlFiles: string[] = [];
  try {
    const entries = await fs.readdir(objectDir);
    gmlFiles = entries.filter((e) => e.endsWith(".gml"));
  } catch {
    // directory doesn't exist — no GML available, emit pure stubs
  }

  async function buildMethod(
    methodName: string,
    eventLabel: string,
    paramStr: string,
    prefixRe: RegExp,
  ): Promise<string> {
    const gmlFile = gmlFiles.find((f) => prefixRe.test(f));
    if (gmlFile) {
      const gmlPath = path.join(objectDir, gmlFile);
      const transpiled = await readAndTranspileGML(gmlPath);
      if (transpiled !== null) {
        const body = indent(transpiled.trimEnd(), 4);
        return `  ${methodName}(${paramStr}): void {\n    // [GML auto-transpiled — review carefully]\n${body}\n  }`;
      }
    }
    return `  ${methodName}(${paramStr}): void {\n    // TODO: migrate ${eventLabel}\n  }`;
  }

  const onCreate = await buildMethod(
    "onCreate",
    "Create event",
    "",
    /^Create_/i,
  );
  const onUpdate = await buildMethod(
    "onUpdate",
    "Step event",
    "_dt: number",
    /^Step_/i,
  );
  const onDraw = await buildMethod("onDraw", "Draw event", "", /^Draw_/i);
  const onDestroy = await buildMethod(
    "onDestroy",
    "Destroy event",
    "",
    /^Destroy_/i,
  );

  // -- Collision events -------------------------------------------------------
  // GMS2 names one file per colliding object: Collision_<other object>.gml.
  // Emit one onCollideWith<Other>(other) method per file found.
  const collisionFiles = gmlFiles.filter((f) => /^Collision_/i.test(f));
  const collisionMethods: string[] = [];
  for (const gmlFile of collisionFiles) {
    const otherName = gmlFile
      .replace(/^Collision_/i, "")
      .replace(/\.gml$/i, "");
    const otherClass = toPascalCase(otherName);
    const gmlPath = path.join(objectDir, gmlFile);
    const transpiled = await readAndTranspileGML(gmlPath);
    const body =
      transpiled !== null
        ? indent(transpiled.trimEnd(), 4)
        : `    // TODO: migrate collision with ${otherName}`;
    collisionMethods.push(
      `  onCollideWith${otherClass}(_other: Entity): void {\n    // [GML auto-transpiled from Collision_${otherName}.gml — review carefully]\n${body}\n  }`,
    );
  }

  // -- Keyboard events ----------------------------------------------------------
  // GMS2 keyboard events are named by virtual key code (GameMaker vk_* constants).
  // 37-40 are the arrow keys; anything else falls back to a generic name.
  const vkNames: Record<string, string> = {
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
  function vkMethodName(prefix: string, code: string): string {
    const label = vkNames[code] ?? `Vk${code}`;
    return `${prefix}${label}`;
  }

  async function buildKeyMethods(
    filePrefix: RegExp,
    methodPrefix: string,
    eventLabel: string,
  ): Promise<string[]> {
    const files = gmlFiles.filter((f) => filePrefix.test(f));
    const methods: string[] = [];
    for (const gmlFile of files) {
      const match = /_(\d+)\.gml$/i.exec(gmlFile);
      const code = match?.[1] ?? "0";
      const methodName = vkMethodName(methodPrefix, code);
      const gmlPath = path.join(objectDir, gmlFile);
      const transpiled = await readAndTranspileGML(gmlPath);
      const body =
        transpiled !== null
          ? indent(transpiled.trimEnd(), 4)
          : `    // TODO: migrate ${eventLabel} (vk ${code})`;
      methods.push(
        `  ${methodName}(): void {\n    // [GML auto-transpiled from ${gmlFile} — review carefully]\n${body}\n  }`,
      );
    }
    return methods;
  }

  const keyPressMethods = await buildKeyMethods(
    /^KeyPress_/i,
    "onKeyPress",
    "KeyPress event",
  );
  const keyReleaseMethods = await buildKeyMethods(
    /^KeyRelease_/i,
    "onKeyRelease",
    "KeyRelease event",
  );

  const extraMethods = [
    ...collisionMethods,
    ...keyPressMethods,
    ...keyReleaseMethods,
  ];
  const extraBlock =
    extraMethods.length > 0 ? "\n" + extraMethods.join("\n") : "";

  return `// Auto-generated from GMS2 object: ${name}
// Review and replace GML logic with EmptySock equivalents.
import { Entity, Component } from '@emptysock/engine';

export class ${className} extends Component {
${onCreate}
${onUpdate}
${onDraw}
${onDestroy}${extraBlock}
}
`;
}

/**
 * Build a TypeScript Sprite-asset descriptor from a converted GMS2 sprite,
 * plus copy its frame PNGs into `<outDir>/assets/sprites/<name>/`.
 * Returns the descriptor's .ts source; throws on missing/unreadable frames.
 */
async function buildSpriteAsset(
  name: string,
  projectRoot: string,
  outDir: string,
): Promise<string> {
  const spriteDir = path.join(projectRoot, "sprites", name);
  const sprite = await convertGms2Sprite(spriteDir);

  const assetDir = path.join(outDir, "assets", "sprites", name);
  await fs.mkdir(assetDir, { recursive: true });

  const frameFiles: string[] = [];
  for (let i = 0; i < sprite.frames.length; i++) {
    const frame = sprite.frames[i];
    if (frame === undefined) continue;
    const destName = `frame_${i}.png`;
    await fs.copyFile(frame.imagePath, path.join(assetDir, destName));
    frameFiles.push(destName);
  }

  const relBase = `./assets/sprites/${name}/`;
  return `// Auto-generated from GMS2 sprite: ${name}
// Use with @emptysock/engine's Sprite component:
//   new Sprite({ texturePath: ${JSON.stringify(relBase + (frameFiles[0] ?? "frame_0.png"))} })
export const ${toPascalCase(name)}Sprite = {
  name: ${JSON.stringify(name)},
  width: ${sprite.width},
  height: ${sprite.height},
  frameCount: ${sprite.frameCount},
  frames: ${JSON.stringify(frameFiles.map((f) => relBase + f))},
} as const;
`;
}

/**
 * Build a TypeScript Scene descriptor from a converted GMS2 room: one
 * entity spawn per room instance, referencing the imported object classes.
 */
async function buildRoomScene(
  name: string,
  projectRoot: string,
  objects: string[],
): Promise<string> {
  const roomYyPath = path.join(projectRoot, "rooms", name, `${name}.yy`);
  const room = await convertGms2Room(roomYyPath);

  const knownObjects = new Set(objects);
  const usedClasses = new Set<string>();
  const spawnLines: string[] = [];

  for (const layer of room.layers) {
    for (const inst of layer.instances) {
      if (!knownObjects.has(inst.objectName)) {
        spawnLines.push(
          `    // NOTE: object "${inst.objectName}" was not imported (skipped or missing) — spawn omitted`,
        );
        continue;
      }
      const className = toPascalCase(inst.objectName);
      usedClasses.add(className);
      spawnLines.push(
        `    scene.createEntity().addComponent(new ${className}()).transform.setPosition(${inst.x}, ${inst.y});`,
      );
    }
  }

  const imports = [...usedClasses]
    .map((c) => `import { ${c} } from '../${c}.js';`)
    .join("\n");

  return `// Auto-generated from GMS2 room: ${name}
// Load with: scene.loadRoom${toPascalCase(name)}(scene)
${imports}

export function loadRoom${toPascalCase(name)}(scene: {
  createEntity: () => { addComponent: (c: unknown) => { transform: { setPosition: (x: number, y: number) => void } } };
}): void {
  // Room size: ${room.width}x${room.height}
${spawnLines.join("\n")}
}
`;
}

function scriptStub(name: string): string {
  return `// Auto-generated from GMS2 script: ${name}
// Migrate GML functions to TypeScript below.
// Import GML compat helpers if needed: import * as GML from '@emptysock/engine/compat';

export function placeholder_${name}(): void {
  // TODO: migrate GML script body
}
`;
}

function projectEntrypoint(objects: string[]): string {
  if (objects.length === 0) {
    return `// Auto-generated EmptySock project entrypoint
// No objects were imported.
`;
  }

  const imports = objects
    .map((name) => {
      const className = toPascalCase(name);
      return `import { ${className} } from './${name}.js';`;
    })
    .join("\n");

  const registrations = objects
    .map((name) => {
      const className = toPascalCase(name);
      return `  // scene.registerComponent(${className});`;
    })
    .join("\n");

  return `// Auto-generated EmptySock project entrypoint
// Import your Scene and register components as needed.
${imports}

// Register components with your scene:
export function registerAll(): void {
${registrations}
}
`;
}

function migrationReport(opts: {
  projectName: string;
  objects: string[];
  scripts: string[];
  rooms: string[];
  sprites: string[];
  sounds: string[];
  tilesets: string[];
  manualRooms: string[];
  manualSprites: string[];
  warnings: string[];
}): string {
  const {
    projectName,
    objects,
    scripts,
    rooms,
    sprites,
    sounds,
    tilesets,
    manualRooms,
    manualSprites,
    warnings,
  } = opts;

  const manualAssets: string[] = [
    ...manualRooms.map(
      (r) => `- Room: \`${r}\` (conversion failed — see warnings)`,
    ),
    ...manualSprites.map(
      (s) => `- Sprite: \`${s}\` (conversion failed — see warnings)`,
    ),
    ...sounds.map((s) => `- Sound: \`${s}\``),
    ...tilesets.map((t) => `- Tileset: \`${t}\``),
  ];

  const totalFound =
    objects.length +
    scripts.length +
    rooms.length +
    manualRooms.length +
    sprites.length +
    manualSprites.length +
    sounds.length +
    tilesets.length;
  const totalConverted =
    objects.length + scripts.length + rooms.length + sprites.length;

  const warningSection =
    warnings.length > 0
      ? `\n## Warnings\n\n${warnings.map((w) => `- ${w}`).join("\n")}\n`
      : "";

  return `# GMS2 Migration Report — ${projectName}

## Asset Summary

| Category | Count |
|----------|-------|
| Objects (converted) | ${objects.length} |
| Scripts (converted) | ${scripts.length} |
| Rooms (converted) | ${rooms.length} |
| Rooms (manual) | ${manualRooms.length} |
| Sprites (converted) | ${sprites.length} |
| Sprites (manual) | ${manualSprites.length} |
| Sounds (manual) | ${sounds.length} |
| Tilesets (manual) | ${tilesets.length} |
| **Total found** | **${totalFound}** |
| **Total converted** | **${totalConverted}** |

## Converted Assets

Objects and scripts have been emitted as TypeScript stubs in this directory.
See \`project.ts\` for the generated entrypoint.
${warningSection}
## Assets Needing Manual Work

The following asset types have no automatic migration path and must be recreated manually:

${manualAssets.length > 0 ? manualAssets.join("\n") : "_None_"}

## Next Steps

1. **Objects** — open each \`obj_*.ts\` stub and migrate the GML event logic into the corresponding TypeScript method. See [Core Reference](/manual/04-core-reference.md) for Entity/Component APIs.
2. **Scripts** — open each \`scr_*.ts\` stub and migrate the GML function bodies. See [Language Reference](/manual/10-language-reference.md).
3. **Rooms** — recreate your room layouts as EmptySock Scenes. See [Architecture](/manual/03-architecture.md).
4. **Sprites** — import sprite sheets into the IDE asset panel. See [IDE Reference](/manual/07-ide-reference.md).
5. **Sounds** — add audio files via the IDE. See [Systems Reference](/manual/05-systems-reference.md).
6. **Tilesets** — recreate tilesets and wire them to your scenes.
7. **Register components** — call \`registerAll()\` from \`project.ts\` in your scene's \`onLoad()\`.
8. **Physics** — if your GMS2 project used built-in physics, review [Systems Reference § Physics](/manual/05-systems-reference.md).
`;
}

export async function importGMS2Project(
  yypPath: string,
  outDir: string,
  opts?: { dryRun?: boolean; verbose?: boolean },
): Promise<ImportResult> {
  const dryRun = opts?.dryRun ?? false;
  const verbose = opts?.verbose ?? false;

  const warnings: string[] = [];
  const skipped: string[] = [];
  let converted = 0;

  // Read and parse the .yyp file
  let raw: string;
  try {
    raw = await fs.readFile(yypPath, "utf-8");
  } catch {
    throw new Error(`Cannot read .yyp file at "${yypPath}"`);
  }

  let project: YYProject;
  try {
    project = parseGmsJson(raw) as YYProject;
  } catch {
    throw new Error(`Failed to parse .yyp file as JSON: "${yypPath}"`);
  }

  if (!Array.isArray(project.resources)) {
    throw new Error('.yyp file does not contain a "resources" array');
  }

  const projectName =
    project.name ?? project["%Name"] ?? path.basename(path.dirname(yypPath));
  // Root of the GMS2 project — where objects/, scripts/ etc. live.
  const projectRoot = path.dirname(yypPath);

  // NOTE: `defaultScriptType` in real .yyp files does NOT reliably indicate
  // "this project uses GML Visual (drag-and-drop)" — a real, fully
  // text-GML project (verified against the J3 Adventure fixture) can carry
  // defaultScriptType: 1 and still have ordinary .gml files for every
  // event. Whether an individual event is GML Visual is only knowable by
  // checking for the corresponding .gml file per object/event, which
  // buildObjectStub already does (falling back to a TODO stub when no
  // .gml file is found). We no longer emit a project-wide warning from
  // this field alone, since it produced false positives on real projects.

  // Classify assets by the path prefix in each resource's id.path
  const objects: string[] = [];
  const scripts: string[] = [];
  const rooms: string[] = [];
  const sprites: string[] = [];
  const sounds: string[] = [];
  const tilesets: string[] = [];

  for (const res of project.resources) {
    const name = res.id.name;
    const resPath = res.id.path;
    if (!name) {
      warnings.push(`Resource with missing name skipped (path: ${resPath})`);
      continue;
    }

    if (resPath.startsWith("objects/")) {
      objects.push(name);
    } else if (resPath.startsWith("scripts/")) {
      scripts.push(name);
    } else if (resPath.startsWith("rooms/")) {
      rooms.push(name);
    } else if (resPath.startsWith("sprites/")) {
      sprites.push(name);
    } else if (resPath.startsWith("sounds/")) {
      sounds.push(name);
    } else if (resPath.startsWith("tilesets/")) {
      tilesets.push(name);
    } else {
      // Unknown type — skip
      skipped.push(name);
      if (verbose) {
        console.log(
          `  [skip] ${name} (unrecognised resource path: ${resPath})`,
        );
      }
    }
  }

  // Build the list of files to write
  const filesToWrite: { rel: string; content: string }[] = [];

  for (const name of objects) {
    if (verbose) console.log(`  [object] ${name}`);
    const content = await buildObjectStub(name, projectRoot);
    filesToWrite.push({ rel: `${name}.ts`, content });
  }

  for (const name of scripts) {
    if (verbose) console.log(`  [script] ${name}`);
    filesToWrite.push({ rel: `${name}.ts`, content: scriptStub(name) });
  }

  const convertedSprites: string[] = [];
  for (const name of sprites) {
    if (verbose) console.log(`  [sprite] ${name}`);
    try {
      const content = await buildSpriteAsset(name, projectRoot, outDir);
      filesToWrite.push({ rel: `assets/${name}.sprite.ts`, content });
      convertedSprites.push(name);
    } catch (err) {
      warnings.push(
        `Sprite "${name}" could not be converted (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
    }
  }

  const convertedRooms: string[] = [];
  for (const name of rooms) {
    if (verbose) console.log(`  [room] ${name}`);
    try {
      const content = await buildRoomScene(name, projectRoot, objects);
      filesToWrite.push({ rel: `rooms/${name}.ts`, content });
      convertedRooms.push(name);
    } catch (err) {
      warnings.push(
        `Room "${name}" could not be converted (${String(err)}) — skipped, needs manual import.`,
      );
      skipped.push(name);
    }
  }
  for (const name of sounds) {
    if (verbose) console.log(`  [skip/manual] sound: ${name}`);
    skipped.push(name);
  }
  for (const name of tilesets) {
    if (verbose) console.log(`  [skip/manual] tileset: ${name}`);
    skipped.push(name);
  }

  filesToWrite.push({ rel: "project.ts", content: projectEntrypoint(objects) });
  filesToWrite.push({
    rel: "migration-report.md",
    content: migrationReport({
      projectName,
      objects,
      scripts,
      rooms: convertedRooms,
      sprites: convertedSprites,
      sounds,
      tilesets,
      manualRooms: rooms.filter((r) => !convertedRooms.includes(r)),
      manualSprites: sprites.filter((s) => !convertedSprites.includes(s)),
      warnings,
    }),
  });

  if (dryRun) {
    console.log(
      `[dry-run] Would write ${filesToWrite.length} files to: ${outDir}`,
    );
    for (const f of filesToWrite) {
      console.log(`  ${f.rel}`);
    }
  } else {
    await fs.mkdir(outDir, { recursive: true });
    for (const f of filesToWrite) {
      const dest = path.join(outDir, f.rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, f.content, "utf-8");
      if (verbose) console.log(`  wrote: ${dest}`);
    }
  }

  converted =
    objects.length +
    scripts.length +
    convertedRooms.length +
    convertedSprites.length;
  return { converted, skipped, warnings };
}
