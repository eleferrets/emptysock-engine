import React from "react";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";
import { isElementShown } from "../../hooks/isElementShown";
import { ViewControls } from "./shared/ViewControls";
import {
  type Box,
  type Camera2D,
  type HandleId,
  type PortLayout,
  DEFAULT_CAMERA,
  SLICE_NINE,
  SLICE_TILED,
  boxFromCenter,
  centerOfBox,
  fitCamera,
  hitPort,
  hitResizeHandle,
  insidePortOverlay,
  nineSliceRects,
  overlayToPort,
  portLayout,
  portToOverlay,
  resizeBox,
  screenToWorld,
  zoomAt,
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
  setViewPortRect,
  setViewRect,
  setViewsEnabled,
  toggleViewVisible,
  addView,
  rectFromDrag,
  type Rect,
  viewPortRect,
  viewRect,
  type Extra,
  type ExtraHit,
} from "./roomEditorExtras";
import {
  parseRoomScene,
  serializeRoomScene,
  type RoomEditorState,
  type RoomInstance,
} from "./roomEditorScene";

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
        components?:
          | Record<string, { data?: Record<string, unknown> }>
          | { component: string; overrides?: Record<string, unknown> }[];
      };
      // Current shape: name-keyed map of `{ v?, data }`. Legacy: array of
      // `{ component, overrides }`.
      const comps = f.components;
      const sp = Array.isArray(comps)
        ? comps.find((c) => c.component === "Sprite")?.overrides
        : comps?.["Sprite"]?.data;
      if (typeof f.prefabName === "string" && comps !== undefined) {
        const has = Array.isArray(comps)
          ? comps.some((c) => c.component === "Sprite")
          : comps["Sprite"] !== undefined;
        if (has) out.set(f.prefabName, sp ?? {});
      }
    } catch {
      /* unparseable prefab: treated as absent */
    }
  }
  return out;
}

/** Effective sprite info: prefab Sprite overrides, then instance props on top (the same precedence `Scene.spawn` applies). */
function instanceSprite(
  inst: RoomInstance,
  prefabs: Map<string, Record<string, unknown>>,
): SpriteInfo {
  const o = {
    ...(prefabs.get(inst.prefab.name) ?? {}),
    ...(inst.prefab.props ?? {}),
  };
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
  inst: RoomInstance,
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
  inst: RoomInstance,
  prefabs: Map<string, Record<string, unknown>>,
): boolean {
  const sp = instanceSprite(inst, prefabs);
  return sp.sliceMode !== 0 && sp.width > 0 && sp.height > 0;
}

/** Copy of `inst` with `patch` merged into its `prefab.props` (id and every other field untouched). */
function patchProps(
  inst: RoomInstance,
  patch: Record<string, number>,
): RoomInstance {
  return {
    ...inst,
    prefab: {
      ...inst.prefab,
      props: { ...(inst.prefab.props ?? {}), ...patch },
    },
  };
}

function withProps(
  inst: RoomInstance,
  patch: Record<string, number>,
): RoomInstance {
  return patchProps(inst, patch);
}

function isSceneJsonPath(path: string): boolean {
  return path.endsWith(".scene.json");
}

function instancePos(inst: RoomInstance): { x: number; y: number } {
  const props = inst.prefab.props as { x?: unknown; y?: unknown } | undefined;
  return {
    x: typeof props?.x === "number" ? props.x : 0,
    y: typeof props?.y === "number" ? props.y : 0,
  };
}

function withPos(inst: RoomInstance, x: number, y: number): RoomInstance {
  return patchProps(inst, { x, y });
}

/** Rotation (degrees, matching `Transform.rotation`'s on-disk convention elsewhere in this
 * importer's prefab props) and non-uniform scale — mirrors `Transform`'s own field names
 * (`rotation`/`scaleX`/`scaleY`) so a room-editor edit round-trips through `loadSceneFile()`
 * without a translation step. */
