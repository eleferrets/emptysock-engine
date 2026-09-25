import React from "react";
import type { SceneFile, SceneFilePrefabInstance } from "@emptysock/engine";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";
import { ViewControls } from "./shared/ViewControls";

/** Default footprint drawn for a placed instance — this editor has no live sprite dimensions to draw from (a room's `.scene.json` only records `{ prefab, x, y }`), so every instance renders as a same-size labeled box, the same "honest placeholder, not a fabricated size" shape `ImageWidget`'s grey box uses before its real texture loads. */
const INSTANCE_SIZE = 32;

const QUIPS = [
  "Drag it somewhere it belongs. Or doesn't. Your call.",
  "Every pixel here was once a GameMaker instance with opinions.",
  "Snap to grid: for when your mouse hand shakes less than your resolve.",
  "Nothing selected. The room stares back, unbothered.",
];

interface RoomEditorState {
  sceneName: string;
  systems?: readonly string[];
  instances: SceneFilePrefabInstance[];
}

function isSceneJsonPath(path: string): boolean {
  return path.endsWith(".scene.json");
}

function parseSceneFile(raw: string): RoomEditorState | undefined {
  try {
    const parsed = JSON.parse(raw) as SceneFile;
    if (typeof parsed.sceneName !== "string") return undefined;
    return {
      sceneName: parsed.sceneName,
      ...(parsed.systems !== undefined ? { systems: parsed.systems } : {}),
      instances: [...(parsed.prefabInstances ?? [])],
    };
  } catch {
    return undefined;
  }
}

function serializeSceneFile(state: RoomEditorState): string {
  const file: SceneFile = {
    sceneName: state.sceneName,
    ...(state.systems !== undefined ? { systems: state.systems } : {}),
    prefabInstances: state.instances,
  };
  return JSON.stringify(file, null, 2) + "\n";
}

function instancePos(inst: SceneFilePrefabInstance): { x: number; y: number } {
  const props = inst.props as { x?: unknown; y?: unknown } | undefined;
  return {
    x: typeof props?.x === "number" ? props.x : 0,
    y: typeof props?.y === "number" ? props.y : 0,
  };
}

function withPos(
  inst: SceneFilePrefabInstance,
  x: number,
  y: number,
): SceneFilePrefabInstance {
  return { ...inst, props: { ...(inst.props ?? {}), x, y } };
}

