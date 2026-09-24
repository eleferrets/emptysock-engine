import { promises as fs } from "node:fs";
import path from "node:path";
import { parseGmsJson } from "./gms2-parse.js";

/** Audio file extensions this importer knows how to carry through as-is. */
const AUDIO_EXTENSIONS = [".ogg", ".wav", ".mp3", ".m4a"];

export interface SoundAsset {
  name: string;
  /** Absolute path to the source audio file on disk. */
  audioPath: string;
  volume: number;
  loop: boolean;
  /** GMS2 "audio group" name, if the resource references one — maps to @emptysock/engine's AudioSystem bus/group concept. */
  group?: string;
}

interface YySound {
  name?: string;
  volume?: number;
  loop?: boolean;
  looping?: boolean;
  /** Real GMS2 sound .yy files name their audio file explicitly here. */
  soundFile?: string;
  audioGroupId?: unknown;
  [key: string]: unknown;
}

function isYySound(val: unknown): val is YySound {
  return typeof val === "object" && val !== null;
}

/**
 * Convert a GMS2 sound resource directory (containing a `.yy` file plus its
 * referenced audio file) into a `SoundAsset`. Real GMS2 sound resources keep
 * their actual audio file (`.ogg`/`.wav`/`.mp3`) sitting alongside the `.yy`
 * in the sound's own resource directory, referenced by name via the `.yy`
 * file's `soundFile` field — unlike sprites, there's no per-frame UUID
 * naming scheme here, just one real audio file per sound resource. Falls
 * back to scanning the directory for a recognised audio extension when
 * `soundFile` is absent or doesn't match anything on disk, since not every
 * GMS2 version writes that field the same way.
 *
 * Throws a descriptive Error if the directory, `.yy` file, or audio file
 * cannot be found/read.
 */
export async function convertGms2Sound(
  soundYyDir: string,
): Promise<SoundAsset> {
  let entries: string[];
  try {
    entries = await fs.readdir(soundYyDir);
  } catch (err) {
    throw new Error(
      `convertGms2Sound: cannot read directory "${soundYyDir}": ${String(err)}`,
    );
  }

  const yyFile = entries.find((e) => e.endsWith(".yy"));
  if (yyFile === undefined) {
    throw new Error(`convertGms2Sound: no .yy file found in "${soundYyDir}"`);
  }

  const yyPath = path.join(soundYyDir, yyFile);
  let raw: string;
  try {
    raw = await fs.readFile(yyPath, "utf-8");
  } catch (err) {
    throw new Error(
      `convertGms2Sound: cannot read "${yyPath}": ${String(err)}`,
    );
  }

  let parsed: unknown;
  try {
    // Real GMS2 .yy files use trailing commas, which JSON.parse rejects —
    // route through the shared trailing-comma-tolerant parser rather than
    // hand-rolling a second one.
    parsed = parseGmsJson(raw);
  } catch (err) {
    throw new Error(
      `convertGms2Sound: invalid JSON in "${yyPath}": ${String(err)}`,
    );
  }

  if (!isYySound(parsed)) {
    throw new Error(
      `convertGms2Sound: unexpected .yy structure in "${yyPath}"`,
    );
  }

  const name =
    typeof parsed.name === "string" ? parsed.name : path.basename(soundYyDir);
  const volume = typeof parsed.volume === "number" ? parsed.volume : 1;
  const loop =
    typeof parsed.loop === "boolean"
      ? parsed.loop
      : typeof parsed.looping === "boolean"
        ? parsed.looping
        : false;
  const group =
    typeof parsed.audioGroupId === "object" &&
    parsed.audioGroupId !== null &&
    typeof (parsed.audioGroupId as { name?: unknown }).name === "string"
      ? ((parsed.audioGroupId as { name?: unknown }).name as string)
      : undefined;

  const declaredFile =
    typeof parsed.soundFile === "string" && parsed.soundFile.length > 0
      ? parsed.soundFile
      : undefined;

  let audioFile: string | undefined =
    declaredFile !== undefined && entries.includes(declaredFile)
      ? declaredFile
      : undefined;

  if (audioFile === undefined) {
    audioFile = entries.find((e) =>
      AUDIO_EXTENSIONS.includes(path.extname(e).toLowerCase()),
    );
  }

  if (audioFile === undefined) {
    throw new Error(
      `convertGms2Sound: no audio file (.ogg/.wav/.mp3/.m4a) found alongside "${yyPath}"`,
    );
  }

  const audioPath = path.join(soundYyDir, audioFile);
  try {
    await fs.access(audioPath);
  } catch {
    throw new Error(
      `convertGms2Sound: audio file "${audioPath}" referenced by "${yyPath}" does not exist on disk`,
    );
  }

  return {
    name,
    audioPath,
    volume,
    loop,
    ...(group !== undefined ? { group } : {}),
  };
}

function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Build a TypeScript sound-asset descriptor from a converted GMS2 sound,
 * plus copy the referenced audio file into `<outDir>/assets/sounds/`. Mirrors
 * `buildSpriteAsset`'s shape (`gms2-codegen.ts`) — a plain `as const`
 * descriptor next to a usage comment — but colocated with the sound
 * conversion logic here rather than in `gms2-codegen.ts`, since that file
 * has ongoing parallel work in flight.
 *
 * The emitted descriptor matches what `@emptysock/engine`'s real
 * `AudioSystem.load(id, src, options)` / `.play(id)` API actually takes —
 * there is no separate "AssetManifest" concept in this engine to target.
 */
export async function buildSoundAsset(
  name: string,
  projectRoot: string,
  outDir: string,
): Promise<string> {
  const soundDir = path.join(projectRoot, "sounds", name);
  const sound = await convertGms2Sound(soundDir);

  const assetDir = path.join(outDir, "assets", "sounds");
  await fs.mkdir(assetDir, { recursive: true });

  const ext = path.extname(sound.audioPath);
  const destName = `${name}${ext}`;
  await fs.copyFile(sound.audioPath, path.join(assetDir, destName));

  const relPath = `./assets/sounds/${destName}`;
  const groupLine =
    sound.group !== undefined
      ? `\n  group: ${JSON.stringify(sound.group)},`
      : "";

  return `// Auto-generated from GMS2 sound: ${name}
// Use with @emptysock/engine's AudioSystem:
//   audio.load(${JSON.stringify(name)}, ${toPascalCase(name)}Sound.src, {
//     volume: ${toPascalCase(name)}Sound.volume,
//     loop: ${toPascalCase(name)}Sound.loop,${sound.group !== undefined ? `\n//     group: ${toPascalCase(name)}Sound.group,` : ""}
//   });
//   audio.play(${JSON.stringify(name)});
export const ${toPascalCase(name)}Sound = {
  name: ${JSON.stringify(name)},
  src: ${JSON.stringify(relPath)},
  volume: ${sound.volume},
  loop: ${sound.loop},${groupLine}
} as const;
`;
}
