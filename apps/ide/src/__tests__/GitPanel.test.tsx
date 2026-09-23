import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { GitPanel } from "../components/panels/GitPanel.js";

/**
 * Covers the GitPanel's browser-preview path (no `__TAURI_INTERNALS__`,
 * per CLAUDE.md's "Tauri detection at runtime" — the same compiled bundle
 * runs here and in the desktop WebView). In this mode GitPanel falls back
 * to its mock status/history data and disables Push, since there is no
 * real git process to shell out to (see "Open in VS Code" / the new
 * `run_git` Tauri command's browser-preview equivalent).
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderPanel(): Promise<void> {
  await act(async () => {
    root.render(<GitPanel />);
    await Promise.resolve();
  });
}

describe("GitPanel — browser-preview mode", () => {
  it("shows the current tab affordances and a disabled Push button", async () => {
    await renderPanel();
    expect(container.textContent).toContain("Git");
    expect(container.textContent).toContain("Changes");
    expect(container.textContent).toContain("History");

    const pushButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent.includes("Push"),
    );
    expect(pushButton).toBeDefined();
    expect(pushButton?.disabled).toBe(true);
  });

  it("shows mock changed files by default and mock commit history on the History tab", async () => {
    await renderPanel();
    expect(container.textContent).toContain("src/scenes/GameScene.ts");

    const historyTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "History",
    );
    expect(historyTab).toBeDefined();
    await act(async () => {
      historyTab?.click();
      await Promise.resolve();
    });
    expect(container.textContent).toContain("initial commit");
  });

  it("shows the browser-preview disclaimer on the Changes tab", async () => {
    await renderPanel();
    expect(container.textContent).toContain("Preview — no git repo connected");
  });
});
