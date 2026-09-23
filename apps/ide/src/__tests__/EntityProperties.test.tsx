import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { EntityProperties } from "../components/panels/EntityProperties.js";
import { useIDEStore } from "../store/ideStore.js";
import { engineChannel } from "../services/EngineChannel.js";

/**
 * Covers RELEASE_PASS.md's "IDE: schema-driven Inspector property panels"
 * bullet — a component whose v2 `ComponentDef` carries `.schema`
 * (ENGINE_DESIGN.md §10.1) gets real typed controls in the Inspector; one
 * with no schema keeps the pre-existing raw per-field text editor.
 */

function makeEntity(
  components: { type: string; properties: Record<string, string> }[],
): void {
  useIDEStore.setState({
    // A real-looking numeric id — live entity ids are always numeric
    // strings (`String(entityId)`, see EngineChannel.ts's `summaryToSnapshot`);
    // handlePatch() only queries the live preview for a numeric id.
    selectedEntityId: "1",
    selectedEntity: {
      id: "1",
      name: "Player",
      type: "Entity",
      transform: { x: "0", y: "0", rotation: "0", scaleX: "1", scaleY: "1" },
      components: components.map((c) => ({ ...c, enabled: true })),
    },
    liveEntities: [],
    liveComponentFields: null,
  } as Partial<ReturnType<typeof useIDEStore.getState>>);
}

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
  vi.restoreAllMocks();
});

describe("EntityProperties — schema-driven Inspector controls", () => {
  it("renders a real checkbox for Sprite.visible (schema field), not a text input", () => {
    makeEntity([
      {
        type: "Sprite",
        properties: {
          texturePath: "player.png",
          visible: "true",
          tint: "16777215",
        },
      },
    ]);

    act(() => {
      root.render(<EntityProperties />);
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(true);

    const numberInput = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement | null;
    expect(numberInput).not.toBeNull();
    expect(numberInput?.value).toBe("16777215");
  });

  it("sends a typed boolean (not the string 'false') when the checkbox is toggled", () => {
    makeEntity([
      {
        type: "Sprite",
        properties: { texturePath: "", visible: "true", tint: "0" },
      },
    ]);
    const spy = vi
      .spyOn(engineChannel, "query")
      .mockResolvedValue({ ok: true, data: {} });

    act(() => {
      root.render(<EntityProperties />);
    });

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;

    // A real click flips `checked` and fires a native "change" event, which
    // is what React's onChange actually listens for — closer to a genuine
    // user gesture than hand-writing the DOM property + event.
    act(() => {
      checkbox.click();
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "setComponent",
        entityId: 1,
        component: "Sprite",
        patch: { visible: false },
      }),
    );
  });

  it("falls back to the raw text editor for a component with no schema", () => {
    makeEntity([
      {
        type: "CharacterController",
        properties: { speed: "200" },
      },
    ]);

    act(() => {
      root.render(<EntityProperties />);
    });

    // No checkbox/select/number control should exist for this component —
    // only the raw text Input fallback.
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.querySelector("select")).toBeNull();
    const rawInputs = Array.from(
      container.querySelectorAll('input[type="text"], input:not([type])'),
    ) as HTMLInputElement[];
    const speedInput = rawInputs.find((i) => i.value === "200");
    expect(speedInput).not.toBeUndefined();
  });

  it("renders an enum field as a populated <select>, hidden if it had no options", () => {
    makeEntity([
      {
        type: "PhysicsBody",
        properties: {
          type: "dynamic",
          shape: "box",
          width: "32",
          height: "32",
          radius: "16",
          density: "1",
          friction: "0.5",
          restitution: "0.2",
          isSensor: "false",
          rotation: "0",
        },
      },
    ]);

    act(() => {
      root.render(<EntityProperties />);
    });

    const selects = container.querySelectorAll("select");
    // `type` and `shape` are both enum fields on PhysicsBody's schema.
    expect(selects.length).toBe(2);
    const typeSelect = Array.from(selects).find((s) =>
      Array.from(s.options).some((o) => o.value === "dynamic"),
    );
    expect(typeSelect).toBeDefined();
    expect(Array.from(typeSelect?.options ?? []).map((o) => o.value)).toEqual([
      "dynamic",
      "static",
      "kinematic",
    ]);
  });

  it("wires undo/redo for a property edit (Ctrl+Z becomes available)", () => {
    makeEntity([
      {
        type: "Sprite",
        properties: { texturePath: "", visible: "true", tint: "0" },
      },
    ]);

    act(() => {
      root.render(<EntityProperties />);
    });

    const undoButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.title.includes("Undo"),
    ) as HTMLButtonElement;
    expect(undoButton.disabled).toBe(true);

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    act(() => {
      checkbox.click();
    });

    expect(undoButton.disabled).toBe(false);
  });
});

describe("EntityProperties — merged component inspector metadata", () => {
  it("resolves both schema-driven controls and a non-default color for a known v2 component from one metadata source", () => {
    makeEntity([
      {
        type: "PhysicsBody",
        properties: {
          type: "dynamic",
          shape: "box",
          width: "32",
          height: "32",
          radius: "16",
          density: "1",
          friction: "0.5",
          restitution: "0.2",
          isSensor: "false",
          rotation: "0",
        },
      },
    ]);

    act(() => {
      root.render(<EntityProperties />);
    });

    // Schema half: PhysicsBody has enum fields, so real <select> controls render.
    expect(container.querySelectorAll("select").length).toBeGreaterThan(0);

    // Color half: the section's dot should not fall back to the muted
    // default color, confirming the color came from the same metadata
    // entry as the schema rather than a missing second map.
    const dot = container.querySelector(
      'div[style*="border-radius: 50%"]',
    ) as HTMLDivElement | null;
    expect(dot).not.toBeNull();
    expect(dot?.style.background).not.toBe("var(--es-text-muted)");
  });

  it("falls back to the raw editor and the default muted color for a component with no metadata entry at all", () => {
    makeEntity([
      {
        type: "TotallyUnknownComponent",
        properties: { foo: "bar" },
      },
    ]);

    act(() => {
      root.render(<EntityProperties />);
    });

    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(container.querySelector("select")).toBeNull();
    const dot = container.querySelector(
      'div[style*="border-radius: 50%"]',
    ) as HTMLDivElement | null;
    expect(dot).not.toBeNull();
    expect(dot?.style.background).toBe("var(--es-text-muted)");
  });
});
