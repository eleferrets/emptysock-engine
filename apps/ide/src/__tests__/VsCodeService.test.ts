import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useIDEStore } from "../store/ideStore";

// Mock the Tauri invoke API before importing the service under test.
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

import { VsCodeService } from "../services/VsCodeService";

function setTauriPresent(present: boolean): void {
  if (present) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      configurable: true,
    });
  } else {
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  }
}

beforeEach(() => {
  useIDEStore.getState().resetProject();
  mockInvoke.mockReset();
  setTauriPresent(false);
});

afterEach(() => {
  setTauriPresent(false);
});

describe("VsCodeService.openInVsCode", () => {
  it("returns a no-project message when nothing is open", async () => {
    useIDEStore.setState({ projectRoot: null });
    const result = await VsCodeService.openInVsCode();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no project open/i);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("Tauri mode: invokes open_in_vscode with the project path and reports success", async () => {
    setTauriPresent(true);
    useIDEStore.setState({ projectRoot: "/home/dev/my-game" });
    mockInvoke.mockResolvedValue({ success: true, error: null });

    const result = await VsCodeService.openInVsCode();

    expect(mockInvoke).toHaveBeenCalledWith("open_in_vscode", {
      path: "/home/dev/my-game",
    });
    expect(result.ok).toBe(true);
    expect(result.message).toContain("/home/dev/my-game");
  });

  it("Tauri mode: surfaces the command's own error message on failure", async () => {
    setTauriPresent(true);
    useIDEStore.setState({ projectRoot: "/home/dev/my-game" });
    mockInvoke.mockResolvedValue({
      success: false,
      error: "Could not launch the `code` command (not found)",
    });

    const result = await VsCodeService.openInVsCode();

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/could not launch/i);
  });

  it("browser mode: builds a vscode:// URI when a real absolute path is available", async () => {
    setTauriPresent(false);
    useIDEStore.setState({ projectRoot: "/home/dev/my-game" });

    // jsdom refuses to actually navigate; intercept the href setter instead
    // of asserting on a real navigation, which is all this code can do.
    let assignedHref = "";
    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        set href(value: string) {
          assignedHref = value;
        },
        get href() {
          return assignedHref;
        },
      },
      configurable: true,
    });

    const result = await VsCodeService.openInVsCode();

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(assignedHref).toBe("vscode://file/home/dev/my-game");
  });

  it("browser mode: explains the limitation instead of silently doing nothing", async () => {
    setTauriPresent(false);
    // Browser-mode projectRoot is only ever a directory handle's `name`
    // (see ProjectService.openDirectoryBrowser), never a real path.
    useIDEStore.setState({ projectRoot: "my-game" });

    const result = await VsCodeService.openInVsCode();

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/aren't on disk/i);
    expect(result.message).toMatch(/desktop app/i);
  });
});
