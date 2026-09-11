// ProjectService — project file save / load.
// Uses File System Access API in browser mode and Tauri fs plugin in desktop mode.

import { useIDEStore } from "../store/ideStore";
import type { FileTreeNode } from "../store/ideStore";
import { tauriAssetStore } from "./AssetStore";

// Stored for re-reading individual files after directory is opened.
let _browserDirHandle: FileSystemDirectoryHandle | null = null;
let _tauriDirPath: string | null = null;

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function saveProjectBrowser(json: string): Promise<void> {
  const handle = await window.showSaveFilePicker({
    suggestedName: "project.emptysock",
    types: [
      {
        description: "EmptySock Project",
        accept: { "application/json": [".emptysock"] },
      },
    ],
  });
  const writable = await handle.createWritable();
  await writable.write(json);
  await writable.close();
}

async function saveProjectTauri(json: string): Promise<void> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  const path = await save({
    filters: [{ name: "EmptySock Project", extensions: ["emptysock"] }],
  });
  if (path === null) return;
  await writeTextFile(path, json);
}

async function loadProjectBrowser(): Promise<string | null> {
  const [handle] = await window.showOpenFilePicker({
    types: [
      {
        description: "EmptySock Project",
        accept: { "application/json": [".emptysock"] },
      },
    ],
    multiple: false,
  });
  if (handle === undefined) return null;
  const file = await handle.getFile();
  return file.text();
}

async function loadProjectTauri(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  const result = await open({
    filters: [{ name: "EmptySock Project", extensions: ["emptysock"] }],
    multiple: false,
  });
  if (typeof result !== "string") return null;
  return readTextFile(result);
}

async function walkDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  basePath: string,
  depth: number,
): Promise<FileTreeNode[]> {
  if (depth <= 0) return [];
  const nodes: FileTreeNode[] = [];
  for await (const [name, entry] of handle.entries()) {
    if (name === "node_modules" || name === ".git") continue;
    const path = basePath === "" ? name : `${basePath}/${name}`;
    if (entry.kind === "directory") {
      const children = await walkDirectoryHandle(
        entry as FileSystemDirectoryHandle,
        path,
        depth - 1,
      );
      nodes.push({ name, path, children });
    } else {
      nodes.push({ name, path });
    }
  }
  nodes.sort((a, b) => {
    const aIsDir = a.children !== undefined;
    const bIsDir = b.children !== undefined;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

async function openDirectoryBrowser(): Promise<void> {
  const handle = await window.showDirectoryPicker();
  _browserDirHandle = handle;
  const tree = await walkDirectoryHandle(handle, "", 4);
  const store = useIDEStore.getState();
  store.setProjectRoot(handle.name);
  store.setFileTree(tree);
}

async function openDirectoryTauri(): Promise<void> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const selected = await open({ directory: true, multiple: false });
  if (typeof selected !== "string") return;

  type TauriEntry = { name: string; path: string; children?: TauriEntry[] };
  const entries = (await readDir(selected, {
    recursive: true,
  })) as TauriEntry[];

  function toNodes(items: TauriEntry[]): FileTreeNode[] {
    return items
      .filter((e) => e.name !== "node_modules" && e.name !== ".git")
      .map((e) => ({
        name: e.name,
        path: e.path,
        ...(e.children !== undefined ? { children: toNodes(e.children) } : {}),
      }));
  }

  _tauriDirPath = selected;
  tauriAssetStore.setRoot(selected);
  const store = useIDEStore.getState();
  store.setProjectRoot(selected);
  store.setFileTree(toNodes(entries));
}

export const ProjectService = {
  async saveProject(): Promise<void> {
    try {
      const json = useIDEStore.getState().saveProjectJson();
      if (isTauri()) {
        await saveProjectTauri(json);
      } else {
        await saveProjectBrowser(json);
      }
      useIDEStore.getState().addLog("info", "Project saved.", "ProjectService");
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      useIDEStore
        .getState()
        .addLog("error", `Save failed: ${String(err)}`, "ProjectService");
    }
  },

  async loadProject(): Promise<void> {
    try {
      const raw = isTauri()
        ? await loadProjectTauri()
        : await loadProjectBrowser();
      if (raw === null) return;
      useIDEStore.getState().loadProject(raw);
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      useIDEStore
        .getState()
        .addLog("error", `Load failed: ${String(err)}`, "ProjectService");
    }
  },

  async openDirectory(): Promise<void> {
    try {
      if (isTauri()) {
        await openDirectoryTauri();
      } else {
        await openDirectoryBrowser();
      }
      useIDEStore
        .getState()
        .addLog("info", "Directory opened.", "ProjectService");
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return;
      useIDEStore
        .getState()
        .addLog("error", `Open failed: ${String(err)}`, "ProjectService");
    }
  },

  async readFile(path: string): Promise<string | null> {
    try {
      if (isTauri()) {
        if (_tauriDirPath === null) return null;
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const { join } = await import("@tauri-apps/api/path");
        const fullPath = await join(_tauriDirPath, path);
        return readTextFile(fullPath);
      }
      if (_browserDirHandle === null) return null;
      const parts = path.split("/").filter(Boolean);
      const fileName = parts.pop();
      if (fileName === undefined) return null;
      let dir: FileSystemDirectoryHandle = _browserDirHandle;
      for (const part of parts) {
        dir = await dir.getDirectoryHandle(part);
      }
      const fileHandle = await dir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      return file.text();
    } catch {
      return null;
    }
  },
};
