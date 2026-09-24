import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { AssetBrowser } from "../components/panels/AssetBrowser.js";
import { useIDEStore } from "../store/ideStore.js";
import type { AssetItem } from "../store/ideStore.js";

/**
 * Covers AssetBrowser's per-asset-type "open in" dispatch: a double-click
 * routes to the right store action for the asset's type, and an
 * unhandled type (audio/font — no dedicated editor exists yet) doesn't
 * throw or open the wrong panel.
 */

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const ASSETS: AssetItem[] = [
  { id: "a1", name: "hero.png", type: "image", path: "assets/hero.png" },
  { id: "a2", name: "main.ts", type: "script", path: "assets/main.ts" },
  {
    id: "a3",
    name: "level.scene.json",
    type: "scene",
    path: "assets/level.scene.json",
  },
  { id: "a4", name: "hit.wav", type: "audio", path: "assets/hit.wav" },
];

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  useIDEStore.setState({ assets: ASSETS, recentAssetIds: [], openFiles: {} });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function dblClick(name: string): void {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent.includes(name.slice(0, 9)),
  ) as HTMLButtonElement;
  expect(btn).toBeDefined();
  act(() => {
    btn.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
}

describe("AssetBrowser — per-type open-in dispatch", () => {
  it("opens an image asset in the Image Editor", () => {
    const spy = vi.spyOn(useIDEStore.getState(), "openImageEditor");
    act(() => {
      root.render(<AssetBrowser />);
    });
    dblClick("hero.png");
    expect(spy).toHaveBeenCalledWith("a1");
  });

  it("opens a script asset in the Code tab", () => {
    const openFileSpy = vi.spyOn(useIDEStore.getState(), "openFile");
    const panelSpy = vi.spyOn(useIDEStore.getState(), "requestOpenPanel");
    act(() => {
      root.render(<AssetBrowser />);
    });
    dblClick("main.ts");
    expect(openFileSpy).toHaveBeenCalledWith("assets/main.ts");
    expect(panelSpy).toHaveBeenCalledWith("code");
  });

  it("brings the Scene panel into view for a scene asset", () => {
    const panelSpy = vi.spyOn(useIDEStore.getState(), "requestOpenPanel");
    act(() => {
      root.render(<AssetBrowser />);
    });
    dblClick("level.scene.json".slice(0, 9));
    expect(panelSpy).toHaveBeenCalledWith("scene");
  });

  it("does nothing (no crash, no panel opened) for an audio asset — no editor exists for it", () => {
    const panelSpy = vi.spyOn(useIDEStore.getState(), "requestOpenPanel");
    const imgSpy = vi.spyOn(useIDEStore.getState(), "openImageEditor");
    act(() => {
      root.render(<AssetBrowser />);
    });
    expect(() => dblClick("hit.wav")).not.toThrow();
    expect(panelSpy).not.toHaveBeenCalled();
    expect(imgSpy).not.toHaveBeenCalled();
  });
});
