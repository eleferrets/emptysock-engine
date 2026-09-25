import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { buildSoundAsset, sniffAudioExtension } from "../gms2-sound-import.js";

// ---------------------------------------------------------------------------
// A real GMS2 sound resource's on-disk audio file routinely has NO file
// extension at all (confirmed against Freedom Backup, a real, full
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
    // Matches Freedom Backup's real on-disk shape: the audio file's name
    // has no extension at all.
    await fs.writeFile(path.join(soundDir, "snd_test"), makeWavHeader());
    await fs.writeFile(
      path.join(soundDir, "snd_test.yy"),
      `{"name":"snd_test","volume":1.0,"loop":false,"soundFile":"snd_test",}`,
      "utf-8",
    );

    const out = path.join(dir, "out");
    const content = await buildSoundAsset("snd_test", dir, out);

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
    const content = await buildSoundAsset("snd_test2", dir, out);
    expect(content).toContain('src: "./assets/sounds/snd_test2.ogg"');
  });
});
