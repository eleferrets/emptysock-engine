import { describe, it, expect, afterEach, beforeEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildSoundAsset, sniffAudioExtension } from "../gms2-sound-import.js";
import {
  resetFfmpegAvailabilityCache,
  type ExecFileFn,
} from "../audioCompress.js";

// ---------------------------------------------------------------------------
// A real GMS2 sound resource's on-disk audio file routinely has NO file
// extension at all (confirmed against a real project, a real, full
// GameMaker project — every one of its sounds/<name>/<name> files is a
// real RIFF/WAVE file with no .wav suffix). buildSoundAsset used to copy
// it out with `path.extname()`'s empty string, producing an unplayable
// extensionless asset (Howler can't pick a decoder without a real
// extension or explicit format). This sniffs the real container format
// from the file's own magic bytes instead.
// ---------------------------------------------------------------------------

// A minimal, real, valid RIFF/WAVE header — just enough for the sniffer
// (and any real WAVE parser) to recognise the container.
function makeWavHeader(): Buffer {
  const buf = Buffer.alloc(16);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  return buf;
}

function makeOggHeader(): Buffer {
  const buf = Buffer.alloc(16);
  buf.write("OggS", 0, "ascii");
  return buf;
}

describe("sniffAudioExtension", () => {
  it("recognises a real RIFF/WAVE header", () => {
    expect(sniffAudioExtension(makeWavHeader())).toBe(".wav");
  });

  it("recognises a real Ogg (OggS) header", () => {
    expect(sniffAudioExtension(makeOggHeader())).toBe(".ogg");
  });

  it("recognises an ID3-tagged MP3", () => {
    const buf = Buffer.alloc(16);
    buf.write("ID3", 0, "ascii");
    expect(sniffAudioExtension(buf)).toBe(".mp3");
  });

  it("recognises a bare MP3 frame sync with no ID3 tag", () => {
    const buf = Buffer.from([0xff, 0xfb, 0x90, 0x00]);
    expect(sniffAudioExtension(buf)).toBe(".mp3");
  });

  it("recognises an M4A/MP4 ftyp box", () => {
    const buf = Buffer.alloc(16);
    buf.writeUInt32BE(0x18, 0);
    buf.write("ftyp", 4, "ascii");
    expect(sniffAudioExtension(buf)).toBe(".m4a");
  });

  it("falls back to .ogg for an unrecognised header rather than throwing", () => {
    expect(sniffAudioExtension(Buffer.from([0, 0, 0, 0]))).toBe(".ogg");
  });
});

describe("buildSoundAsset — real GMS2 extensionless audio file", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("copies the audio file with a real .wav extension recovered from its magic bytes", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-noext-"));
    const soundDir = path.join(dir, "sounds", "snd_test");
    await fs.mkdir(soundDir, { recursive: true });
    // Matches a real project's real on-disk shape: the audio file's name
    // has no extension at all.
    await fs.writeFile(path.join(soundDir, "snd_test"), makeWavHeader());
    await fs.writeFile(
      path.join(soundDir, "snd_test.yy"),
      `{"name":"snd_test","volume":1.0,"loop":false,"soundFile":"snd_test",}`,
      "utf-8",
    );

    const out = path.join(dir, "out");
    const { content } = await buildSoundAsset("snd_test", dir, out);

    expect(content).toContain('src: "./assets/sounds/snd_test.wav"');
    const copiedExists = await fs
      .access(path.join(out, "assets", "sounds", "snd_test.wav"))
      .then(() => true)
      .catch(() => false);
    expect(copiedExists).toBe(true);
  });

  it("still trusts a real on-disk extension as-is", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-ext-"));
    const soundDir = path.join(dir, "sounds", "snd_test2");
    await fs.mkdir(soundDir, { recursive: true });
    await fs.writeFile(path.join(soundDir, "snd_test2.ogg"), makeOggHeader());
    await fs.writeFile(
      path.join(soundDir, "snd_test2.yy"),
      `{"name":"snd_test2","volume":1.0,"loop":false,"soundFile":"snd_test2.ogg",}`,
      "utf-8",
    );

    const out = path.join(dir, "out");
    const { content } = await buildSoundAsset("snd_test2", dir, out);
    expect(content).toContain('src: "./assets/sounds/snd_test2.ogg"');
  });
});

