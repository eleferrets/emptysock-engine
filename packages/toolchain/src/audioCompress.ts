/**
 * Optional audio transcoding for the GMS2 sound importer (see
 * `gms2-sound-import.ts`'s `buildSoundAsset`). `AudioSystem` is
 * Howler-backed and already plays `.wav`/`.ogg`/`.mp3`/`.m4a` transparently
 * — see CLAUDE.md, playback format is not the gap. The real gap is size:
 * raw GameMaker sound assets are very often uncompressed `.wav`, and
 * shipping those as-is bloats the built game. This module re-encodes an
 * uncompressed source into a real compressed format (Ogg/Vorbis by
 * default, or Opus) at import time.
 *
 * No pure-JS/WASM vorbis/opus *encoder* npm package exists that is both
 * genuinely maintained and produces real, correct output (WASM decoders
 * are common; encoders are not — the few that exist are years-stale or
 * demo-quality). Shelling out to a real `ffmpeg` binary is the honest,
 * pragmatic choice here: it is the de facto standard audio transcoder,
 * widely available, and does the encoding correctly. This is deliberately
 * opt-in and never a hard dependency of the import pipeline — when
 * `ffmpeg` isn't on PATH, or the transcode itself fails, this module
 * reports that honestly (`skipped: true` + a `reason`) and the caller
 * falls back to copying the original file uncompressed rather than
 * fabricating a "compressed" file or aborting the whole import.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const defaultExec = promisify(execFile);

/** The subset of `child_process.execFile` (promisified) this module needs — narrow enough to stub in tests without touching the real binary. */
export type ExecFileFn = (
  cmd: string,
  args: string[],
) => Promise<{ stdout: string | Buffer; stderr: string | Buffer }>;

export type AudioCodec = "vorbis" | "opus";

export interface CompressAudioOptions {
  /** @default "vorbis" */
  codec?: AudioCodec;
  /** Vorbis: `-q:a` (0-10, higher = better/bigger). Opus: kbps bitrate. */
  quality?: number;
}

export type CompressAudioResult =
  | { success: true; outPath: string; outExt: string }
  | { success: false; skipped: true; reason: string };

let _ffmpegAvailable: boolean | undefined;

/** Cached "does `ffmpeg -version` run" check. Real inspection only runs once per process unless `resetFfmpegAvailabilityCache()` is called (tests need this to swap in a stub `execImpl`). */
export async function ffmpegAvailable(
  execImpl: ExecFileFn = defaultExec,
): Promise<boolean> {
  if (_ffmpegAvailable !== undefined) return _ffmpegAvailable;
  try {
    await execImpl("ffmpeg", ["-version"]);
    _ffmpegAvailable = true;
  } catch {
    _ffmpegAvailable = false;
  }
  return _ffmpegAvailable;
}

/** Test-only: clears the cached ffmpeg-availability check. */
export function resetFfmpegAvailabilityCache(): void {
  _ffmpegAvailable = undefined;
}

function extForCodec(codec: AudioCodec): string {
  return codec === "opus" ? ".opus" : ".ogg";
}

/**
 * Transcodes `srcPath` into a compressed file at `destPathNoExt` + the
 * codec's real extension (`.ogg` for vorbis, `.opus` for opus), returning
 * that real output path. Never throws — a missing `ffmpeg`, or a transcode
 * that itself fails, both come back as `{ success: false, skipped: true,
 * reason }` so the caller can honestly fall back to copying the original
 * file, exactly like every other "optional tool not present" gap this
 * toolchain already handles (see `desktopBuild.ts`'s cargo/tauri checks).
 */
export async function compressAudioFile(
  srcPath: string,
  destPathNoExt: string,
  options: CompressAudioOptions = {},
  execImpl: ExecFileFn = defaultExec,
): Promise<CompressAudioResult> {
  const available = await ffmpegAvailable(execImpl);
  if (!available) {
    return {
      success: false,
      skipped: true,
      reason:
        "ffmpeg not found on PATH — copied the original audio file uncompressed instead. " +
        "Install ffmpeg (https://ffmpeg.org/download.html) to enable audio compression on import.",
    };
  }

  const codec = options.codec ?? "vorbis";
  const ext = extForCodec(codec);
  const outPath = `${destPathNoExt}${ext}`;
  const args =
    codec === "opus"
      ? [
          "-y",
          "-i",
          srcPath,
          "-c:a",
          "libopus",
          "-b:a",
          `${options.quality ?? 96}k`,
          outPath,
        ]
      : [
          "-y",
          "-i",
          srcPath,
          "-c:a",
          "libvorbis",
          "-q:a",
          String(options.quality ?? 4),
          outPath,
        ];

  try {
    await execImpl("ffmpeg", args);
    return { success: true, outPath, outExt: ext };
  } catch (err) {
    return {
      success: false,
      skipped: true,
      reason: `ffmpeg transcode of "${srcPath}" failed (${String(err)}) — copied the original audio file uncompressed instead.`,
    };
  }
}
