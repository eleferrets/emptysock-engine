import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import {
  GameGlobalsPanel,
  validateGlobalName,
  syncGlobals,
  renameGlobal,
} from "../components/panels/GameGlobalsPanel.js";
import { useGameGlobalsStore } from "../store/gameGlobalsStore.js";
import { ALL_MODULES } from "../services/ModuleRegistry.js";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("game globals helpers", () => {
  it("validates identifiers and duplicates", () => {
    expect(validateGlobalName("", {})).not.toBeNull();
    expect(validateGlobalName("1a", {})).not.toBeNull();
    expect(validateGlobalName("score", { score: "number" })).toBe(
      "Already declared.",
    );
    expect(
      validateGlobalName("score", { score: "number" }, "score"),
    ).toBeNull();
    expect(validateGlobalName("$hp_2", {})).toBeNull();
  });

  it("syncs by removing gone names and setting changed ones", () => {
    const calls: string[] = [];
    syncGlobals(
      { a: "number", b: "string" },
      { b: "boolean", c: "number" },
      (n, t) => calls.push(`set ${n}:${t}`),
      (n) => calls.push(`remove ${n}`),
    );
    expect(calls).toEqual(["remove a", "set b:boolean", "set c:number"]);
  });

  it("renames in place, keeping order", () => {
    expect(
      Object.keys(renameGlobal({ a: "x", b: "y", c: "z" }, "b", "q")),
    ).toEqual(["a", "q", "c"]);
  });

  it("is registered as an optional module", () => {
    expect(ALL_MODULES.some((m) => m.id === "globals")).toBe(true);
  });
});

describe("GameGlobalsPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useGameGlobalsStore.setState({ gameGlobals: {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function setInput(el: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const q = <T extends Element>(sel: string): T => {
    const el = container.querySelector<T>(sel);
    if (el === null) throw new Error(`missing ${sel}`);
    return el;
  };
  const addButton = (): HTMLButtonElement => {
    const b = [...container.querySelectorAll("button")].find((x) =>
      x.textContent.includes("+ Add"),
    );
    if (b === undefined) throw new Error("no add button");
    return b;
  };
  const click = (el: Element): void => {
    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("shows an empty state with guidance, then adds a global to the store", () => {
    act(() => root.render(<GameGlobalsPanel />));
    expect(container.textContent).toContain("No globals declared");

    act(() => setInput(q("[aria-label='New global name']"), "score"));
    act(() => setInput(q("[aria-label='New global type']"), "number"));
    click(addButton());

    expect(useGameGlobalsStore.getState().gameGlobals).toEqual({
      score: "number",
    });
    expect(
      container.querySelector("[data-testid='game-global-score']"),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("No globals declared");
  });

  it("blocks invalid and duplicate names", () => {
    useGameGlobalsStore.setState({ gameGlobals: { score: "number" } });
    act(() => root.render(<GameGlobalsPanel />));
    act(() => setInput(q("[aria-label='New global name']"), "score"));
    expect(q("[role='alert']").textContent).toBe("Already declared.");
    expect(addButton().disabled).toBe(true);
  });

  it("undoes and redoes add and remove, keeping the store in step", () => {
    act(() => root.render(<GameGlobalsPanel />));
    act(() => setInput(q("[aria-label='New global name']"), "hp"));
    click(addButton());
    expect(Object.keys(useGameGlobalsStore.getState().gameGlobals)).toEqual([
      "hp",
    ]);

    click(q("[aria-label='Remove hp']"));
    expect(useGameGlobalsStore.getState().gameGlobals).toEqual({});

    click(q("[aria-label='Undo']"));
    expect(useGameGlobalsStore.getState().gameGlobals).toEqual({
      hp: "number",
    });
    click(q("[aria-label='Undo']"));
    expect(useGameGlobalsStore.getState().gameGlobals).toEqual({});
    click(q("[aria-label='Redo']"));
    expect(useGameGlobalsStore.getState().gameGlobals).toEqual({
      hp: "number",
    });
  });

  it("edits a type on blur as one undoable step", () => {
    useGameGlobalsStore.setState({ gameGlobals: { hp: "number" } });
    act(() => root.render(<GameGlobalsPanel />));
    const type = q<HTMLInputElement>("[aria-label='Type of hp']");
    act(() => setInput(type, "string"));
    act(() => {
      type.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(useGameGlobalsStore.getState().gameGlobals["hp"]).toBe("string");
    click(q("[aria-label='Undo']"));
    expect(useGameGlobalsStore.getState().gameGlobals["hp"]).toBe("number");
  });
});
