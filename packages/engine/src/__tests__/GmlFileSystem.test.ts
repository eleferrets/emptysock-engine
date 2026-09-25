import { describe, expect, it } from "vitest";
import { GmlFileSystem } from "../systems/GmlFileSystem.js";
import { MemoryStorageAdapter } from "../systems/StorageAdapter.js";

describe("GmlFileSystem", () => {
  it("reads a preloaded (included) file line by line, matching real GameMaker file_text_* semantics", () => {
    const fs = new GmlFileSystem();
    fs.preload("lang.txt", "line one\nline two\nline three");

    const file = fs.openRead("lang.txt");
    expect(file).not.toBe(-1);
    expect(fs.eof(file)).toBe(false);
    expect(fs.readString(file)).toBe("line one");
    fs.readln(file);
    expect(fs.readString(file)).toBe("line two");
    fs.readln(file);
    expect(fs.readString(file)).toBe("line three");
    fs.readln(file);
    expect(fs.eof(file)).toBe(true);
    fs.close(file);
  });

  it("openRead on a nonexistent file returns -1 — real gap: this used to have no implementation at all", () => {
    const fs = new GmlFileSystem();
    expect(fs.openRead("missing.txt")).toBe(-1);
  });

  it("a write-then-read round-trips within the same session — real GameMaker save/load idiom", () => {
    const fs = new GmlFileSystem();
    const w = fs.openWrite("save.dat");
    fs.writeReal(w, 12);
    fs.writeln(w);
    fs.writeString(w, "checkpoint_a");
    fs.close(w);

    const r = fs.openRead("save.dat");
    expect(fs.readReal(r)).toBe(12);
    fs.readln(r);
    expect(fs.readString(r)).toBe("checkpoint_a");
    fs.close(r);
  });

  it("openAppend preserves existing content and appends after it", () => {
    const fs = new GmlFileSystem();
    fs.preload("log.txt", "first\n");
    const a = fs.openAppend("log.txt");
    fs.writeString(a, "second");
    fs.close(a);

    const r = fs.openRead("log.txt");
    expect(fs.readString(r)).toBe("first");
    fs.readln(r);
    expect(fs.readString(r)).toBe("second");
  });

  it("close persists to the injected StorageAdapter, and hydrate() pulls it back after a restart", async () => {
    const adapter = new MemoryStorageAdapter();
    const fs1 = new GmlFileSystem(adapter);
    const w = fs1.openWrite("persist.dat");
    fs1.writeString(w, "kills=5");
    fs1.close(w);

    // Simulate a restart: a fresh GmlFileSystem, same backing adapter.
    const fs2 = new GmlFileSystem(adapter);
    expect(fs2.fileExists("persist.dat")).toBe(false);
    await fs2.hydrate();
    expect(fs2.fileExists("persist.dat")).toBe(true);
    const r = fs2.openRead("persist.dat");
    expect(fs2.readString(r)).toBe("kills=5");
  });

  it("deleteFile removes both the in-memory and persisted copy", async () => {
    const adapter = new MemoryStorageAdapter();
    const fs = new GmlFileSystem(adapter);
    const w = fs.openWrite("temp.dat");
    fs.writeString(w, "x");
    fs.close(w);
    expect(fs.fileExists("temp.dat")).toBe(true);

    fs.deleteFile("temp.dat");
    expect(fs.fileExists("temp.dat")).toBe(false);
    expect(await adapter.get("gmlfile:temp.dat")).toBeNull();
  });

  it("readReal returns 0 for a non-numeric line, matching a safe honest fallback", () => {
    const fs = new GmlFileSystem();
    fs.preload("f.txt", "not a number");
    const r = fs.openRead("f.txt");
    expect(fs.readReal(r)).toBe(0);
  });
});
