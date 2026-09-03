import fs from "fs/promises";
import path from "path";

interface YYPResource {
  id: { name: string; path: string };
  order: number;
}

interface YYProject {
  resources: YYPResource[];
  defaultScriptType: number; // 0 = GML, 1 = GML Visual
  name?: string;
}

export interface ImportResult {
  converted: number;
  skipped: string[];
  warnings: string[];
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

  return `// Auto-generated from GMS2 object: ${name}
// Review and replace GML logic with EmptySock equivalents.
import { Entity, Component } from '@emptysock/engine';

export class ${className} extends Component {
${onCreate}
${onUpdate}
${onDraw}
${onDestroy}
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
    warnings,
  } = opts;

  const manualAssets: string[] = [
    ...rooms.map((r) => `- Room: \`${r}\``),
    ...sprites.map((s) => `- Sprite: \`${s}\``),
    ...sounds.map((s) => `- Sound: \`${s}\``),
    ...tilesets.map((t) => `- Tileset: \`${t}\``),
  ];

  const totalFound =
    objects.length +
    scripts.length +
    rooms.length +
    sprites.length +
    sounds.length +
    tilesets.length;
  const totalConverted = objects.length + scripts.length;

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
| Rooms (manual) | ${rooms.length} |
| Sprites (manual) | ${sprites.length} |
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
    project = JSON.parse(raw) as YYProject;
  } catch {
    throw new Error(`Failed to parse .yyp file as JSON: "${yypPath}"`);
  }

  if (!Array.isArray(project.resources)) {
    throw new Error('.yyp file does not contain a "resources" array');
  }

  const projectName = project.name ?? path.basename(path.dirname(yypPath));
  // Root of the GMS2 project — where objects/, scripts/ etc. live.
  const projectRoot = path.dirname(yypPath);

  if (project.defaultScriptType === 1) {
    warnings.push(
      "Project uses GML Visual (drag-and-drop). Visual events have no text migration path — only object and script stubs are generated.",
    );
  }

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

  for (const name of rooms) {
    if (verbose) console.log(`  [skip/manual] room: ${name}`);
    skipped.push(name);
  }
  for (const name of sprites) {
    if (verbose) console.log(`  [skip/manual] sprite: ${name}`);
    skipped.push(name);
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
      rooms,
      sprites,
      sounds,
      tilesets,
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
      await fs.writeFile(dest, f.content, "utf-8");
      if (verbose) console.log(`  wrote: ${dest}`);
    }
  }

  converted = objects.length + scripts.length;
  return { converted, skipped, warnings };
}
