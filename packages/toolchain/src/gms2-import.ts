import fs from 'fs/promises';
import path from 'path';

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
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function objectStub(name: string): string {
  const className = toPascalCase(name);
  return `// Auto-generated from GMS2 object: ${name}
// Review and replace GML logic with EmptySock equivalents.
import { Entity, Component } from '@emptysock/engine';

export class ${className} extends Component {
  onCreate(): void {
    // TODO: migrate Create event
  }
  onUpdate(_dt: number): void {
    // TODO: migrate Step event
  }
  onDraw(): void {
    // TODO: migrate Draw event
  }
  onDestroy(): void {
    // TODO: migrate Destroy event
  }
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
    .map(name => {
      const className = toPascalCase(name);
      return `import { ${className} } from './${name}.js';`;
    })
    .join('\n');

  const registrations = objects
    .map(name => {
      const className = toPascalCase(name);
      return `  // scene.registerComponent(${className});`;
    })
    .join('\n');

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
  const { projectName, objects, scripts, rooms, sprites, sounds, tilesets, warnings } = opts;

  const manualAssets: string[] = [
    ...rooms.map(r => `- Room: \`${r}\``),
    ...sprites.map(s => `- Sprite: \`${s}\``),
    ...sounds.map(s => `- Sound: \`${s}\``),
    ...tilesets.map(t => `- Tileset: \`${t}\``),
  ];

  const totalFound = objects.length + scripts.length + rooms.length + sprites.length + sounds.length + tilesets.length;
  const totalConverted = objects.length + scripts.length;

  const warningSection =
    warnings.length > 0
      ? `\n## Warnings\n\n${warnings.map(w => `- ${w}`).join('\n')}\n`
      : '';

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

${manualAssets.length > 0 ? manualAssets.join('\n') : '_None_'}

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
  opts?: { dryRun?: boolean; verbose?: boolean }
): Promise<ImportResult> {
  const dryRun = opts?.dryRun ?? false;
  const verbose = opts?.verbose ?? false;

  const warnings: string[] = [];
  const skipped: string[] = [];
  let converted = 0;

  // Read and parse the .yyp file
  let raw: string;
  try {
    raw = await fs.readFile(yypPath, 'utf-8');
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

  if (project.defaultScriptType === 1) {
    warnings.push('Project uses GML Visual (drag-and-drop). Visual events have no text migration path — only object and script stubs are generated.');
  }

  // Classify assets by the path prefix in each resource's id.path
  const objects: string[] = [];
  const scripts: string[] = [];
  const rooms: string[] = [];
  const sprites: string[] = [];
  const sounds: string[] = [];
  const tilesets: string[] = [];

  for (const res of project.resources) {
    const name = res.id?.name;
    const resPath = res.id?.path ?? '';
    if (!name) {
      warnings.push(`Resource with missing name skipped (path: ${resPath})`);
      continue;
    }

    if (resPath.startsWith('objects/')) {
      objects.push(name);
    } else if (resPath.startsWith('scripts/')) {
      scripts.push(name);
    } else if (resPath.startsWith('rooms/')) {
      rooms.push(name);
    } else if (resPath.startsWith('sprites/')) {
      sprites.push(name);
    } else if (resPath.startsWith('sounds/')) {
      sounds.push(name);
    } else if (resPath.startsWith('tilesets/')) {
      tilesets.push(name);
    } else {
      // Unknown type — skip
      skipped.push(name);
      if (verbose) {
        console.log(`  [skip] ${name} (unrecognised resource path: ${resPath})`);
      }
    }
  }

  // Build the list of files to write
  const filesToWrite: { rel: string; content: string }[] = [];

  for (const name of objects) {
    if (verbose) console.log(`  [object] ${name}`);
    filesToWrite.push({ rel: `${name}.ts`, content: objectStub(name) });
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

  filesToWrite.push({ rel: 'project.ts', content: projectEntrypoint(objects) });
  filesToWrite.push({
    rel: 'migration-report.md',
    content: migrationReport({ projectName, objects, scripts, rooms, sprites, sounds, tilesets, warnings }),
  });

  if (dryRun) {
    console.log(`[dry-run] Would write ${filesToWrite.length} files to: ${outDir}`);
    for (const f of filesToWrite) {
      console.log(`  ${f.rel}`);
    }
  } else {
    await fs.mkdir(outDir, { recursive: true });
    for (const f of filesToWrite) {
      const dest = path.join(outDir, f.rel);
      await fs.writeFile(dest, f.content, 'utf-8');
      if (verbose) console.log(`  wrote: ${dest}`);
    }
  }

  converted = objects.length + scripts.length;
  return { converted, skipped, warnings };
}
