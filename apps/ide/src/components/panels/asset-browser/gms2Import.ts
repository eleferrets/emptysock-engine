import { useIDEStore } from "../../../store/ideStore";
import type { AssetItem } from "../../../store/ideStore";
import { getAssetStore } from "../../../services/AssetStore";

// Minimal GMS2 YYP types — only what we parse from the project file.

interface YYPResourceId {
  name: string;
  path: string;
}

interface YYPResource {
  id: YYPResourceId;
}

interface YYProject {
  resources: YYPResource[];
}

// FileSystemDirectoryHandle.values() is an async iterator defined in
// DOM.AsyncIterable which is not in the base lib. Declare it inline.
type DirHandleIterable = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>;
};

/**
 * Recursively finds a child directory handle by path segments (e.g.
 * ["sprites", "obj_Brian"]), or null if any segment is missing.
 */
async function getSubdirectory(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  for (const seg of segments) {
    try {
      dir = await dir.getDirectoryHandle(seg);
    } catch {
      return null;
    }
  }
  return dir;
}

/** Reads the sprite's .yy file and returns the name of its first frame PNG. */
async function findFirstFramePngName(
  spriteDir: FileSystemDirectoryHandle,
): Promise<string | null> {
  const iterable = spriteDir as DirHandleIterable;
  for await (const entry of iterable.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".png")) {
      // GMS2 sprite frame PNGs are named by frame UUID at the sprite
      // directory root — the first one found is a usable preview frame.
      return entry.name;
    }
  }
  return null;
}

export async function importGMS2FromHandle(
  dirHandle: FileSystemDirectoryHandle,
  addItems: (items: AssetItem[]) => void,
): Promise<void> {
  const { openFile, addLog } = useIDEStore.getState();

  let yypHandle: FileSystemFileHandle | null = null;
  const iterable = dirHandle as DirHandleIterable;
  for await (const entry of iterable.values()) {
    if (entry.kind === "file" && entry.name.endsWith(".yyp")) {
      yypHandle = entry as FileSystemFileHandle;
      break;
    }
  }

  if (yypHandle === null) {
    addLog(
      "warn",
      "GMS2 import: no .yyp file found in the selected directory",
      "GMS2",
    );
    return;
  }

  const file = await yypHandle.getFile();
  const raw = await file.text();

  let project: YYProject;
  try {
    // Real GMS2 .yyp files use trailing commas, which JSON.parse rejects.
    project = JSON.parse(raw.replace(/,(\s*[}\]])/g, "$1")) as YYProject;
  } catch {
    addLog("error", "GMS2 import: failed to parse .yyp file as JSON", "GMS2");
    return;
  }

  if (!Array.isArray(project.resources)) {
    addLog("error", "GMS2 import: .yyp file has no resources array", "GMS2");
    return;
  }

  let scriptCount = 0;
  let spriteCount = 0;
  let objectCount = 0;
  let spriteFailCount = 0;
  const newAssets: AssetItem[] = [];
  const assetStore = getAssetStore();

  for (const res of project.resources) {
    const name = res.id.name;
    const resPath = res.id.path;
    if (typeof name !== "string" || name.length === 0) continue;

    if (resPath.startsWith("scripts/")) {
      const stub = `// GMS2 import: ${name}\n// TODO: migrate from GML to TypeScript\n`;
      openFile(`gms2/${name}.ts`, stub);
      scriptCount += 1;
    } else if (resPath.startsWith("objects/")) {
      const stub = `// GMS2 import: ${name}\n// TODO: migrate from GML to TypeScript\n`;
      openFile(`gms2/${name}.ts`, stub);
      objectCount += 1;
    } else if (resPath.startsWith("sprites/")) {
      // GMS2 stores each sprite as a directory containing a .yy file plus
      // one PNG per frame (named by frame UUID, not by sprite name). Read
      // the actual PNG bytes and write them into the project's real asset
      // store — never create an asset entry that only points at a name
      // with nothing behind it.
      const spriteDir = await getSubdirectory(dirHandle, ["sprites", name]);
      const frameFile =
        spriteDir !== null ? await findFirstFramePngName(spriteDir) : null;

      if (spriteDir === null || frameFile === null) {
        addLog(
          "warn",
          `GMS2 import: sprite "${name}" has no readable frame image — skipped. Import it manually via drag-and-drop.`,
          "GMS2",
        );
        spriteFailCount += 1;
        continue;
      }

      try {
        const pngHandle = await spriteDir.getFileHandle(frameFile);
        const pngFile = await pngHandle.getFile();
        const item = await assetStore.write(`gms2_${name}.png`, pngFile);
        newAssets.push(item);
        spriteCount += 1;
      } catch (err) {
        addLog(
          "warn",
          `GMS2 import: sprite "${name}" could not be copied (${String(err)}) — skipped. Import it manually via drag-and-drop.`,
          "GMS2",
        );
        spriteFailCount += 1;
      }
    }
  }
  if (newAssets.length > 0) addItems(newAssets);

  addLog(
    "info",
    `GMS2 import complete: ${scriptCount} scripts, ${spriteCount} sprites, ${objectCount} objects` +
      (spriteFailCount > 0
        ? ` (${spriteFailCount} sprites need manual import)`
        : ""),
    "GMS2",
  );
}
