import { useCallback, useEffect, useRef, useState } from "react";
import {
  Scene,
  VariableStore,
  VisualScriptState,
  VisualScriptSystem,
  registerVisualScriptGraph,
  unregisterVisualScriptGraph,
  type VisualScriptGraph,
} from "@emptysock/engine";

/**
 * Wires the Visual Script Editor panel to the real, finished
 * `VisualScriptSystem` compile/execute machinery (see
 * `packages/engine/src/systems/VisualScriptSystem.ts` and
 * `components/VisualScript.ts`) so "Preview" actually runs the authored
 * graph instead of only editing JSON nobody executes.
 *
 * Scope, deliberately kept small: a headless `Scene` (no renderer, no
 * DOM — the same shape the engine's own Node/Vitest harness uses) with one
 * spawned entity carrying `VisualScriptState`, driven by a
 * `requestAnimationFrame` loop that calls `VisualScriptSystem.update(scene)`
 * every tick (which runs every `onUpdate` chain in the graph) and, for any
 * `onEvent` node in the graph, exposes a "Fire event" control that calls
 * `VisualScriptSystem.fireEvent(scene, eventType)` on demand.
 *
 * Live feedback the panel actually gets back, all read from the *same*
 * `VariableStore`/`ActorSystem`-shaped context the compiled graph itself
 * writes through — nothing here is a fabricated approximation:
 *   - every `Variable`/`Switch` index the graph ever reads or writes,
 *     snapshotted after each tick (`variables`/`switches` below) — this is
 *     literally "show output values."
 *   - the graph's own declared `onEvent` node event-type strings, so the
 *     panel can offer a real "fire this event" button per type present in
 *     the graph, not a hardcoded list.
 *
 * True per-node "currently executing" highlighting would need
 * `VisualScriptSystem`'s compiled output to call back per case, which it
 * deliberately does not do (CLAUDE.md: "each case is the one specific
 * statement for that one node... never a generic execute(node) call") —
 * adding that instrumentation lives in `packages/engine`, out of scope for
 * this IDE-only pass. This hook still gives the panel the two things the
 * task asks for that are reachable without touching the engine: live
 * output values, and a real run/stop control over the exact compiled graph
 * the panel authors.
 */

export interface LogicScriptPreviewState {
  running: boolean;
  /** Every variable index the graph reads/writes, and its current value. */
  variables: Record<number, number>;
  /** Every switch index the graph reads/writes, and its current value. */
  switches: Record<number, boolean>;
  /** onEvent node event-type strings declared in the current graph. */
  eventTypes: string[];
  tickCount: number;
  error: string | null;
}

const PREVIEW_GRAPH_ID = "__ide_logic_script_preview__";

function collectIndices(graph: VisualScriptGraph): {
  variableIndices: Set<number>;
  switchIndices: Set<number>;
  eventTypes: Set<string>;
} {
  const variableIndices = new Set<number>();
  const switchIndices = new Set<number>();
  const eventTypes = new Set<string>();
  for (const node of graph.nodes) {
    switch (node.kind) {
      case "branch":
        variableIndices.add(node.variableIndex);
        break;
      case "getVariable":
      case "setVariable":
        variableIndices.add(node.variableIndex);
        break;
      case "getSwitch":
      case "setSwitch":
        switchIndices.add(node.switchIndex);
        break;
      case "onEvent":
        eventTypes.add(node.eventType);
        break;
      default:
        break;
    }
  }
  return { variableIndices, switchIndices, eventTypes };
}

export function useLogicScriptPreview(graph: VisualScriptGraph): {
  state: LogicScriptPreviewState;
  start: () => void;
  stop: () => void;
  fireEvent: (eventType: string) => void;
} {
  const [state, setState] = useState<LogicScriptPreviewState>({
    running: false,
    variables: {},
    switches: {},
    eventTypes: [],
    tickCount: 0,
    error: null,
  });

  const runtimeRef = useRef<{
    scene: Scene;
    system: VisualScriptSystem;
    store: VariableStore;
    rafId: number;
  } | null>(null);

  const snapshot = useCallback(
    (store: VariableStore, graphNow: VisualScriptGraph) => {
      const { variableIndices, switchIndices, eventTypes } =
        collectIndices(graphNow);
      const variables: Record<number, number> = {};
      for (const i of variableIndices) variables[i] = store.getVar(i);
      const switches: Record<number, boolean> = {};
      for (const i of switchIndices) switches[i] = store.getSwitch(i);
      return { variables, switches, eventTypes: [...eventTypes] };
    },
    [],
  );

  const stop = useCallback(() => {
    const rt = runtimeRef.current;
    if (rt === null) return;
    cancelAnimationFrame(rt.rafId);
    unregisterVisualScriptGraph(PREVIEW_GRAPH_ID);
    runtimeRef.current = null;
    setState((s) => ({ ...s, running: false }));
  }, []);

  const start = useCallback(() => {
    stop();
    try {
      registerVisualScriptGraph(PREVIEW_GRAPH_ID, graph);
      const store = new VariableStore();
      const system = new VisualScriptSystem({ variables: store });
      const scene = new Scene();
      const entity = scene.spawn("logic-script-preview");
      entity.add(VisualScriptState, { graphId: PREVIEW_GRAPH_ID });

      let tickCount = 0;
      const tick = (): void => {
        try {
          system.update(scene);
          tickCount += 1;
          const snap = snapshot(store, graph);
          setState({
            running: true,
            ...snap,
            tickCount,
            error: null,
          });
        } catch (err) {
          setState((s) => ({
            ...s,
            error: err instanceof Error ? err.message : String(err),
          }));
          stop();
          return;
        }
        const rt = runtimeRef.current;
        if (rt !== null) {
          rt.rafId = requestAnimationFrame(tick);
        }
      };

      runtimeRef.current = { scene, system, store, rafId: 0 };
      runtimeRef.current.rafId = requestAnimationFrame(tick);
      setState((s) => ({ ...s, running: true, error: null, tickCount: 0 }));
    } catch (err) {
      setState((s) => ({
        ...s,
        running: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [graph, snapshot, stop]);

  const fireEvent = useCallback(
    (eventType: string) => {
      const rt = runtimeRef.current;
      if (rt === null) return;
      try {
        rt.system.fireEvent(rt.scene, eventType);
        const snap = snapshot(rt.store, graph);
        setState((s) => ({ ...s, ...snap, error: null }));
      } catch (err) {
        setState((s) => ({
          ...s,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [graph, snapshot],
  );

  // Stop the preview loop on unmount so a closed/re-opened panel never
  // leaves a stale rAF loop running against a graph nobody can see anymore.
  useEffect(() => stop, [stop]);

  return { state, start, stop, fireEvent };
}
