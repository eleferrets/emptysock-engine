import fs from "fs/promises";
import path from "path";
import { convertGms2Sprite } from "./gms2-sprite-import.js";
import { convertGms2Room } from "./gms2-room-import.js";
import { indent, readAndTranspileGML } from "./gms2-transpile.js";

// ---------------------------------------------------------------------------
// Per-asset-kind TypeScript stub/scene codegen.
// ---------------------------------------------------------------------------

export function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export async function buildObjectStub(
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
export async function buildSpriteAsset(
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
export async function buildRoomScene(
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

export function scriptStub(name: string): string {
  return `// Auto-generated from GMS2 script: ${name}
// Migrate GML functions to TypeScript below.
// Import GML compat helpers if needed: import * as GML from '@emptysock/engine/compat';

export function placeholder_${name}(): void {
  // TODO: migrate GML script body
}
`;
}

export function projectEntrypoint(objects: string[]): string {
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
