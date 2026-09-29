import React from "react";
import type { SceneFile, SceneFilePrefabInstance } from "@emptysock/engine";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";
import { isElementShown } from "../../hooks/isElementShown";
import { ViewControls } from "./shared/ViewControls";
import {
  type Box,
  type HandleId,
  SLICE_NINE,
  SLICE_TILED,
  boxFromCenter,
  centerOfBox,
  hitResizeHandle,
  nineSliceRects,
  resizeBox,
} from "./roomEditorGeometry";
import {
  VIEW_CHIP,
  VIEW_NUMBER_FIELDS,
  entityLabel,
  entityPosition,
  entityRect,
  followCandidates,
  getEntities,
  getViews,
  getViewsEnabled,
  hitTestExtras,
  moveEntity,
  moveView,
  patchView,
  setViewFollowObject,
  setViewRect,
  setViewsEnabled,
  viewRect,
  type Extra,
  type ExtraHit,
} from "./roomEditorExtras";

/** Half-size (px) of a resize handle square, also its hit tolerance. */
const HANDLE = 5;
const MIN_SLICED_SIZE = 8;

/** Default footprint drawn for a placed instance — this editor has no live sprite dimensions to draw from (a room's `.scene.json` only records `{ prefab, x, y }`), so every instance renders as a same-size labeled box, the same "honest placeholder, not a fabricated size" shape `ImageWidget`'s grey box uses before its real texture loads. */
const INSTANCE_SIZE = 32;

/** `setLineDash` is missing from some canvas test doubles; treat it as optional. */
function setDash(ctx: CanvasRenderingContext2D, dash: number[]): void {
  const c = ctx as Partial<CanvasRenderingContext2D>;
  if (typeof c.setLineDash === "function") c.setLineDash(dash);
}

/** The eight resize-handle positions of a box, in the order `roomEditorGeometry`'s `HandleId` lists them. */
function handlePoints(b: Box): [number, number][] {
  return [
    [b.x, b.y],
    [b.x + b.w / 2, b.y],
    [b.x + b.w, b.y],
    [b.x + b.w, b.y + b.h / 2],
    [b.x + b.w, b.y + b.h],
    [b.x + b.w / 2, b.y + b.h],
    [b.x, b.y + b.h],
    [b.x, b.y + b.h / 2],
  ];
}

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
  /** Every other top-level field of the file (entities, views, ...), preserved verbatim on save. */
  extra: Record<string, unknown>;
}

/** Sprite fields a prefab (or an instance prop override) can supply for nine-slice/tiled rendering. */
interface SpriteInfo {
  texturePath: string;
  width: number;
  height: number;
  sliceMode: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function num(v: unknown, d = 0): number {
  return typeof v === "number" ? v : d;
}

/** prefabName -> Sprite component overrides, from every open `*.prefab.json`. */
function collectPrefabSprites(
  files: Record<string, string>,
): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const [p, raw] of Object.entries(files)) {
    if (!p.endsWith(".prefab.json")) continue;
    try {
      const f = JSON.parse(raw) as {
        prefabName?: string;
        components?: {
          component: string;
          overrides?: Record<string, unknown>;
        }[];
      };
      const sp = f.components?.find((c) => c.component === "Sprite");
      if (typeof f.prefabName === "string" && sp !== undefined) {
        out.set(f.prefabName, sp.overrides ?? {});
      }
    } catch {
      /* unparseable prefab: treated as absent */
    }
  }
  return out;
}

/** Effective sprite info: prefab Sprite overrides, then instance props on top (the same precedence `Scene.spawn` applies). */
function instanceSprite(
  inst: SceneFilePrefabInstance,
  prefabs: Map<string, Record<string, unknown>>,
): SpriteInfo {
  const o = { ...(prefabs.get(inst.prefab) ?? {}), ...(inst.props ?? {}) };
  return {
    texturePath: typeof o["texturePath"] === "string" ? o["texturePath"] : "",
    width: num(o["width"]),
    height: num(o["height"]),
    sliceMode: num(o["sliceMode"]),
    left: num(o["sliceLeft"]),
    right: num(o["sliceRight"]),
    top: num(o["sliceTop"]),
    bottom: num(o["sliceBottom"]),
  };
}

