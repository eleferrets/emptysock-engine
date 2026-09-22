// VsCodeService — "Open in VS Code" toolbar action.
//
// Per ENGINE_DESIGN.md §20 this is deliberately NOT a theme/extension import:
// it just launches the user's own installed VS Code against the current
// project folder. Behaviour differs by host, and the browser-preview case is
// a real limitation, not a bug to paper over — see the two mode functions
// below.

import { useIDEStore } from "../store/ideStore";

export interface OpenInVsCodeResult {
  ok: boolean;
  message: string;
}

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface OpenInVsCodeCommandResult {
  success: boolean;
  error: string | null;
}

async function openInVsCodeTauri(
  projectPath: string,
): Promise<OpenInVsCodeResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<OpenInVsCodeCommandResult>("open_in_vscode", {
    path: projectPath,
  });
  if (result.success) {
    return { ok: true, message: `Opening ${projectPath} in VS Code.` };
  }
  return {
    ok: false,
    message: result.error ?? "Could not launch VS Code.",
  };
}

// The File System Access API (what the browser preview's project picker
// uses — see ProjectService.openDirectoryBrowser) hands back a
// FileSystemDirectoryHandle, which exposes only a `name`, never a real OS
// path. There is no browser API that recovers one. That means the
// `vscode://file/<absolute-path>` URI scheme — which *can* open a real
// installed VS Code Desktop, but only given a real absolute path — has
// nothing to open in this mode. `realPath` is threaded through (rather than
// hardcoded to "never available") so this stays correct if a future browser
// API, or a host wrapper, ever supplies one.
function openInVsCodeBrowser(realPath: string | null): OpenInVsCodeResult {
  if (realPath !== null && realPath.startsWith("/")) {
    window.location.href = `vscode://file${realPath}`;
    return {
      ok: true,
      message: "Handed off to your OS. VS Code should be opening now.",
    };
  }
  return {
    ok: false,
    message:
      "Browser preview projects aren't on disk — there's no real file path to hand VS Code. Use the desktop app to open in VS Code.",
  };
}

export const VsCodeService = {
  async openInVsCode(): Promise<OpenInVsCodeResult> {
    const projectRoot = useIDEStore.getState().projectRoot;
    if (projectRoot === null) {
      return { ok: false, message: "No project open." };
    }
    if (isTauri()) {
      return openInVsCodeTauri(projectRoot);
    }
    // Browser mode: projectRoot is normally only ever a directory handle's
    // `name` (see ProjectService.openDirectoryBrowser), never an absolute
    // path. It's still passed through rather than hardcoded to null, so a
    // real absolute path is honoured if one is ever available (a future
    // browser API, or a host wrapper) instead of silently discarded.
    return openInVsCodeBrowser(projectRoot);
  },
};