function instanceTransform(inst: RoomInstance): {
  rotation: number;
  scaleX: number;
  scaleY: number;
} {
  const props = inst.prefab.props as
    { rotation?: unknown; scaleX?: unknown; scaleY?: unknown } | undefined;
  return {
    rotation: typeof props?.rotation === "number" ? props.rotation : 0,
    scaleX: typeof props?.scaleX === "number" ? props.scaleX : 1,
    scaleY: typeof props?.scaleY === "number" ? props.scaleY : 1,
  };
}

function withTransform(
  inst: RoomInstance,
  patch: Partial<{ rotation: number; scaleX: number; scaleY: number }>,
): RoomInstance {
  return patchProps(inst, patch);
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
    return raw !== undefined ? parseRoomScene(raw) : undefined;
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
    setFileContent(selectedPath, serializeRoomScene(state));
  }, [state, selectedPath, setFileContent]);

  const [liveInstances, setLiveInstances] = React.useState<RoomInstance[]>(
    state?.instances ?? [],
  );
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
  // "New view" tool: drag out a rectangle on the canvas to create a view.
  const [drawViewMode, setDrawViewMode] = React.useState(false);
  const [drawPreview, setDrawPreview] = React.useState<Rect | null>(null);
  const drawViewRef = React.useRef<{ x: number; y: number } | null>(null);
  const extraDragRef = React.useRef<{
    hit: ExtraHit;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const extraResizeRef = React.useRef<{
    index: number;
    handle: HandleId;
  } | null>(null);

  // Editor camera (pan/zoom). Mirrored into a ref so the native wheel
  // listener and pointer handlers always read the latest value.
  const [cam, setCamState] = React.useState<Camera2D>(DEFAULT_CAMERA);
  const camRef = React.useRef<Camera2D>(DEFAULT_CAMERA);
  const setCam = React.useCallback((next: Camera2D): void => {
    camRef.current = next;
    setCamState(next);
  }, []);
  const panRef = React.useRef<{
    startX: number;
    startY: number;
    camX: number;
    camY: number;
  } | null>(null);
  const spaceHeldRef = React.useRef(false);
  // Dragging/resizing a view's screen (port) rectangle in the game-window overlay.
  const portDragRef = React.useRef<{
    index: number;
    handle: HandleId | null;
    offsetX: number;
    offsetY: number;
    /** Overlay layout frozen at drag start so the mapping does not drift as the window grows. */
    layout: PortLayout;
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
    (instances: RoomInstance[]) => {
      if (state === undefined || selectedPath === null) return;
      const next: RoomEditorState = { ...state, instances };
      committedRef.current = next;
      set(next);
      setFileContent(selectedPath, serializeRoomScene(next));
    },
    [state, selectedPath, set, setFileContent],
  );

  const commitExtra = React.useCallback(
    (extra: Extra) => {
      if (state === undefined || selectedPath === null) return;
      const next: RoomEditorState = { ...state, extra };
      committedRef.current = next;
      set(next);
      setFileContent(selectedPath, serializeRoomScene(next));
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

    // Everything below up to the matching restore() is drawn in room (world)
    // space, through the pan/zoom camera.
    ctx.save();
    ctx.translate(cam.x, cam.y);
    if (cam.zoom !== 1 && typeof ctx.scale === "function") {
      ctx.scale(cam.zoom, cam.zoom);
    }
    const hs = HANDLE / cam.zoom;

    if (showGrid && gridSize > 0) {
      ctx.strokeStyle =
        computed.getPropertyValue("--es-border").trim() || "#2a2a3e";
      ctx.lineWidth = 1 / cam.zoom;
      const wx0 = -cam.x / cam.zoom;
      const wy0 = -cam.y / cam.zoom;
      const wx1 = wx0 + width / cam.zoom;
      const wy1 = wy0 + height / cam.zoom;
      // Skip the grid when it would be denser than ~4 screen px per cell.
      if (gridSize * cam.zoom >= 4) {
        ctx.beginPath();
        for (
          let x = Math.floor(wx0 / gridSize) * gridSize;
          x <= wx1;
          x += gridSize
        ) {
          ctx.moveTo(x + 0.5 / cam.zoom, wy0);
          ctx.lineTo(x + 0.5 / cam.zoom, wy1);
        }
        for (
          let y = Math.floor(wy0 / gridSize) * gridSize;
          y <= wy1;
          y += gridSize
        ) {
          ctx.moveTo(wx0, y + 0.5 / cam.zoom);
          ctx.lineTo(wx1, y + 0.5 / cam.zoom);
        }
        ctx.stroke();
      }
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
          ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
          ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
        }
      }

      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(inst.prefab.name, x, y + h / 2 + 2);
    });
    // Camera views: the world rectangle each visible view looks at (dashed
    // when the room's views are switched off), with a label chip at the
    // top-left, corner/edge handles when selected, and a marker for the
    // object it follows.
    const viewsOn = getViewsEnabled(liveExtra);
    getViews(liveExtra).forEach((v, vi) => {
      const r = viewRect(v);
      const isSel = selExtra?.kind === "view" && selExtra.index === vi;
      const colour = isSel
        ? computed.getPropertyValue("--es-accent").trim() || "#818cf8"
        : "#4ad0a0";
      // Hidden views stay on the canvas, dimmed and dotted, so they can still
      // be selected, moved and resized (double-click a view to toggle it).
      setDash(ctx, !v.visible ? [2, 4] : viewsOn ? [] : [6, 4]);
      ctx.globalAlpha = v.visible ? 1 : 0.5;
      ctx.strokeStyle = colour;
      ctx.lineWidth = (isSel ? 2 : 1) / cam.zoom;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      setDash(ctx, []);
      ctx.fillStyle = colour;
      ctx.fillRect(r.x, r.y - VIEW_CHIP.h, VIEW_CHIP.w, VIEW_CHIP.h);
      ctx.fillStyle = "#000000";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        `View ${vi}${v.followObject !== undefined ? "*" : ""}${v.visible ? "" : " off"}`,
        r.x + 3,
        r.y - VIEW_CHIP.h + 2,
      );
      ctx.globalAlpha = 1;
      if (isSel) {
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = colour;
        for (const [hx, hy] of handlePoints(r)) {
          ctx.fillRect(hx - hs, hy - hs, hs * 2, hs * 2);
          ctx.strokeRect(hx - hs, hy - hs, hs * 2, hs * 2);
        }
      }
    });
    // The rectangle being dragged out with the "New view" tool.
    if (drawPreview !== null && drawPreview.w + drawPreview.h > 0) {
      setDash(ctx, [4, 3]);
      ctx.strokeStyle =
        computed.getPropertyValue("--es-accent").trim() || "#818cf8";
      ctx.lineWidth = 2 / cam.zoom;
      ctx.strokeRect(
        drawPreview.x,
        drawPreview.y,
        drawPreview.w,
        drawPreview.h,
      );
      setDash(ctx, []);
    }
    ctx.restore();

    // Game-window overlay (screen space): every view's screen (port)
    // rectangle inside the window, draggable and resizable.
    const allViews = getViews(liveExtra);
    if (allViews.length > 0) {
      const ports = allViews.map(viewPortRect);
      const layout = portLayout(ports, width, height);
      ctx.fillStyle = "#000000";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(
        layout.frame.x - 4,
        layout.frame.y - 16,
        layout.frame.w + 8,
        layout.frame.h + 20,
      );
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(
        `Game window ${layout.winW}x${layout.winH}`,
        layout.frame.x,
        layout.frame.y - 13,
      );
      ctx.strokeStyle = "#888888";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        layout.frame.x,
        layout.frame.y,
        layout.frame.w,
        layout.frame.h,
      );
      allViews.forEach((v, vi) => {
        const b = portToOverlay(
          layout,
          ports[vi] ?? { x: 0, y: 0, w: 0, h: 0 },
        );
        const isSel = selExtra?.kind === "view" && selExtra.index === vi;
        const colour = isSel
          ? computed.getPropertyValue("--es-accent").trim() || "#818cf8"
          : "#4ad0a0";
        ctx.globalAlpha = v.visible ? 0.35 : 0.15;
        ctx.fillStyle = colour;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.globalAlpha = 1;
        setDash(ctx, v.visible ? [] : [2, 3]);
        ctx.strokeStyle = colour;
        ctx.lineWidth = isSel ? 2 : 1;
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        setDash(ctx, []);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${vi}`, b.x + 3, b.y + 2);
        if (isSel) {
          for (const [hx, hy] of handlePoints(b)) {
            ctx.fillRect(hx - 3, hy - 3, 6, 6);
          }
        }
      });
    }
  }, [
    cam,
    liveExtra,
    selExtra,
    drawPreview,
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

  /** Pointer position in canvas (screen) pixels, corrected for the canvas being CSS-scaled. */
  function screenPoint(e: {
    clientX: number;
    clientY: number;
    currentTarget: HTMLCanvasElement;
  }): {
    x: number;
    y: number;
  } {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const kx = rect.width > 0 ? el.width / rect.width : 1;
    const ky = rect.height > 0 ? el.height / rect.height : 1;
    return { x: (e.clientX - rect.left) * kx, y: (e.clientY - rect.top) * ky };
  }

  /** Pointer position in room (world) coordinates, through the editor camera. */
  function canvasPoint(e: React.PointerEvent<HTMLCanvasElement>): {
    x: number;
    y: number;
  } {
    const s = screenPoint(e);
    return screenToWorld(camRef.current, s.x, s.y);
  }

  function capture(e: React.PointerEvent<HTMLCanvasElement>): void {
    if (typeof e.currentTarget.setPointerCapture === "function") {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>): void {
    const scr = screenPoint(e);
    // Middle button, or Space held: pan regardless of what is under the pointer.
    if (e.button === 1 || spaceHeldRef.current) {
      panRef.current = {
        startX: scr.x,
        startY: scr.y,
        camX: camRef.current.x,
        camY: camRef.current.y,
      };
      capture(e);
      return;
    }
    // "New view" tool: start dragging out a rectangle in room space.
    if (drawViewMode) {
      const start = canvasPoint(e);
      drawViewRef.current = {
        x: snapValueOn(start.x),
        y: snapValueOn(start.y),
      };
      setDrawPreview({
        x: drawViewRef.current.x,
        y: drawViewRef.current.y,
        w: 0,
        h: 0,
      });
      capture(e);
      return;
    }
    // The game-window overlay is in screen space and wins over the room.
    const allViews = getViews(liveExtra);
    if (allViews.length > 0) {
      const ports = allViews.map(viewPortRect);
      const layout = portLayout(
        ports,
        e.currentTarget.width,
        e.currentTarget.height,
      );
      if (insidePortOverlay(layout, scr.x, scr.y)) {
        // A resize handle of the selected view's port first.
        if (selExtra?.kind === "view") {
          const sel = ports[selExtra.index];
          if (sel !== undefined) {
            const handle = hitResizeHandle(
              scr.x,
              scr.y,
              portToOverlay(layout, sel),
              4,
            );
            if (handle !== null) {
              portDragRef.current = {
                index: selExtra.index,
                handle,
                offsetX: 0,
                offsetY: 0,
                layout,
              };
              capture(e);
              return;
            }
          }
        }
        const idx = hitPort(layout, ports, scr.x, scr.y);
        if (idx !== null) {
          const port = ports[idx];
          const at = overlayToPort(layout, scr.x, scr.y);
          setSelectedIndex(null);
          setSelExtra({ kind: "view", index: idx });
          portDragRef.current = {
            index: idx,
            handle: null,
            offsetX: at.x - (port?.x ?? 0),
            offsetY: at.y - (port?.y ?? 0),
            layout,
          };
          capture(e);
        }
        return;
      }
    }
    const tol = (HANDLE + 1) / camRef.current.zoom;
    const { x, y } = canvasPoint(e);
    // A resize handle of the already-selected sliced/tiled instance wins over body hits.
    if (selectedIndex !== null) {
      const cur = liveInstances[selectedIndex];
      if (cur !== undefined && isSliced(cur, prefabSprites)) {
        const handle = hitResizeHandle(
          x,
          y,
          instanceBox(cur, prefabSprites),
          tol,
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
        const handle = hitResizeHandle(x, y, viewRect(v), tol);
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
      const extraHit = hitTestExtras(liveExtra, x, y, tol, INSTANCE_SIZE, true);
      setSelExtra(extraHit);
      if (extraHit === null) {
        // Empty background: drag to pan.
        panRef.current = {
          startX: scr.x,
          startY: scr.y,
          camX: camRef.current.x,
          camY: camRef.current.y,
        };
        capture(e);
        return;
      }
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
    const pan = panRef.current;
    if (pan !== null) {
      const scr = screenPoint(e);
      setCam({
        ...camRef.current,
        x: pan.camX + (scr.x - pan.startX),
        y: pan.camY + (scr.y - pan.startY),
      });
      return;
    }
    const drawStart = drawViewRef.current;
    if (drawStart !== null) {
      const p = canvasPoint(e);
      setDrawPreview(
        rectFromDrag(
          drawStart.x,
          drawStart.y,
          snapValueOn(p.x),
          snapValueOn(p.y),
        ),
      );
      return;
    }
    const portDrag = portDragRef.current;
    if (portDrag !== null) {
      const scr = screenPoint(e);
      const layout = portDrag.layout;
      const at = overlayToPort(layout, scr.x, scr.y);
      setLiveExtra((prev) => {
        const v = getViews(prev)[portDrag.index];
        if (v === undefined) return prev;
        if (portDrag.handle === null) {
          const nx = snapValueOn(at.x - portDrag.offsetX);
          const ny = snapValueOn(at.y - portDrag.offsetY);
          return setViewPortRect(prev, portDrag.index, {
            ...viewPortRect(v),
            x: Math.max(0, nx),
            y: Math.max(0, ny),
          });
        }
        const nb = resizeBox(
          viewPortRect(v),
          portDrag.handle,
          at.x,
          at.y,
          snapToGrid,
          gridSize,
          MIN_SLICED_SIZE,
        );
        return setViewPortRect(prev, portDrag.index, nb);
      });
      return;
    }
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

  function snapValueOn(v: number): number {
    return snapToGrid && gridSize > 0 ? Math.round(v / gridSize) * gridSize : v;
  }

  function handlePointerUp(): void {
    if (panRef.current !== null) {
      panRef.current = null;
      return;
    }
    if (drawViewRef.current !== null) {
      drawViewRef.current = null;
      const rect = drawPreview;
      setDrawPreview(null);
      setDrawViewMode(false);
      if (rect !== null && state !== undefined) {
        // One history step for the whole new view; too small a drag adds nothing.
        const added = addView(liveExtra, rect);
        if (added.index >= 0) {
          setLiveExtra(added.extra);
          setSelExtra({ kind: "view", index: added.index });
          commitExtra(added.extra);
        }
      }
      return;
    }
    if (portDragRef.current !== null) {
      portDragRef.current = null;
      if (state !== undefined && liveExtra !== state.extra) {
        commitExtra(liveExtra);
      }
      return;
    }
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

  function handleDoubleClick(e: React.MouseEvent<HTMLCanvasElement>): void {
    const scr = screenPoint(e);
    const w = screenToWorld(camRef.current, scr.x, scr.y);
    const hit = hitTestExtras(
      liveExtra,
      w.x,
      w.y,
      (HANDLE + 1) / camRef.current.zoom,
      INSTANCE_SIZE,
      true,
    );
    if (hit?.kind !== "view") return;
    const next = toggleViewVisible(liveExtra, hit.index);
    setLiveExtra(next);
    setSelExtra(hit);
    commitExtra(next);
  }

  const showCanvas =
    scenePaths.length > 0 &&
    !(
      liveInstances.length === 0 &&
      getViews(liveExtra).length === 0 &&
      getEntities(liveExtra).length === 0
    );

  // Wheel zoom about the cursor. A native, non-passive listener: React's
  // onWheel is passive, so it could not stop the page from scrolling.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || !showCanvas) return;
    const onWheel = (ev: WheelEvent): void => {
      ev.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const kx = rect.width > 0 ? canvas.width / rect.width : 1;
      const ky = rect.height > 0 ? canvas.height / rect.height : 1;
      const factor = Math.exp(-ev.deltaY * 0.0015);
      setCam(
        zoomAt(
          camRef.current,
          factor,
          (ev.clientX - rect.left) * kx,
          (ev.clientY - rect.top) * ky,
        ),
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [showCanvas, setCam]);

  // Hold Space to pan with the primary button.
  React.useEffect(() => {
    const isTyping = (t: EventTarget | null): boolean =>
      t instanceof HTMLElement &&
      (t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT");
    const down = (ev: KeyboardEvent): void => {
      if (ev.code === "Escape" && drawViewRef.current !== null) {
        drawViewRef.current = null;
        setDrawPreview(null);
        setDrawViewMode(false);
        return;
      }
      if (
        ev.code === "Space" &&
        !isTyping(ev.target) &&
        isElementShown(rootRef.current)
      ) {
        spaceHeldRef.current = true;
        ev.preventDefault();
      }
    };
    const up = (ev: KeyboardEvent): void => {
      if (ev.code === "Space") spaceHeldRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  /** Bounds of everything in the room: instances, entities, view world rectangles. */
  function contentBounds(): Box {
    const boxes: Box[] = [
      ...liveInstances.map((i) => instanceBox(i, prefabSprites)),
      ...getEntities(liveExtra).map((en) => entityRect(en, INSTANCE_SIZE)),
      ...getViews(liveExtra).map(viewRect),
    ];
    if (boxes.length === 0) return { x: 0, y: 0, w: 960, h: 640 };
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    const x1 = Math.max(...boxes.map((b) => b.x + b.w));
    const y1 = Math.max(...boxes.map((b) => b.y + b.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function zoomBy(factor: number): void {
    const c = canvasRef.current;
    setCam(
      zoomAt(
        camRef.current,
        factor,
        (c?.width ?? 960) / 2,
        (c?.height ?? 640) / 2,
      ),
    );
  }

  function fitToContent(): void {
    const c = canvasRef.current;
    setCam(fitCamera(contentBounds(), c?.width ?? 960, c?.height ?? 640));
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
              onDoubleClick={handleDoubleClick}
              style={{
                width: "100%",
                height: "100%",
                cursor: drawViewMode ? "crosshair" : "grab",
              }}
            />
          )}
          <ViewControls />
          {showCanvas ? (
            <div
              data-testid="room-zoom-controls"
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: 2,
                borderRadius: 6,
                background:
                  "color-mix(in srgb, var(--es-surface) 90%, transparent)",
                border: "1px solid var(--es-border)",
                fontSize: 11,
                color: "var(--es-text-muted)",
              }}
            >
              {(
                [
                  ["\u2212", "Zoom out", () => zoomBy(1 / 1.25)],
                  ["+", "Zoom in", () => zoomBy(1.25)],
                  ["100%", "Reset zoom and pan", () => setCam(DEFAULT_CAMERA)],
                  ["Fit", "Fit the whole room in view", fitToContent],
                ] as const
              ).map(([label, title, onClick]) => (
                <button
                  key={title}
                  type="button"
                  title={title}
                  onClick={onClick}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--es-text)",
                    cursor: "pointer",
                    fontSize: 11,
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                data-testid="room-new-view"
                title="Draw a new camera view: drag a rectangle on the room (Esc cancels)"
                aria-pressed={drawViewMode}
                onClick={() => setDrawViewMode((m) => !m)}
                style={{
                  background: drawViewMode ? "var(--es-accent)" : "transparent",
                  border: "none",
                  color: drawViewMode
                    ? "var(--es-accent-fg, #000)"
                    : "var(--es-text)",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                New view
              </button>
              <span data-testid="room-zoom-level" style={{ padding: "0 6px" }}>
                {Math.round(cam.zoom * 100)}%
              </span>
            </div>
          ) : null}
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
            <div style={{ fontWeight: 600 }}>{selected.prefab.name}</div>
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
                            ...(prefabSprites.get(selected.prefab.name) ?? {}),
                            ...(selected.prefab.props ?? {}),
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