/** Bounding box (top-left origin) an instance occupies in the room. Sliced/tiled instances use their real width/height. */
function instanceBox(
  inst: SceneFilePrefabInstance,
  prefabs: Map<string, Record<string, unknown>>,
): Box {
  const { x, y } = instancePos(inst);
  const sp = instanceSprite(inst, prefabs);
  if (sp.sliceMode !== 0 && sp.width > 0 && sp.height > 0) {
    return boxFromCenter(x, y, sp.width, sp.height);
  }
  const t = instanceTransform(inst);
  return boxFromCenter(
    x,
    y,
    INSTANCE_SIZE * t.scaleX,
    INSTANCE_SIZE * t.scaleY,
  );
}

function isSliced(
  inst: SceneFilePrefabInstance,
  prefabs: Map<string, Record<string, unknown>>,
): boolean {
  const sp = instanceSprite(inst, prefabs);
  return sp.sliceMode !== 0 && sp.width > 0 && sp.height > 0;
}

function withProps(
  inst: SceneFilePrefabInstance,
  patch: Record<string, number>,
): SceneFilePrefabInstance {
  return { ...inst, props: { ...(inst.props ?? {}), ...patch } };
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
      extra: Object.fromEntries(
        Object.entries(parsed).filter(
          ([k]) => !["sceneName", "systems", "prefabInstances"].includes(k),
        ),
      ),
    };
  } catch {
    return undefined;
  }
}

