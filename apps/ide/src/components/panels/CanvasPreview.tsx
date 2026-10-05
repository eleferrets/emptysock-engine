import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useMemo,
} from "react";
import { Monitor, Wifi, RefreshCw, AlignCenter } from "lucide-react";
import { BouncingBallsDemo } from "../../demo/BouncingBalls";
import { useIDEStore, debugCommandBus } from "../../store/ideStore";
import { playRunner } from "../../services/PlayRunner";
import { gameBuildService } from "../../services/GameBuildService";
import { drawGrid, drawRulers, drawGuides } from "../../lib/editorGrid";
import { useEngineChannel } from "../../hooks/useEngineChannel";
import { ViewControls } from "./shared/ViewControls";

export function CanvasPreview(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const demoRef = useRef<BouncingBallsDemo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const runnerContainerRef = useRef<HTMLDivElement>(null);
  const hotReloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gameError, setGameError] = useState<{
    message: string;
    stack?: string;
  } | null>(null);

  const {
    fps,
    setFps,
    fpsTarget,
    setFpsTarget,
    playState,
    debugOverlay,
    entities,
    editorCode,
    openFiles,
    buildMode,
    addLog,
    projectName,
    windowConfig,
    editorGridSize,
    editorShowGrid,
    editorShowRuler,
    editorSnapToGrid,
    editorShowGuides,
    setEditorGridSize,
    setEditorShowGuides,
    debugBreakpoints,
    setDebuggerPaused,
    setDebuggerVars,
  } = useIDEStore();

  // Getter-based ref that always resolves to the current runner iframe
  const engineIframeRef = useMemo(
    () => ({
      get current(): HTMLIFrameElement | null {
        return (
          runnerContainerRef.current?.querySelector<HTMLIFrameElement>(
            "iframe",
          ) ?? null
        );
      },
    }),
    [],
  );

  useEngineChannel(engineIframeRef);

  const initDemo = useCallback(async (): Promise<void> => {
    if (canvasRef.current === null) return;
    if (demoRef.current !== null) demoRef.current.destroy();
    const demo = new BouncingBallsDemo();
    demoRef.current = demo;
    await demo.init(canvasRef.current, setFps);
  }, [setFps]);

  useEffect(() => {
    if (playState === "playing") {
      const unsubscribe = playRunner.onMessage((msg) => {
        if (msg.type === "fps" && msg.fps !== undefined) setFps(msg.fps);
        else if (msg.type === "log" && msg.message !== undefined)
          addLog(msg.level ?? "info", msg.message, msg.source);
        else if (
          (msg.type === "error" || msg.type === "game-error") &&
          msg.message !== undefined
        ) {
          addLog("error", msg.message, msg.source);
          setGameError({
            message: msg.message,
            ...(msg.stack !== undefined ? { stack: msg.stack } : {}),
          });
        } else if (msg.type === "ready") {
          setGameError(null);
        }
      });
      if (runnerContainerRef.current !== null) {
        const define: Record<string, string> = {
          PROJECT_TITLE: JSON.stringify(windowConfig.title),
          PROJECT_NAME: JSON.stringify(projectName),
          GAME_WIDTH: String(windowConfig.width),
          GAME_HEIGHT: String(windowConfig.height),
          DEBUG: buildMode === "debug" ? "true" : "false",
        };
        void playRunner.start(
          editorCode,
          buildMode,
          runnerContainerRef.current,
          define,
          openFiles,
        );
      }
      return () => {
        unsubscribe();
        playRunner.stop();
      };
    } else {
      playRunner.stop();
      return undefined;
    }
  }, [playState, editorCode, buildMode, setFps, addLog]);

  useEffect(() => {
    void initDemo();
    return () => {
      demoRef.current?.destroy();
      demoRef.current = null;
    };
  }, [initDemo]);

  // Auto hot reload when any open file changes while playing (debounced 500ms)
  useEffect(() => {
    if (playState !== "playing" || buildMode !== "debug") return;
    if (hotReloadTimerRef.current !== null) {
      clearTimeout(hotReloadTimerRef.current);
    }
    hotReloadTimerRef.current = setTimeout(() => {
      hotReloadTimerRef.current = null;
      const define: Record<string, string> = {
        PROJECT_TITLE: JSON.stringify(windowConfig.title),
        PROJECT_NAME: JSON.stringify(projectName),
        GAME_WIDTH: String(windowConfig.width),
        GAME_HEIGHT: String(windowConfig.height),
        DEBUG: "true",
      };
      void gameBuildService
        .buildNow({
          code: editorCode,
          mode: "debug",
          define,
          virtualFiles: openFiles,
          format: "iife",
        })
        .then((result) => {
          if (result.success) {
            playRunner.hotReload(result.js);
          }
        });
    }, 500);
    return () => {
      if (hotReloadTimerRef.current !== null) {
        clearTimeout(hotReloadTimerRef.current);
        hotReloadTimerRef.current = null;
      }
    };
  }, [editorCode, openFiles, playState, buildMode]);

  // Draw the grid/ruler overlay whenever relevant state changes
  useEffect(() => {
    const overlay = overlayCanvasRef.current;
    if (overlay === null) return;
    const ctx = overlay.getContext("2d");
    if (ctx === null) return;

    const w = overlay.width;
    const h = overlay.height;
    ctx.clearRect(0, 0, w, h);

    const opts = {
      gridSize: editorGridSize,
      showGrid: editorShowGrid,
      showRuler: editorShowRuler,
      snapToGrid: editorSnapToGrid,
      showGuides: editorShowGuides,
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
    };

    drawGrid(ctx, w, h, opts);
    drawGuides(ctx, w, h, [], opts);
    drawRulers(ctx, w, h, opts);
  }, [
    editorGridSize,
    editorShowGrid,
    editorShowRuler,
    editorSnapToGrid,
    editorShowGuides,
  ]);

  // Sync overlay canvas size to game canvas whenever the container resizes
  useEffect(() => {
    const gameCanvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (gameCanvas === null || overlay === null) return;

    const observer = new ResizeObserver(() => {
      const rect = gameCanvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const lw = rect.width;
      const lh = rect.height;
      overlay.width = Math.round(lw * dpr);
      overlay.height = Math.round(lh * dpr);
      // Trigger a redraw after resize
      const ctx = overlay.getContext("2d");
      if (ctx === null) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, lw, lh);
      const opts = {
        gridSize: editorGridSize,
        showGrid: editorShowGrid,
        showRuler: editorShowRuler,
        snapToGrid: editorSnapToGrid,
        showGuides: editorShowGuides,
        scrollX: 0,
        scrollY: 0,
        zoom: 1,
      };
      drawGrid(ctx, lw, lh, opts);
      drawGuides(ctx, lw, lh, [], opts);
      drawRulers(ctx, lw, lh, opts);
    });
    observer.observe(gameCanvas);
    return () => observer.disconnect();
  }, [
    editorGridSize,
    editorShowGrid,
    editorShowRuler,
    editorSnapToGrid,
    editorShowGuides,
  ]);

  // ── Debugger: relay debug commands from the IDE to the game iframe ───────────
  useEffect(() => {
    function onDebugCmd(event: Event): void {
      const detail = (event as CustomEvent<{ type: string }>).detail;
      const iframe =
        runnerContainerRef.current?.querySelector<HTMLIFrameElement>("iframe");
      iframe?.contentWindow?.postMessage({ type: detail.type }, "*");
    }
    debugCommandBus.addEventListener("debug-cmd", onDebugCmd);
    return () => debugCommandBus.removeEventListener("debug-cmd", onDebugCmd);
  }, []);

  // ── Debugger: listen for debug messages posted by the game iframe ────────────
  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      const data = event.data;
      if (typeof data !== "object" || data === null) return;
      const d = data as Record<string, unknown>;
      const msgType = d["type"];
      if (msgType === "debug:break") {
        setDebuggerPaused(true);
        const vars = d["vars"];
        if (typeof vars === "object" && vars !== null) {
          setDebuggerVars(vars as Record<string, unknown>);
        }
        addLog(
          "debug",
          `Breakpoint: ${String(d["label"] ?? "unknown")}`,
          "Debugger",
        );
      } else if (msgType === "debug:vars") {
        const vars = d["vars"];
        if (typeof vars === "object" && vars !== null) {
          setDebuggerVars(vars as Record<string, unknown>);
        }
      } else if (msgType === "debug:resume") {
        setDebuggerPaused(false);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setDebuggerPaused, setDebuggerVars, addLog]);

  // ── Debugger: sync active breakpoints into the game iframe ───────────────────
  useEffect(() => {
    if (playState !== "playing") return;
    const iframe =
      runnerContainerRef.current?.querySelector<HTMLIFrameElement>("iframe");
    iframe?.contentWindow?.postMessage(
      { type: "debug:setBreakpoints", labels: debugBreakpoints },
      "*",
    );
  }, [debugBreakpoints, playState]);

  const rendererType = "WebGL2";

  const toolbarButtonStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 8px",
    borderRadius: 4,
    border: `1px solid ${active ? "color-mix(in srgb, var(--es-accent) 50%, transparent)" : "var(--es-border)"}`,
    background: active
      ? "color-mix(in srgb, var(--es-accent) 15%, transparent)"
      : "color-mix(in srgb, var(--es-bg) 60%, transparent)",
    color: active ? "var(--es-accent)" : "var(--es-text-muted)",
    cursor: "pointer",
    fontSize: 11,
    fontFamily: "inherit",
    whiteSpace: "nowrap" as const,
    transition: "background 0.15s, border-color 0.15s",
  });

  return (
    <div
      className="relative flex-1 flex flex-col overflow-hidden h-full"
      ref={containerRef}
    >
      <ViewControls />
      {/* Toolbar strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          borderBottom: "1px solid var(--es-border)",
          background: "color-mix(in srgb, var(--es-bg) 85%, transparent)",
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        <button
          type="button"
          title="Toggle alignment guides"
          style={toolbarButtonStyle(editorShowGuides)}
          onClick={() => setEditorShowGuides(!editorShowGuides)}
        >
          <AlignCenter size={12} />
          Guides
        </button>
        <div
          style={{
            width: 1,
            height: 16,
            background: "var(--es-border)",
            margin: "0 2px",
            flexShrink: 0,
          }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            color: "var(--es-text-muted)",
            fontSize: 11,
            whiteSpace: "nowrap",
          }}
        >
          Grid size
          <input
            type="number"
            min={4}
            max={256}
            value={editorGridSize}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (v >= 4 && v <= 256) setEditorGridSize(v);
            }}
            style={{
              width: 52,
              padding: "2px 4px",
              borderRadius: 4,
              border: "1px solid var(--es-border)",
              background: "var(--es-bg)",
              color: "var(--es-text)",
              fontSize: 11,
              fontFamily: "inherit",
            }}
          />
        </label>
        <div
          style={{
            width: 1,
            height: 16,
            background: "var(--es-border)",
            margin: "0 2px",
            flexShrink: 0,
          }}
        />
        <select
          value={fpsTarget}
          onChange={(e) => {
            const val = Number(e.target.value);
            setFpsTarget(val);
            const iframe = runnerContainerRef.current?.querySelector("iframe");
            iframe?.contentWindow?.postMessage(
              { type: "set-fps", fps: val },
              "*",
            );
          }}
          title="Preview FPS cap"
          style={{
            background: "var(--es-bg)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text-muted)",
            fontSize: 11,
            fontFamily: "inherit",
            padding: "2px 4px",
          }}
        >
          <option value={30}>30 fps</option>
          <option value={60}>60 fps</option>
          <option value={120}>120 fps</option>
          <option value={0}>Unlimited</option>
        </select>
      </div>

      <div
        className="flex-1 relative overflow-hidden"
        style={{ background: "var(--es-bg)" }}
      >
        {/* Iframe runner */}
        <div
          ref={runnerContainerRef}
          style={{
            position: "absolute",
            inset: 0,
            display: playState === "playing" ? "block" : "none",
            zIndex: 10,
          }}
        />

        {/* Game error overlay */}
        {gameError !== null && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 100,
              background: "color-mix(in srgb, var(--es-red) 85%, transparent)",
              color: "var(--es-text-on-accent)",
              fontFamily: "monospace",
              fontSize: 13,
              padding: 16,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <strong>⚠ Game Error</strong>
              <button
                onClick={() => setGameError(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--es-text-on-accent)",
                  cursor: "pointer",
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
            <div>{gameError.message}</div>
            {gameError.stack !== undefined && (
              <div style={{ opacity: 0.75, fontSize: 11 }}>
                {gameError.stack.split("\n").slice(0, 4).join("\n")}
              </div>
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: playState === "playing" ? "none" : "block",
          }}
        />

        {/* Grid/ruler overlay — sits above game canvas, below UI chrome */}
        <canvas
          ref={overlayCanvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            display: playState === "playing" ? "none" : "block",
            zIndex: 5,
          }}
        />

        {/* HUD */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded text-xs font-mono"
            style={{
              background: "color-mix(in srgb, var(--es-bg) 85%, transparent)",
              border: "1px solid var(--es-border)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background:
                  fps >= 55
                    ? "var(--es-green)"
                    : fps >= 30
                      ? "var(--es-yellow)"
                      : "var(--es-red)",
                boxShadow: `0 0 4px ${
                  fps >= 55
                    ? "var(--es-green)"
                    : fps >= 30
                      ? "var(--es-yellow)"
                      : "var(--es-red)"
                }`,
              }}
            />
            <span style={{ color: "var(--es-text-muted)" }}>FPS</span>
            <span
              style={{
                color:
                  fps >= 55
                    ? "var(--es-green)"
                    : fps >= 30
                      ? "var(--es-yellow)"
                      : "var(--es-red)",
                minWidth: "2ch",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {fps}
            </span>
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
            style={{
              background: "color-mix(in srgb, var(--es-bg) 85%, transparent)",
              border: "1px solid var(--es-border)",
              backdropFilter: "blur(8px)",
              color: "var(--es-text-muted)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            <Monitor size={10} />
            {rendererType}
          </div>
        </div>

        {/* Hot reload button — visible in debug mode while playing */}
        {playState === "playing" && buildMode === "debug" && (
          <button
            type="button"
            onClick={() => {
              playRunner.hotReload(editorCode);
            }}
            title="Hot reload (re-inject current code without restarting)"
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: "color-mix(in srgb, var(--es-bg) 88%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--es-accent) 40%, transparent)",
              borderRadius: 6,
              padding: "4px 10px",
              cursor: "pointer",
              color: "var(--es-accent)",
              fontSize: 11,
              fontFamily: "inherit",
              backdropFilter: "blur(8px)",
            }}
          >
            <RefreshCw size={11} />
            Hot Reload
          </button>
        )}

        {/* Debug overlay */}
        {debugOverlay && (
          <>
            <div
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                backgroundImage:
                  "repeating-linear-gradient(0deg,transparent,transparent 31px,color-mix(in srgb,var(--es-accent) 12%,transparent) 31px,color-mix(in srgb,var(--es-accent) 12%,transparent) 32px),repeating-linear-gradient(90deg,transparent,transparent 31px,color-mix(in srgb,var(--es-accent) 12%,transparent) 31px,color-mix(in srgb,var(--es-accent) 12%,transparent) 32px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "color-mix(in srgb, var(--es-bg) 90%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--es-accent) 40%, transparent)",
                borderRadius: 6,
                padding: "8px 12px",
                fontSize: 10,
                fontFamily: "JetBrains Mono, monospace",
                color: "var(--es-text-muted)",
                lineHeight: 1.8,
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  color: "var(--es-accent)",
                  fontWeight: 700,
                  marginBottom: 4,
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Debug
              </div>
              <div>
                Entities:{" "}
                <span style={{ color: "var(--es-text)" }}>
                  {entities.length}
                </span>
              </div>
              <div>
                Draw calls: <span style={{ color: "var(--es-text)" }}>–</span>
              </div>
              <div>
                Physics: <span style={{ color: "var(--es-text)" }}>–</span>
              </div>
              <div>
                Mode: <span style={{ color: "var(--es-accent)" }}>DEBUG</span>
              </div>
            </div>
          </>
        )}

        {/* Stopped overlay */}
        {playState === "stopped" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
            style={{
              background: "color-mix(in srgb, var(--es-bg) 60%, transparent)",
              backdropFilter: "blur(2px)",
            }}
          >
            <div
              className="px-4 py-3 rounded-lg text-center"
              style={{
                background: "var(--es-surface)",
                border: "1px solid var(--es-border)",
              }}
            >
              <div
                className="text-xs mb-1"
                style={{ color: "var(--es-text-muted)" }}
              >
                Click Play to run your game
              </div>
              <div
                className="flex items-center justify-center gap-1.5 text-xs"
                style={{ color: "var(--es-accent)" }}
              >
                <Wifi size={11} />
                PixiJS rendering active
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
