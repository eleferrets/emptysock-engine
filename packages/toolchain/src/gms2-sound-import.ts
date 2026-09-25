import { promises as fs } from "node:fs";
import path from "node:path";
import { parseGmsJson } from "./gms2-parse.js";
import {
  compressAudioFile,
  type AudioCodec,
  type ExecFileFn,
} from "./audioCompress.js";

/** Audio file extensions this importer knows how to carry through as-is. */
const AUDIO_EXTENSIONS = [".ogg", ".wav", ".mp3", ".m4a"];

/**
 * A real GMS2 sound resource's on-disk audio file routinely has NO file
 * extension at all — confirmed against a real, full GameMaker project
 * (Freedom Backup's `sounds/snd_Foot1/snd_Foot1` is a real RIFF/WAVE file
 * with no `.wav` suffix; every sound in that project follows this same
 * pattern). `soundFile` in the `.yy` just names the on-disk file, extension
 * or not — GameMaker's own player doesn't need an extension since it reads
 * the format from the file's own magic bytes, decoded once at import time.
 *
 * `AudioSystem` is Howler-backed, and Howler needs a real extension on the
 * `src` URL (or an explicit `format` option) to pick a decoder — an
 * extensionless copy silently produces an unplayable sound with no error
 * until the browser's `<audio>`/WebAudio decode fails at runtime. This
 * sniffs the real container format from the file's own magic bytes (the
 * same signatures every format's own spec defines — RIFF/WAVE, OggS, an
 * MP3 frame sync or ID3 tag, and MPEG-4/M4A's `ftyp` box) so a real audio
 * file with no extension on disk still gets copied out with the correct
 * one, and only falls back to `.ogg` when the format genuinely can't be
 * determined from the bytes themselves.
 */
export function sniffAudioExtension(header: Buffer): string {
  if (
    header.length >= 12 &&
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WAVE"
  ) {
    return ".wav";
  }
  if (header.length >= 4 && header.toString("ascii", 0, 4) === "OggS") {
    return ".ogg";
  }
  if (header.length >= 3 && header.toString("ascii", 0, 3) === "ID3") {
    return ".mp3";
  }
  // A bare MP3 frame sync (no ID3 tag): first 11 bits set.
  if (
    header.length >= 2 &&
    header[0] === 0xff &&
    ((header[1] ?? 0) & 0xe0) === 0xe0
  ) {
    return ".mp3";
  }
  if (header.length >= 8 && header.toString("ascii", 4, 8) === "ftyp") {
    return ".m4a";
  }
  return ".ogg";
}

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

export interface BuildSoundAssetOptions {
  /**
   * Opt-in: re-encode the source audio into a compressed format (Ogg/Vorbis
   * by default) at import time via a real `ffmpeg` binary, rather than
   * copying it as-is. `AudioSystem`/Howler already plays every one of
   * `AUDIO_EXTENSIONS` transparently — this option exists to shrink shipped
   * game size, not to fix playback. Never mandatory: when `ffmpeg` isn't on
   * PATH, or the transcode fails, this silently (from the caller's
   * perspective — see the returned `warning`) falls back to copying the
   * original file, exactly as if `compress` had been left off.
   */
  compress?: boolean;
  codec?: AudioCodec;
  quality?: number;
  /** Test-only: stub `execFile` instead of shelling out to a real ffmpeg. */
  execImpl?: ExecFileFn;
}

export interface BuildSoundAssetResult {
  content: string;
  /** Set when `compress: true` was requested but the source wasn't actually transcoded (ffmpeg missing, or the transcode itself failed) — the caller (gms2-import.ts) surfaces this in migration-report.md rather than dropping it. */
  warning?: string;
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
  options: BuildSoundAssetOptions = {},
): Promise<BuildSoundAssetResult> {
  const soundDir = path.join(projectRoot, "sounds", name);
  const sound = await convertGms2Sound(soundDir);

  const assetDir = path.join(outDir, "assets", "sounds");
  await fs.mkdir(assetDir, { recursive: true });

  // A real on-disk extension is trusted as-is; a missing one (the common
  // real GMS2 case — see `sniffAudioExtension`'s doc comment) is recovered
  // from the file's own magic bytes rather than emitting an unplayable
  // extensionless src.
  const declaredExt = path.extname(sound.audioPath);
  const ext =
    declaredExt.length > 0
      ? declaredExt
      : sniffAudioExtension(
          await (async () => {
            const handle = await fs.open(sound.audioPath, "r");
            try {
              const header = Buffer.alloc(16);
              await handle.read(header, 0, 16, 0);
              return header;
            } finally {
              await handle.close();
            }
          })(),
        );

  let destName = `${name}${ext}`;
  let warning: string | undefined;

  // Compression only makes sense against an uncompressed source — .ogg,
  // .mp3, and .m4a are already compressed, and re-encoding a lossy source
  // through another lossy codec only loses more quality for no size
  // benefit worth having. Only .wav is genuinely uncompressed PCM.
  if (options.compress === true && ext.toLowerCase() === ".wav") {
    const result = await compressAudioFile(
      sound.audioPath,
      path.join(assetDir, name),
      {
        ...(options.codec !== undefined ? { codec: options.codec } : {}),
        ...(options.quality !== undefined ? { quality: options.quality } : {}),
      },
      options.execImpl,
    );
    if (result.success) {
      // ffmpeg wrote the compressed output directly to
      // assetDir/<name><result.outExt> — nothing left to copy.
      destName = `${name}${result.outExt}`;
    } else {
      warning = `Sound "${name}": ${result.reason}`;
      await fs.copyFile(sound.audioPath, path.join(assetDir, destName));
    }
  } else {
    await fs.copyFile(sound.audioPath, path.join(assetDir, destName));
  }

  const relPath = `./assets/sounds/${destName}`;
  const groupLine =
    sound.group !== undefined
      ? `\n  group: ${JSON.stringify(sound.group)},`
      : "";

  const content = `// Auto-generated from GMS2 sound: ${name}
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

  return warning !== undefined ? { content, warning } : { content };
}
