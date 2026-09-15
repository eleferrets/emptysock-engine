import { useIDEStore } from "../../../store/ideStore";
import type { AssetItem } from "../../../store/ideStore";

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
    project = JSON.parse(raw) as YYProject;
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
  const newAssets: AssetItem[] = [];

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
      newAssets.push({
        id: `gms2-spr-${Date.now()}-${name}`,
        name,
        type: "image",
        path: `gms2/sprites/${name}`,
      });
      spriteCount += 1;
    }
  }
  if (newAssets.length > 0) addItems(newAssets);

  addLog(
    "info",
    `GMS2 import complete: ${scriptCount} scripts, ${spriteCount} sprites, ${objectCount} objects`,
    "GMS2",
  );
}
