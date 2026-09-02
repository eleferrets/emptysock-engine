import * as fs from "node:fs";
import * as path from "node:path";

/** Maps GML event names to EmptySock Scene/Entity method names */
const EVENT_MAP: Record<string, string> = {
  Create_0: "onLoad",
  Step_0: "onUpdate",
  Step_1: "onUpdate", // begin step
  Step_2: "onUpdate", // end step
  Draw_0: "onDraw",
  Draw_64: "onDrawGUI",
  Destroy_0: "onDestroy",
  CleanUp_0: "onDestroy",
  Alarm_0: "onAlarm0",
  Alarm_1: "onAlarm1",
  Alarm_2: "onAlarm2",
  Collision_: "onCollision",
  Other_10: "onRoomStart",
  Other_11: "onRoomEnd",
  Other_2: "onGameStart",
  Other_3: "onGameEnd",
};

interface GmsObjectYY {
  name: string;
  eventList?: Array<{ eventtype: number; enumb: number }>;
  parentObjectId?: { name: string } | null;
  spriteId?: { name: string } | null;
  visible?: boolean;
  solid?: boolean;
}

function eventKey(eventtype: number, enumb: number): string {
  const prefixes: Record<number, string> = {
    0: "Create",
    1: "Destroy",
    2: "Alarm",
    3: "Step",
    4: "Collision",
    7: "Other",
    8: "Draw",
    12: "CleanUp",
  };
  return `${prefixes[eventtype] ?? `Event${eventtype}`}_${enumb}`;
}

function methodName(key: string): string {
  // Collision events have keys like "Collision_0", "Collision_1" (enumb = target object index).
  // All collision events map to the same handler regardless of the target object.
  if (key.startsWith("Collision_")) return "onCollision";
  return EVENT_MAP[key] ?? `on_${key.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
}

/** Generate a TypeScript class stub from a GMS2 object .yy file */
export function gmlObjectToTypeScript(yyPath: string): string {
  const raw = fs.readFileSync(yyPath, "utf8");
  const obj = JSON.parse(raw) as GmsObjectYY;
  const className = obj.name ?? path.basename(yyPath, ".yy");
  const parent = obj.parentObjectId?.name ?? null;
  const sprite = obj.spriteId?.name ?? null;

  const events = obj.eventList ?? [];
  const methods = events.map((ev) => {
    const key = eventKey(ev.eventtype, ev.enumb);
    const name = methodName(key);
    const isUpdate = name === "onUpdate";
    const sig = isUpdate ? "onUpdate(dt: number): void" : `${name}(): void`;
    return `  ${sig} {\n    // GML event: ${key}\n  }`;
  });

  const imports = ["Scene", "Entity"];
  const classLine = parent
    ? `export class ${className} extends ${parent}`
    : `export class ${className} extends Scene`;

  const header = [
    `import { ${imports.join(", ")} } from '@emptysock/engine';`,
    ...(sprite ? [`// Original sprite: ${sprite}`] : []),
    "",
    classLine + " {",
    `  constructor() {`,
    `    super('${className}');`,
    `  }`,
  ].join("\n");

  const body = methods.length > 0 ? "\n" + methods.join("\n\n") : "";
  return `${header}${body}\n}\n`;
}

/** Convert all .yy object files in a directory tree */
export function gmlObjectDirToTypeScript(
  dir: string,
): Array<{ name: string; code: string }> {
  const results: Array<{ name: string; code: string }> = [];
  const walk = (d: string): void => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(d, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".yy")) {
        try {
          const raw = fs.readFileSync(path.join(d, entry.name), "utf8");
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          if (parsed["modelName"] === "GMObject" || parsed["resourceType"] === "GMObject") {
            const code = gmlObjectToTypeScript(path.join(d, entry.name));
            results.push({ name: entry.name.replace(/\.yy$/, ".ts"), code });
          }
        } catch {
          /* skip malformed files */
        }
      }
    }
  };
  walk(dir);
  return results;
}