export function RoomEditor(): React.ReactElement {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const openFiles = useIDEStore((s) => s.openFiles);
  const setFileContent = useIDEStore((s) => s.setFileContent);
  const gridSize = useIDEStore((s) => s.editorGridSize);
  const showGrid = useIDEStore((s) => s.editorShowGrid);
  const snapToGrid = useIDEStore((s) => s.editorSnapToGrid);

  const quip = React.useRef(QUIPS[Math.floor(Math.random() * QUIPS.length)]);

  const scenePaths = React.useMemo(
    () => Object.keys(openFiles).filter(isSceneJsonPath).sort(),
    [openFiles],
  );

  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (selectedPath === null && scenePaths.length > 0) {
      setSelectedPath(scenePaths[0] ?? null);
    } else if (selectedPath !== null && !scenePaths.includes(selectedPath)) {
      setSelectedPath(scenePaths[0] ?? null);
    }
  }, [scenePaths, selectedPath]);

  const parsedInitial = React.useMemo<RoomEditorState | undefined>(() => {
    if (selectedPath === null) return undefined;
    const raw = openFiles[selectedPath];
    return raw !== undefined ? parseSceneFile(raw) : undefined;
  }, [selectedPath, openFiles]);

  const { state, set, undo, redo, canUndo, canRedo } = useHistory<
    RoomEditorState | undefined
  >(parsedInitial);

  // Reset history when a different file is selected (not on every openFiles edit).
  const loadedPathRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (loadedPathRef.current !== selectedPath) {
      loadedPathRef.current = selectedPath;
      set(parsedInitial);
    }
  }, [selectedPath, parsedInitial, set]);

  const [liveInstances, setLiveInstances] = React.useState<
    SceneFilePrefabInstance[]
  >(state?.instances ?? []);
  React.useEffect(() => {
    setLiveInstances(state?.instances ?? []);
  }, [state]);

  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const dragRef = React.useRef<{
    index: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const commit = React.useCallback(
    (instances: SceneFilePrefabInstance[]) => {
      if (state === undefined || selectedPath === null) return;
      const next: RoomEditorState = { ...state, instances };
      set(next);
      setFileContent(selectedPath, serializeSceneFile(next));
    },
    [state, selectedPath, set, setFileContent],
  );

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    const { width, height } = canvas;

    // Canvas 2D fillStyle can't resolve CSS custom properties directly —
    // resolve them once against a computed style read from the canvas itself.
    const computed = getComputedStyle(canvas);
    ctx.fillStyle = computed.getPropertyValue("--es-bg").trim() || "#14141f";
    ctx.fillRect(0, 0, width, height);

    if (showGrid) {
      ctx.strokeStyle =
        computed.getPropertyValue("--es-border").trim() || "#2a2a3e";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= width; x += gridSize) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, height);
      }
      for (let y = 0; y <= height; y += gridSize) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(width, y + 0.5);
      }
      ctx.stroke();
    }

    liveInstances.forEach((inst, i) => {
      const { x, y } = instancePos(inst);
      const selected = i === selectedIndex;
      ctx.fillStyle = selected
        ? computed.getPropertyValue("--es-accent").trim() || "#818cf8"
        : "#4a4a7c";
      ctx.globalAlpha = selected ? 0.9 : 0.6;
      ctx.fillRect(
        x - INSTANCE_SIZE / 2,
        y - INSTANCE_SIZE / 2,
        INSTANCE_SIZE,
        INSTANCE_SIZE,
      );
      ctx.globalAlpha = 1;
      ctx.strokeStyle = selected ? "#ffffff" : "#00000080";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(
        x - INSTANCE_SIZE / 2,
        y - INSTANCE_SIZE / 2,
        INSTANCE_SIZE,
        INSTANCE_SIZE,
      );
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(inst.prefab, x, y + INSTANCE_SIZE / 2 + 2);
    });
  }, [liveInstances, selectedIndex, showGrid, gridSize]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  function hitTest(x: number, y: number): number | null {
    for (let i = liveInstances.length - 1; i >= 0; i--) {
      const inst = liveInstances[i];
      if (inst === undefined) continue;
      const p = instancePos(inst);
      if (
        x >= p.x - INSTANCE_SIZE / 2 &&
        x <= p.x + INSTANCE_SIZE / 2 &&
        y >= p.y - INSTANCE_SIZE / 2 &&
        y <= p.y + INSTANCE_SIZE / 2
      ) {
        return i;
      }
    }
    return null;
  }

  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): {
    x: number;
    y: number;
  } {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    const { x, y } = canvasPoint(e);
    const hit = hitTest(x, y);
    setSelectedIndex(hit);
    if (hit === null) return;
    const inst = liveInstances[hit];
    if (inst === undefined) return;
    const p = instancePos(inst);
    dragRef.current = { index: hit, offsetX: x - p.x, offsetY: y - p.y };
    // Not every environment implements the Pointer Capture API (notably
    // jsdom, this repo's own test environment) — guard rather than assume,
    // even though the DOM lib types claim it's always present.
    if (typeof e.currentTarget.setPointerCapture === "function") {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>): void {
    const drag = dragRef.current;
    if (drag === null) return;
    const { x, y } = canvasPoint(e);
    let nx = x - drag.offsetX;
    let ny = y - drag.offsetY;
    if (snapToGrid) {
      nx = Math.round(nx / gridSize) * gridSize;
      ny = Math.round(ny / gridSize) * gridSize;
    }
    setLiveInstances((prev) => {
      const inst = prev[drag.index];
      if (inst === undefined) return prev;
      const next = [...prev];
      next[drag.index] = withPos(inst, nx, ny);
      return next;
    });
  }

  function handlePointerUp(): void {
    if (dragRef.current === null) return;
    dragRef.current = null;
    commit(liveInstances);
  }

  const selected =
    selectedIndex !== null ? liveInstances[selectedIndex] : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderBottom: "1px solid var(--es-border)",
        }}
      >
        {scenePaths.length > 0 ? (
          <select
            value={selectedPath ?? ""}
            onChange={(e) => setSelectedPath(e.target.value)}
            style={{
              background: "var(--es-surface)",
              color: "var(--es-text)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 12,
            }}
          >
            {scenePaths.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : null}
        <div style={{ flex: 1 }} />
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            opacity: canUndo ? 1 : 0.4,
            background: "transparent",
            border: "1px solid var(--es-border)",
            color: "var(--es-text)",
            borderRadius: 4,
            fontSize: 12,
            padding: "2px 8px",
            cursor: canUndo ? "pointer" : "default",
          }}
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{
            opacity: canRedo ? 1 : 0.4,
            background: "transparent",
            border: "1px solid var(--es-border)",
            color: "var(--es-text)",
            borderRadius: 4,
            fontSize: 12,
            padding: "2px 8px",
            cursor: canRedo ? "pointer" : "default",
          }}
        >
          Redo
        </button>
      </div>

      <div style={{ flex: 1, position: "relative", display: "flex" }}>
        <div style={{ flex: 1, position: "relative" }}>
          {scenePaths.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 6,
                color: "var(--es-text-muted)",
                fontSize: 13,
                textAlign: "center",
                padding: 16,
              }}
            >
              <div>
                No room/scene files open — open a <code>*.scene.json</code> file
                to edit its room layout here.
              </div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{quip.current}</div>
            </div>
          ) : liveInstances.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: 6,
                color: "var(--es-text-muted)",
                fontSize: 13,
              }}
            >
              <div>This room has no placed instances yet.</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{quip.current}</div>
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              width={960}
              height={640}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ width: "100%", height: "100%", cursor: "grab" }}
            />
          )}
          <ViewControls />
        </div>

        {selected !== undefined && selectedIndex !== null ? (
          <div
            style={{
              width: 220,
              borderLeft: "1px solid var(--es-border)",
              padding: 10,
              fontSize: 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 600 }}>{selected.prefab}</div>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              X
              <input
                type="number"
                value={instancePos(selected).x}
                onChange={(e) => {
                  const y = instancePos(selected).y;
                  const next = liveInstances.map((inst, i) =>
                    i === selectedIndex
                      ? withPos(inst, Number(e.target.value), y)
                      : inst,
                  );
                  setLiveInstances(next);
                  commit(next);
                }}
                style={{
                  background: "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              Y
              <input
                type="number"
                value={instancePos(selected).y}
                onChange={(e) => {
                  const x = instancePos(selected).x;
                  const next = liveInstances.map((inst, i) =>
                    i === selectedIndex
                      ? withPos(inst, x, Number(e.target.value))
                      : inst,
                  );
                  setLiveInstances(next);
                  commit(next);
                }}
                style={{
                  background: "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  padding: "2px 6px",
                }}
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
