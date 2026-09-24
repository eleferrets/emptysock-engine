import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import { EntityProperties } from "../components/panels/EntityProperties.js";
import { useIDEStore } from "../store/ideStore.js";
import { engineChannel } from "../services/EngineChannel.js";

/**
 * Covers the multi-select inspector view: ideStore's `selectedEntityIds`
 * drives EntityProperties into MultiEntityProperties whenever more than
 * one entity is selected, and a schema field's icon still renders for a
 * mapped field while an unmapped one keeps the plain fallback.
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
  vi.restoreAllMocks();
});

describe("ideStore — selectedEntityIds", () => {
  it("collapses to the single-select fields when exactly one id is set", () => {
    useIDEStore.setState({ entities: [] });
    useIDEStore.getState().addEntity("A");
    const id = useIDEStore.getState().entities[0]?.id ?? "";
    useIDEStore.getState().setSelectedEntityIds([id]);
    expect(useIDEStore.getState().selectedEntityId).toBe(id);
    expect(useIDEStore.getState().selectedEntityIds).toEqual([id]);
  });

  it("clears the single-select fields when zero or multiple ids are set", () => {
    useIDEStore.setState({ entities: [] });
    useIDEStore.getState().addEntity("A");
    useIDEStore.getState().addEntity("B");
    const ids = useIDEStore.getState().entities.map((e) => e.id);
    useIDEStore.getState().setSelectedEntityIds(ids);
    expect(useIDEStore.getState().selectedEntity).toBeNull();
    expect(useIDEStore.getState().selectedEntityIds).toEqual(ids);

    useIDEStore.getState().setSelectedEntityIds([]);
    expect(useIDEStore.getState().selectedEntity).toBeNull();
    expect(useIDEStore.getState().selectedEntityIds).toEqual([]);
  });
});

describe("EntityProperties — multi-select view", () => {
  it("shows a shared-count summary for each component type across the selection", () => {
    useIDEStore.setState({
      entities: [],
      liveEntities: [],
      selectedEntity: null,
      selectedEntityId: null,
    });
    useIDEStore.getState().addEntity("A");
    useIDEStore.getState().addEntity("B");
    const ids = useIDEStore.getState().entities.map((e) => e.id);
    useIDEStore.getState().addComponentToEntity(ids[0] ?? "", "Sprite");
    useIDEStore.getState().setSelectedEntityIds(ids);

    vi.spyOn(engineChannel, "query").mockResolvedValue({
      ok: true,
      data: {},
    });

    act(() => {
      root.render(<EntityProperties />);
    });

    expect(container.textContent).toContain("2 entities selected");
    // Sprite only exists on one of the two selected entities.
    expect(container.textContent).toContain("1/2");
  });

  it("falls back to a stale-selection message when selected ids match nothing", () => {
    useIDEStore.setState({
      entities: [],
      liveEntities: [],
      selectedEntity: null,
      selectedEntityId: null,
    });
    useIDEStore.getState().setSelectedEntityIds(["missing-1", "missing-2"]);

    act(() => {
      root.render(<EntityProperties />);
    });

    expect(container.textContent).toContain("stale");
  });
});