describe("buildSoundAsset — compress option", () => {
  let dir: string | undefined;

  beforeEach(() => resetFfmpegAvailabilityCache());
  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  async function makeWavSound(
    soundName: string,
  ): Promise<{ dir: string; out: string }> {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-compress-"));
    const soundDir = path.join(dir, "sounds", soundName);
    await fs.mkdir(soundDir, { recursive: true });
    await fs.writeFile(
      path.join(soundDir, `${soundName}.wav`),
      makeWavHeader(),
    );
    await fs.writeFile(
      path.join(soundDir, `${soundName}.yy`),
      `{"name":"${soundName}","volume":1.0,"loop":false,"soundFile":"${soundName}.wav",}`,
      "utf-8",
    );
    const out = path.join(dir, "out");
    return { dir, out };
  }

  it("does nothing extra when compress is not set — plain uncompressed copy, no warning", async () => {
    const { dir: d, out } = await makeWavSound("snd_a");
    const result = await buildSoundAsset("snd_a", d, out);
    expect(result.warning).toBeUndefined();
    expect(result.content).toContain('src: "./assets/sounds/snd_a.wav"');
    const wavExists = await fs
      .access(path.join(out, "assets", "sounds", "snd_a.wav"))
      .then(() => true)
      .catch(() => false);
    expect(wavExists).toBe(true);
  });

  it("transcodes to .ogg and rewrites the descriptor's src when compress succeeds", async () => {
    const { dir: d, out } = await makeWavSound("snd_b");
    const execImpl: ExecFileFn = async (cmd, args) => {
      if (args[0] === "-version") return { stdout: "ffmpeg", stderr: "" };
      // Simulate ffmpeg actually producing the output file, since
      // buildSoundAsset never copies a second time on the success path.
      const outIdx = args.length - 1;
      await fs.writeFile(args[outIdx] as string, Buffer.from("fake-ogg-bytes"));
      return { stdout: "", stderr: "" };
    };
    const result = await buildSoundAsset("snd_b", d, out, {
      compress: true,
      execImpl,
    });
    expect(result.warning).toBeUndefined();
    expect(result.content).toContain('src: "./assets/sounds/snd_b.ogg"');
    const oggExists = await fs
      .access(path.join(out, "assets", "sounds", "snd_b.ogg"))
      .then(() => true)
      .catch(() => false);
    expect(oggExists).toBe(true);
  });

  it("falls back to an uncompressed copy with an honest warning when ffmpeg is unavailable", async () => {
    const { dir: d, out } = await makeWavSound("snd_c");
    const execImpl: ExecFileFn = () => Promise.reject(new Error("ENOENT"));
    const result = await buildSoundAsset("snd_c", d, out, {
      compress: true,
      execImpl,
    });
    expect(result.warning).toMatch(/snd_c/);
    expect(result.warning).toMatch(/ffmpeg not found/i);
    expect(result.content).toContain('src: "./assets/sounds/snd_c.wav"');
    const wavExists = await fs
      .access(path.join(out, "assets", "sounds", "snd_c.wav"))
      .then(() => true)
      .catch(() => false);
    expect(wavExists).toBe(true);
  });

  it("never attempts compression on an already-compressed source (.ogg)", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-sound-compress-ogg-"));
    const soundDir = path.join(dir, "sounds", "snd_d");
    await fs.mkdir(soundDir, { recursive: true });
    await fs.writeFile(path.join(soundDir, "snd_d.ogg"), makeOggHeader());
    await fs.writeFile(
      path.join(soundDir, "snd_d.yy"),
      `{"name":"snd_d","volume":1.0,"loop":false,"soundFile":"snd_d.ogg",}`,
      "utf-8",
    );
    const out = path.join(dir, "out");
    let execCalled = false;
    const execImpl: ExecFileFn = () => {
      execCalled = true;
      return Promise.resolve({ stdout: "", stderr: "" });
    };
    const result = await buildSoundAsset("snd_d", dir, out, {
      compress: true,
      execImpl,
    });
    expect(execCalled).toBe(false);
    expect(result.warning).toBeUndefined();
    expect(result.content).toContain('src: "./assets/sounds/snd_d.ogg"');
  });
});
