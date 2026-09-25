import { describe, it, expect, beforeEach } from "vitest";
import {
  compressAudioFile,
  ffmpegAvailable,
  resetFfmpegAvailabilityCache,
  type ExecFileFn,
} from "../audioCompress.js";

// These tests never shell out to a real ffmpeg binary — every case stubs
// `execImpl` so the decision logic (available vs. not, success vs.
// failure) is exercised deterministically regardless of what's installed
// in the environment running the suite.

function stubExec(
  behaviour: (
    cmd: string,
    args: string[],
  ) => Promise<{ stdout: string; stderr: string }>,
): ExecFileFn {
  return behaviour;
}

describe("ffmpegAvailable", () => {
  beforeEach(() => resetFfmpegAvailabilityCache());

  it("reports true when the probe command succeeds", async () => {
    const exec = stubExec(() =>
      Promise.resolve({ stdout: "ffmpeg version 6.0", stderr: "" }),
    );
    expect(await ffmpegAvailable(exec)).toBe(true);
  });

  it("reports false when the probe command fails (not installed)", async () => {
    const exec = stubExec(() =>
      Promise.reject(new Error("ENOENT: ffmpeg not found")),
    );
    expect(await ffmpegAvailable(exec)).toBe(false);
  });

  it("caches the result across calls (does not re-probe every time)", async () => {
    let calls = 0;
    const exec = stubExec(() => {
      calls++;
      return Promise.resolve({ stdout: "", stderr: "" });
    });
    await ffmpegAvailable(exec);
    await ffmpegAvailable(exec);
    await ffmpegAvailable(exec);
    expect(calls).toBe(1);
  });
});

describe("compressAudioFile", () => {
  beforeEach(() => resetFfmpegAvailabilityCache());

  it("falls back gracefully (skipped, honest reason) when ffmpeg is not on PATH", async () => {
    const exec = stubExec(() => Promise.reject(new Error("ENOENT")));
    const result = await compressAudioFile("in.wav", "out/name", {}, exec);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/ffmpeg not found/i);
    expect(result.reason).toMatch(/uncompressed/i);
  });

  it("invokes ffmpeg with real libvorbis args by default and reports the real .ogg output path", async () => {
    let calledArgs: string[] = [];
    const exec = stubExec((cmd, args) => {
      if (args[0] === "-version")
        return Promise.resolve({ stdout: "ffmpeg", stderr: "" });
      calledArgs = args;
      return Promise.resolve({ stdout: "", stderr: "" });
    });
    const result = await compressAudioFile("in.wav", "out/name", {}, exec);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.outPath).toBe("out/name.ogg");
    expect(result.outExt).toBe(".ogg");
    expect(calledArgs).toContain("libvorbis");
    expect(calledArgs).toContain("in.wav");
    expect(calledArgs).toContain("out/name.ogg");
  });

  it("uses libopus and .opus when codec: 'opus' is requested", async () => {
    let calledArgs: string[] = [];
    const exec = stubExec((cmd, args) => {
      if (args[0] === "-version")
        return Promise.resolve({ stdout: "ffmpeg", stderr: "" });
      calledArgs = args;
      return Promise.resolve({ stdout: "", stderr: "" });
    });
    const result = await compressAudioFile(
      "in.wav",
      "out/name",
      { codec: "opus", quality: 64 },
      exec,
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.outPath).toBe("out/name.opus");
    expect(calledArgs).toContain("libopus");
    expect(calledArgs).toContain("64k");
  });

  it("falls back gracefully when the transcode itself fails (ffmpeg present, encode errors)", async () => {
    const exec = stubExec((cmd, args) => {
      if (args[0] === "-version")
        return Promise.resolve({ stdout: "ffmpeg", stderr: "" });
      return Promise.reject(
        new Error("Invalid data found when processing input"),
      );
    });
    const result = await compressAudioFile("in.wav", "out/name", {}, exec);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/transcode.*failed/i);
    expect(result.reason).toMatch(/uncompressed/i);
  });
});