function serializeSceneFile(state: RoomEditorState): string {
  const file: SceneFile = {
    ...(state.extra as Partial<SceneFile>),
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

/** Rotation (degrees, matching `Transform.rotation`'s on-disk convention elsewhere in this
 * importer's prefab props) and non-uniform scale — mirrors `Transform`'s own field names
 * (`rotation`/`scaleX`/`scaleY`) so a room-editor edit round-trips through `loadSceneFile()`
 * without a translation step. */
function instanceTransform(inst: SceneFilePrefabInstance): {
  rotation: number;
  scaleX: number;
  scaleY: number;
} {
  const props = inst.props as
    | { rotation?: unknown; scaleX?: unknown; scaleY?: unknown }
    | undefined;
  return {
    rotation: typeof props?.rotation === "number" ? props.rotation : 0,
    scaleX: typeof props?.scaleX === "number" ? props.scaleX : 1,
    scaleY: typeof props?.scaleY === "number" ? props.scaleY : 1,
  };
}

function withTransform(
  inst: SceneFilePrefabInstance,
  patch: Partial<{ rotation: number; scaleX: number; scaleY: number }>,
): SceneFilePrefabInstance {
  return { ...inst, props: { ...(inst.props ?? {}), ...patch } };
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

  const prefabSprites = React.useMemo(
    () => collectPrefabSprites(openFiles),
    [openFiles],
  );
  // Texture cache for sliced/tiled instances. null = failed/absent (placeholder box drawn).
  const imagesRef = React.useRef(new Map<string, HTMLImageElement | null>());
  const [imageTick, setImageTick] = React.useState(0);

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

  const { state, set, undo, redo, reset, canUndo, canRedo } = useHistory<
    RoomEditorState | undefined
  >(parsedInitial);

  // Reset history when a different file is selected (not on every openFiles edit).
  const loadedPathRef = React.useRef<string | null>(null);
  const committedRef = React.useRef<RoomEditorState | undefined>(parsedInitial);
  React.useEffect(() => {
    if (loadedPathRef.current !== selectedPath) {
      loadedPathRef.current = selectedPath;
      committedRef.current = parsedInitial;
      reset(parsedInitial);
    }
  }, [selectedPath, parsedInitial, reset]);

  // A state the panel did not itself commit can only have come from undo/redo:
  // write it back to the file so the editor and the file never disagree.
  React.useEffect(() => {
    if (state === undefined || selectedPath === null) return;
    if (state === committedRef.current) return;
    committedRef.current = state;
    setFileContent(selectedPath, serializeSceneFile(state));
  }, [state, selectedPath, setFileContent]);

  const [liveInstances, setLiveInstances] = React.useState<
    SceneFilePrefabInstance[]
  >(state?.instances ?? []);
  React.useEffect(() => {
    setLiveInstances(state?.instances ?? []);
  }, [state]);

  // Direct entities and camera views, edited live during a drag and committed
  // as one history step on pointer-up (mirrors `liveInstances` above).
  const [liveExtra, setLiveExtra] = React.useState<Extra>(state?.extra ?? {});
  React.useEffect(() => {
    setLiveExtra(state?.extra ?? {});
  }, [state]);
  const [selExtra, setSelExtra] = React.useState<ExtraHit | null>(null);
  const extraDragRef = React.useRef<{
    hit: ExtraHit;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const extraResizeRef = React.useRef<{
    index: number;
    handle: HandleId;
  } | null>(null);

  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
  const dragRef = React.useRef<{
    index: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const resizeRef = React.useRef<{ index: number; handle: HandleId } | null>(
    null,
  );

  // Kick off loads for every sliced/tiled instance's texture once.
  React.useEffect(() => {
    for (const inst of liveInstances) {
      const sp = instanceSprite(inst, prefabSprites);
      if (sp.sliceMode === 0 || sp.texturePath === "") continue;
      if (imagesRef.current.has(sp.texturePath)) continue;
      imagesRef.current.set(sp.texturePath, null);
      if (typeof Image === "undefined") continue;
      const img = new Image();
      const path = sp.texturePath;
      img.onload = (): void => {
        imagesRef.current.set(path, img);
        setImageTick((t) => t + 1);
      };
      img.onerror = (): void => undefined;
      // An open file holding a data: URL wins; otherwise the path is used as-is.
      const inline = openFiles[path];
      img.src =
        inline !== undefined && inline.startsWith("data:") ? inline : path;
    }
  }, [liveInstances, prefabSprites, openFiles]);

  // Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) while this panel is on screen; text
  // fields keep their own native undo.
  const rootRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const root = rootRef.current;
      if (!isElementShown(root)) return;
      const t = e.target;
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const commit = React.useCallback(
    (instances: SceneFilePrefabInstance[]) => {
      if (state === undefined || selectedPath === null) return;
      const next: RoomEditorState = { ...state, instances };
      committedRef.current = next;
      set(next);
      setFileContent(selectedPath, serializeSceneFile(next));
    },
    [state, selectedPath, set, setFileContent],
  );

  const commitExtra = React.useCallback(
    (extra: Extra) => {
      if (state === undefined || selectedPath === null) return;
      const next: RoomEditorState = { ...state, extra };
      committedRef.current = next;
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

    // Direct entities (converted backgrounds, layer elements): faint boxes
    // behind the instances, at their Transform position.
    getEntities(liveExtra).forEach((en, ei) => {
      const r = entityRect(en, INSTANCE_SIZE);
      const isSel = selExtra?.kind === "entity" && selExtra.index === ei;
      ctx.fillStyle = isSel
        ? computed.getPropertyValue("--es-accent").trim() || "#818cf8"
        : "#7c7c4a";
      ctx.globalAlpha = isSel ? 0.35 : 0.18;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSel ? "#ffffff" : "#7c7c4a";
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(entityLabel(en, ei), r.x + 2, r.y + 2);
    });

    liveInstances.forEach((inst, i) => {
      const { x, y } = instancePos(inst);
      const { rotation, scaleX, scaleY } = instanceTransform(inst);
      const selected = i === selectedIndex;
      const sp = instanceSprite(inst, prefabSprites);
      const sliced = isSliced(inst, prefabSprites);
      const w = sliced ? sp.width : INSTANCE_SIZE * scaleX;
      const h = sliced ? sp.height : INSTANCE_SIZE * scaleY;
      const img = sliced ? imagesRef.current.get(sp.texturePath) : null;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((rotation * Math.PI) / 180);

      if (sliced && img) {
        if (sp.sliceMode === SLICE_NINE) {
          const allZero = sp.left + sp.right + sp.top + sp.bottom === 0;
          const cw = Math.round(img.width / 3);
          const ch = Math.round(img.height / 3);
          const guides = allZero
            ? { left: cw, right: cw, top: ch, bottom: ch }
            : {
                left: sp.left,
                right: sp.right,
                top: sp.top,
                bottom: sp.bottom,
              };
          for (const r of nineSliceRects(img.width, img.height, guides, w, h)) {
            ctx.drawImage(
              img,
              r.sx,
              r.sy,
              r.sw,
              r.sh,
              -w / 2 + r.dx,
              -h / 2 + r.dy,
              r.dw,
              r.dh,
            );
          }
        } else if (sp.sliceMode === SLICE_TILED) {
          const pattern = ctx.createPattern(img, "repeat");
          if (pattern !== null) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(-w / 2, -h / 2, w, h);
            ctx.clip();
            ctx.translate(-w / 2, -h / 2);
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
          }
        }
      } else {
        ctx.fillStyle = selected
          ? computed.getPropertyValue("--es-accent").trim() || "#818cf8"
          : "#4a4a7c";
        ctx.globalAlpha = selected ? 0.9 : 0.6;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = selected ? "#ffffff" : "#00000080";
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();

      if (selected && sliced) {
        const b = boxFromCenter(x, y, w, h);
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle =
          computed.getPropertyValue("--es-accent").trim() || "#818cf8";
        const pts = [
          [b.x, b.y],
          [b.x + b.w / 2, b.y],
          [b.x + b.w, b.y],
          [b.x + b.w, b.y + b.h / 2],
          [b.x + b.w, b.y + b.h],
          [b.x + b.w / 2, b.y + b.h],
          [b.x, b.y + b.h],
          [b.x, b.y + b.h / 2],
        ] as const;
        for (const [hx, hy] of pts) {
          ctx.fillRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2);
          ctx.strokeRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2);
        }
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(inst.prefab, x, y + h / 2 + 2);
    });
    // Camera views: the world rectangle each visible view looks at (dashed
    // when the room's views are switched off), with a label chip at the
    // top-left, corner/edge handles when selected, and a marker for the
    // object it follows.
    const viewsOn = getViewsEnabled(liveExtra);
    getViews(liveExtra).forEach((v, vi) => {
      if (!v.visible) return;
      const r = viewRect(v);
      const isSel = selExtra?.kind === "view" && selExtra.index === vi;
      const colour = isSel
        ? computed.getPropertyValue("--es-accent").trim() || "#818cf8"
        : "#4ad0a0";
      setDash(ctx, viewsOn ? [] : [6, 4]);
      ctx.strokeStyle = colour;
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      setDash(ctx, []);
      ctx.fillStyle = colour;
      ctx.fillRect(r.x, r.y - VIEW_CHIP.h, VIEW_CHIP.w, VIEW_CHIP.h);
      ctx.fillStyle = "#000000";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        v.followObject !== undefined ? `View ${vi}*` : `View ${vi}`,
        r.x + 3,
        r.y - VIEW_CHIP.h + 2,
      );
      if (isSel) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = colour;
        for (const [hx, hy] of handlePoints(r)) {
          ctx.fillRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2);
          ctx.strokeRect(hx - HANDLE, hy - HANDLE, HANDLE * 2, HANDLE * 2);
        }
      }
    });
  }, [
    liveExtra,
    selExtra,
    liveInstances,
    selectedIndex,
    showGrid,
    gridSize,
    prefabSprites,
    imageTick,
  ]);

  React.useEffect(() => {
    draw();
  }, [draw]);

  function hitTest(x: number, y: number): number | null {
    for (let i = liveInstances.length - 1; i >= 0; i--) {
      const inst = liveInstances[i];
      if (inst === undefined) continue;
      const b = instanceBox(inst, prefabSprites);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
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
    // A resize handle of the already-selected sliced/tiled instance wins over body hits.
    if (selectedIndex !== null) {
      const cur = liveInstances[selectedIndex];
      if (cur !== undefined && isSliced(cur, prefabSprites)) {
        const handle = hitResizeHandle(
          x,
          y,
          instanceBox(cur, prefabSprites),
          HANDLE + 1,
        );
        if (handle !== null) {
          resizeRef.current = { index: selectedIndex, handle };
          if (typeof e.currentTarget.setPointerCapture === "function") {
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          return;
        }
      }
    }
    // A resize handle of the selected camera view.
    if (selExtra?.kind === "view") {
      const v = getViews(liveExtra)[selExtra.index];
      if (v !== undefined) {
        const handle = hitResizeHandle(x, y, viewRect(v), HANDLE + 1);
        if (handle !== null) {
          extraResizeRef.current = { index: selExtra.index, handle };
          if (typeof e.currentTarget.setPointerCapture === "function") {
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          return;
        }
      }
    }
    const hit = hitTest(x, y);
    if (hit === null) {
      // Not on an instance: try direct entities and camera views.
      setSelectedIndex(null);
      const extraHit = hitTestExtras(
        liveExtra,
        x,
        y,
        HANDLE + 1,
        INSTANCE_SIZE,
      );
      setSelExtra(extraHit);
      if (extraHit === null) return;
      const origin =
        extraHit.kind === "entity"
          ? entityPosition(getEntities(liveExtra)[extraHit.index] ?? {})
          : (() => {
              const v = getViews(liveExtra)[extraHit.index];
              return { x: v?.worldX ?? 0, y: v?.worldY ?? 0 };
            })();
      extraDragRef.current = {
        hit: extraHit,
        offsetX: x - origin.x,
        offsetY: y - origin.y,
      };
      if (typeof e.currentTarget.setPointerCapture === "function") {
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      return;
    }
    setSelExtra(null);
    setSelectedIndex(hit);
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
    const extraResize = extraResizeRef.current;
    if (extraResize !== null) {
      const { x, y } = canvasPoint(e);
      setLiveExtra((prev) => {
        const v = getViews(prev)[extraResize.index];
        if (v === undefined) return prev;
        const nb = resizeBox(
          viewRect(v),
          extraResize.handle,
          x,
          y,
          snapToGrid,
          gridSize,
          MIN_SLICED_SIZE,
        );
        return setViewRect(prev, extraResize.index, nb);
      });
      return;
    }
    const extraDrag = extraDragRef.current;
    if (extraDrag !== null) {
      const { x, y } = canvasPoint(e);
      let nx = x - extraDrag.offsetX;
      let ny = y - extraDrag.offsetY;
      if (snapToGrid) {
        nx = Math.round(nx / gridSize) * gridSize;
        ny = Math.round(ny / gridSize) * gridSize;
      }
      setLiveExtra((prev) =>
        extraDrag.hit.kind === "entity"
          ? moveEntity(prev, extraDrag.hit.index, nx, ny)
          : moveView(prev, extraDrag.hit.index, nx, ny),
      );
      return;
    }
    const resize = resizeRef.current;
    if (resize !== null) {
      const { x, y } = canvasPoint(e);
      setLiveInstances((prev) => {
        const inst = prev[resize.index];
        if (inst === undefined) return prev;
        const nb = resizeBox(
          instanceBox(inst, prefabSprites),
          resize.handle,
          x,
          y,
          snapToGrid,
          gridSize,
          MIN_SLICED_SIZE,
        );
        const c = centerOfBox(nb);
        const next = [...prev];
        next[resize.index] = withProps(inst, {
          x: c.x,
          y: c.y,
          width: nb.w,
          height: nb.h,
        });
        return next;
      });
      return;
    }
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
    if (extraResizeRef.current !== null || extraDragRef.current !== null) {
      extraResizeRef.current = null;
      extraDragRef.current = null;
      // One history step per drag/resize; a plain click changes nothing.
      if (state !== undefined && liveExtra !== state.extra) {
        commitExtra(liveExtra);
      }
      return;
    }
    if (resizeRef.current !== null) {
      resizeRef.current = null;
      commit(liveInstances);
      return;
    }
    if (dragRef.current === null) return;
    dragRef.current = null;
    commit(liveInstances);
  }

  const selected =
    selectedIndex !== null ? liveInstances[selectedIndex] : undefined;

  return (
    <div
      ref={rootRef}
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
          ) : liveInstances.length === 0 &&
            getViews(liveExtra).length === 0 &&
            getEntities(liveExtra).length === 0 ? (
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
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              Rotation (deg)
              <input
                type="number"
                value={instanceTransform(selected).rotation}
                onChange={(e) => {
                  const next = liveInstances.map((inst, i) =>
                    i === selectedIndex
                      ? withTransform(inst, {
                          rotation: Number(e.target.value),
                        })
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
              Scale X
              <input
                type="number"
                step="0.1"
                value={instanceTransform(selected).scaleX}
                onChange={(e) => {
                  const next = liveInstances.map((inst, i) =>
                    i === selectedIndex
                      ? withTransform(inst, { scaleX: Number(e.target.value) })
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
              Scale Y
              <input
                type="number"
                step="0.1"
                value={instanceTransform(selected).scaleY}
                onChange={(e) => {
                  const next = liveInstances.map((inst, i) =>
                    i === selectedIndex
                      ? withTransform(inst, { scaleY: Number(e.target.value) })
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
              Slicing
              <select
                value={instanceSprite(selected, prefabSprites).sliceMode}
                onChange={(e) => {
                  const mode = Number(e.target.value);
                  const b = instanceBox(selected, prefabSprites);
                  const cur = instanceSprite(selected, prefabSprites);
                  const next = liveInstances.map((inst, i) =>
                    i === selectedIndex
                      ? withProps(inst, {
                          sliceMode: mode,
                          ...(mode !== 0 && !(cur.width > 0 && cur.height > 0)
                            ? { width: b.w, height: b.h }
                            : {}),
                        })
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
              >
                <option value={0}>None</option>
                <option value={1}>Nine-slice</option>
                <option value={2}>Tiled</option>
              </select>
            </label>
            {instanceSprite(selected, prefabSprites).sliceMode === 0 ? (
              <div style={{ color: "var(--es-text-muted)", fontSize: 11 }}>
                Set Slicing to Nine-slice or Tiled to resize this instance by
                dragging its handles.
              </div>
            ) : (
              <>
                {(
                  [
                    ["Width", "width"],
                    ["Height", "height"],
                    ...(instanceSprite(selected, prefabSprites).sliceMode ===
                    SLICE_NINE
                      ? ([
                          ["Slice left", "sliceLeft"],
                          ["Slice right", "sliceRight"],
                          ["Slice top", "sliceTop"],
                          ["Slice bottom", "sliceBottom"],
                        ] as const)
                      : []),
                  ] as readonly (readonly [string, string])[]
                ).map(([label, key]) => (
                  <label
                    key={key}
                    style={{ display: "flex", flexDirection: "column", gap: 2 }}
                  >
                    {label}
                    <input
                      type="number"
                      min={
                        key === "width" || key === "height"
                          ? MIN_SLICED_SIZE
                          : 0
                      }
                      value={num(
                        (
                          {
                            ...(prefabSprites.get(selected.prefab) ?? {}),
                            ...(selected.props ?? {}),
                          } as Record<string, unknown>
                        )[key],
                      )}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const next = liveInstances.map((inst, i) =>
                          i === selectedIndex
                            ? withProps(inst, { [key]: v })
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
                ))}
              </>
            )}
          </div>
        ) : null}
        {state !== undefined &&
        (getViews(state.extra).length > 0 ||
          getEntities(state.extra).length > 0) ? (
          <div
            data-testid="room-extras"
            style={{
              width: 260,
              borderLeft: "1px solid var(--es-border)",
              padding: 10,
              fontSize: 12,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {getViews(state.extra).length > 0 ? (
              <>
                <div style={{ fontWeight: 600 }}>Views</div>
                <datalist id="room-follow-objects">
                  {followCandidates(state.instances).map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <label>
                  <input
                    type="checkbox"
                    checked={getViewsEnabled(state.extra)}
                    onChange={(e) =>
                      commitExtra(
                        setViewsEnabled(state.extra, e.target.checked),
                      )
                    }
                  />{" "}
                  Enable views
                </label>
                {getViews(state.extra).map((v, vi) => (
                  <fieldset
                    key={vi}
                    data-testid={`room-view-${vi}`}
                    onClick={() => setSelExtra({ kind: "view", index: vi })}
                    style={{
                      border:
                        selExtra?.kind === "view" && selExtra.index === vi
                          ? "1px solid var(--es-accent)"
                          : "1px solid var(--es-border)",
                    }}
                  >
                    <legend>View {vi}</legend>
                    <label>
                      <input
                        type="checkbox"
                        checked={v.visible}
                        onChange={(e) =>
                          commitExtra(
                            patchView(state.extra, vi, {
                              visible: e.target.checked,
                            }),
                          )
                        }
                      />{" "}
                      Visible
                    </label>
                    {VIEW_NUMBER_FIELDS.map((f) => (
                      <label
                        key={f}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        {f}
                        <input
                          type="number"
                          aria-label={`view ${vi} ${f}`}
                          value={v[f]}
                          onChange={(e) =>
                            commitExtra(
                              patchView(state.extra, vi, {
                                [f]: Number(e.target.value),
                              }),
                            )
                          }
                          style={{
                            background: "var(--es-surface)",
                            color: "var(--es-text)",
                            border: "1px solid var(--es-border)",
                            borderRadius: 4,
                            padding: "2px 6px",
                            width: 64,
                          }}
                        />
                      </label>
                    ))}
                    <label
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      followObject
                      <FollowObjectInput
                        key={`${vi}-${v.followObject ?? ""}`}
                        index={vi}
                        value={v.followObject ?? ""}
                        listId="room-follow-objects"
                        onCommit={(name) =>
                          commitExtra(
                            setViewFollowObject(state.extra, vi, name),
                          )
                        }
                      />
                    </label>
                  </fieldset>
                ))}
              </>
            ) : null}
            {getEntities(state.extra).length > 0 ? (
              <>
                <div style={{ fontWeight: 600 }}>Entities</div>
                {getEntities(state.extra).map((en, ei) => {
                  const p = entityPosition(en);
                  return (
                    <div
                      key={ei}
                      data-testid={`room-entity-${ei}`}
                      onClick={() => setSelExtra({ kind: "entity", index: ei })}
                      style={{
                        display: "flex",
                        gap: 4,
                        alignItems: "center",
                        fontWeight:
                          selExtra?.kind === "entity" && selExtra.index === ei
                            ? 600
                            : 400,
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {entityLabel(en, ei)}
                      </span>
                      <input
                        type="number"
                        aria-label={`entity ${ei} x`}
                        value={p.x}
                        onChange={(e) =>
                          commitExtra(
                            moveEntity(
                              state.extra,
                              ei,
                              Number(e.target.value),
                              p.y,
                            ),
                          )
                        }
                        style={{
                          background: "var(--es-surface)",
                          color: "var(--es-text)",
                          border: "1px solid var(--es-border)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          width: 64,
                        }}
                      />
                      <input
                        type="number"
                        aria-label={`entity ${ei} y`}
                        value={p.y}
                        onChange={(e) =>
                          commitExtra(
                            moveEntity(
                              state.extra,
                              ei,
                              p.x,
                              Number(e.target.value),
                            ),
                          )
                        }
                        style={{
                          background: "var(--es-surface)",
                          color: "var(--es-text)",
                          border: "1px solid var(--es-border)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          width: 64,
                        }}
                      />
                    </div>
                  );
                })}
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Text field for a view's follow target: commits on blur or Enter (one undo step, not one per keystroke) and offers the room's prefab names via a datalist. */
function FollowObjectInput(props: {
  index: number;
  value: string;
  listId: string;
  onCommit: (name: string) => void;
}): React.ReactElement {
  const [text, setText] = React.useState(props.value);
  const commit = (): void => {
    if (text.trim() !== props.value) props.onCommit(text);
  };
  return (
    <input
      type="text"
      list={props.listId}
      aria-label={`view ${props.index} followObject`}
      placeholder="none"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
      style={{
        background: "var(--es-surface)",
        color: "var(--es-text)",
        border: "1px solid var(--es-border)",
        borderRadius: 4,
        padding: "2px 6px",
        width: 96,
      }}
    />
  );
}
