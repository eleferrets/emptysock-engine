import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  convertGms2IncludedFiles,
  includedFilesManifestJSON,
} from "../gms2-includedfiles-import.js";
import { importGMS2Project } from "../gms2-import.js";

// ---------------------------------------------------------------------------
// GameMaker's "Included Files" feature (`.yyp`'s IncludedFiles array,
// datafiles/<name> on disk) was entirely unimplemented until this pass —
// confirmed load-bearing in a real project (datafiles/lang.txt, read at
// runtime via file_text_open_read, see gmlFileText.ts/GmlFileSystem.ts).
// ---------------------------------------------------------------------------

describe("convertGms2IncludedFiles", () => {
  let dir: string | undefined;
  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it("copies a real included file from datafiles/ into <out>/included/", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-included-"));
    const projectRoot = path.join(dir, "project");
    const outDir = path.join(dir, "out");
    await fs.mkdir(path.join(projectRoot, "datafiles"), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, "datafiles", "lang.txt"),
      "en=Hello",
      "utf-8",
    );

    const { entries, warnings } = await convertGms2IncludedFiles(
      [
        {
          name: "lang.txt",
          filePath: "datafiles",
          CopyToMask: 153157610357391598,
        },
      ],
      projectRoot,
      outDir,
    );

    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      {
        name: "lang.txt",
        outPath: "included/lang.txt",
        copyToMask: 153157610357391598,
      },
    ]);
    const copied = await fs.readFile(
      path.join(outDir, "included", "lang.txt"),
      "utf-8",
    );
    expect(copied).toBe("en=Hello");

    const manifest = JSON.parse(includedFilesManifestJSON(entries)) as {
      includedFiles: unknown[];
    };
    expect(manifest.includedFiles).toHaveLength(1);
  });

  it("reports a real, honest warning instead of throwing when the source file is missing", async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-included-missing-"));
    const projectRoot = path.join(dir, "project");
    const outDir = path.join(dir, "out");
    await fs.mkdir(projectRoot, { recursive: true });

    const { entries, warnings } = await convertGms2IncludedFiles(
      [{ name: "ghost.txt", filePath: "datafiles" }],
      projectRoot,
      outDir,
    );

    expect(entries).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("ghost.txt");
  });

  it("returns no entries and no warnings when the project has no IncludedFiles at all", async () => {
    const { entries, warnings } = await convertGms2IncludedFiles(
      undefined,
      "/nonexistent",
      "/nonexistent-out",
    );
    expect(entries).toEqual([]);
    expect(warnings).toEqual([]);
  });
});

describe("importGMS2Project end-to-end: IncludedFiles wiring", () => {
  it("writes included-files.json and copies the real file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "gms2-e2e-included-"));
    const out = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-e2e-included-out-"),
    );
    try {
      await fs.writeFile(
        path.join(dir, "project.yyp"),
        `{
          "%Name":"Included Files E2E Test",
          "resources":[],
          "IncludedFiles":[
            {"CopyToMask":-1,"filePath":"datafiles","resourceVersion":"1.0","name":"config.txt","resourceType":"GMIncludedFile",},
          ],
        }`,
        "utf-8",
      );
      await fs.mkdir(path.join(dir, "datafiles"), { recursive: true });
      await fs.writeFile(
        path.join(dir, "datafiles", "config.txt"),
        "difficulty=hard",
        "utf-8",
      );

      await importGMS2Project(path.join(dir, "project.yyp"), out, {
        verbose: false,
      });

      const manifest = JSON.parse(
        await fs.readFile(path.join(out, "included-files.json"), "utf-8"),
      ) as { includedFiles: { name: string; outPath: string }[] };
      expect(manifest.includedFiles).toEqual([
        { name: "config.txt", outPath: "included/config.txt", copyToMask: -1 },
      ]);

      const copied = await fs.readFile(
        path.join(out, "included", "config.txt"),
        "utf-8",
      );
      expect(copied).toBe("difficulty=hard");
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rm(out, { recursive: true, force: true });
    }
  });
});
