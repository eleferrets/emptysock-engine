import React, { useEffect, useRef, useState } from "react";
import {
  Trash2,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  Play,
  Pause,
  SkipForward,
  Plus,
  X,
} from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import type { LogLevel } from "../../store/ideStore";
import { Button } from "../ui/Button";

function LevelIcon({ level }: { level: LogLevel }): React.ReactElement {
  const props = { size: 11, strokeWidth: 2 };
  switch (level) {
    case "error":
      return <AlertCircle {...props} style={{ color: "var(--es-red)" }} />;
    case "warn":
      return <AlertTriangle {...props} style={{ color: "var(--es-yellow)" }} />;
    case "debug":
      return <Bug {...props} style={{ color: "var(--es-text-muted)" }} />;
    default:
      return <Info {...props} style={{ color: "var(--es-blue)" }} />;
  }
}

function levelColor(level: LogLevel): string {
  switch (level) {
    case "error":
      return "var(--es-red)";
    case "warn":
      return "var(--es-yellow)";
    case "debug":
      return "var(--es-text-muted)";
    default:
      return "var(--es-text)";
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

const IDLE_QUIPS = [
  "All quiet. Your game is probably fine.",
  "Nothing to report. Go ship something.",
  "Silence. Beautiful, terrifying silence.",
  "No errors. You're either very good or very lucky.",
  "Waiting for output… maybe grab a coffee.",
  "Clean slate. Don't ruin it.",
  "The console is empty. The possibilities are not.",
  "Zero logs. Zero regrets. Probably.",
  "Ready when you are. No rush.",
  "Press Play. See what breaks.",
];

type ConsolePanelTab = "console" | "debugger";

const SECTION_HEADER: React.CSSProperties = {
  padding: "5px 12px 4px",
  fontSize: 10,
  color: "var(--es-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderBottom: "1px solid var(--es-border)",
  background: "var(--es-surface-2)",
  flexShrink: 0,
};

const CTRL_BTN: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 4,
  border: "1px solid var(--es-border)",
  background: "var(--es-surface)",
  color: "var(--es-text)",
  cursor: "pointer",
  fontSize: 11,
  fontFamily: "inherit",
};

export function ConsolePanel(): React.ReactElement {
  const {
    logs,
    clearLogs,
    debuggerPaused,
    debuggerVars,
    debugBreakpoints,
    setDebuggerPaused,
    addBreakpoint,
    removeBreakpoint,
    _dispatchDebugCommand,
  } = useIDEStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const quip = useRef(
    IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)],
  );
  const [activeTab, setActiveTab] = useState<ConsolePanelTab>("console");
  const [bpInput, setBpInput] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  function handlePauseResume(): void {
    if (debuggerPaused) {
      setDebuggerPaused(false);
      _dispatchDebugCommand("debug:resume");
    } else {
      setDebuggerPaused(true);
      _dispatchDebugCommand("debug:pause");
    }
  }

  function handleStep(): void {
    _dispatchDebugCommand("debug:step");
  }

  function handleAddBreakpoint(): void {
    const label = bpInput.trim();
    if (label.length === 0) return;
    addBreakpoint(label);
    setBpInput("");
  }

  const varEntries = Object.entries(debuggerVars);

  return (
    <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface-2)",
          flexShrink: 0,
        }}
      >
        {(["console", "debugger"] as ConsolePanelTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "4px 14px",
              fontSize: 11,
              fontFamily: "inherit",
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--es-accent)"
                  : "2px solid transparent",
              color:
                activeTab === tab ? "var(--es-text)" : "var(--es-text-muted)",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {tab}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {activeTab === "console" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearLogs}
            title="Clear console"
          >
            <Trash2 size={11} />
          </Button>
        )}
      </div>

      {/* ── Console tab ───────────────────────────────────────────────────── */}
      {activeTab === "console" && (
        <div className="flex-1 overflow-y-auto">
          {logs.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--es-text-muted)",
                fontSize: 11,
                fontStyle: "italic",
              }}
            >
              {quip.current}
            </div>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 px-3 py-1 border-b"
              style={{
                borderColor: "var(--es-border)",
                background:
                  log.level === "error"
                    ? "color-mix(in srgb, var(--es-red) 5%, transparent)"
                    : log.level === "warn"
                      ? "color-mix(in srgb, var(--es-yellow) 4%, transparent)"
                      : undefined,
              }}
            >
              <LevelIcon level={log.level} />
              <span
                className="text-[10px] flex-shrink-0 font-mono"
                style={{ color: "var(--es-text-muted)", marginTop: 1 }}
              >
                {formatTime(log.timestamp)}
              </span>
              {log.source !== undefined && (
                <span
                  className="text-[10px] flex-shrink-0 px-1 rounded font-mono"
                  style={{
                    background: "var(--es-surface-2)",
                    color: "var(--es-accent)",
                    marginTop: 1,
                  }}
                >
                  {log.source}
                </span>
              )}
              <span
                className="text-xs font-mono flex-1"
                style={{
                  color: levelColor(log.level),
                  wordBreak: "break-word",
                }}
              >
                {log.message}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Debugger tab ──────────────────────────────────────────────────── */}
      {activeTab === "debugger" && (
        <div
          className="flex-1 overflow-y-auto"
          style={{ display: "flex", flexDirection: "column" }}
        >
          {/* Status + controls */}
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid var(--es-border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: debuggerPaused
                  ? "var(--es-yellow)"
                  : "var(--es-green)",
                flexShrink: 0,
              }}
            />
            <span
              style={{ fontSize: 11, color: "var(--es-text-muted)", flex: 1 }}
            >
              {debuggerPaused ? "Paused" : "Running"}
            </span>
            <button
              type="button"
              onClick={handlePauseResume}
              title={debuggerPaused ? "Resume" : "Pause"}
              style={CTRL_BTN}
            >
              {debuggerPaused ? <Play size={11} /> : <Pause size={11} />}
              {debuggerPaused ? "Resume" : "Pause"}
            </button>
            <button
              type="button"
              onClick={handleStep}
              disabled={!debuggerPaused}
              title="Advance one frame"
              style={{
                ...CTRL_BTN,
                color: debuggerPaused
                  ? "var(--es-text)"
                  : "var(--es-text-muted)",
                cursor: debuggerPaused ? "pointer" : "default",
                opacity: debuggerPaused ? 1 : 0.4,
              }}
            >
              <SkipForward size={11} />
              Step
            </button>
          </div>

          {/* Variables section */}
          <div style={SECTION_HEADER}>Variables</div>
          {varEntries.length === 0 ? (
            <div
              style={{
                padding: "12px 16px",
                fontSize: 11,
                color: "var(--es-text-muted)",
                fontStyle: "italic",
              }}
            >
              No variables. Hit a breakpoint to inspect state.
            </div>
          ) : (
            <div style={{ overflowX: "auto", flexShrink: 0 }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                <thead>
                  <tr style={{ background: "var(--es-surface-2)" }}>
                    <th
                      style={{
                        padding: "4px 12px",
                        textAlign: "left",
                        color: "var(--es-text-muted)",
                        fontWeight: 500,
                        borderBottom: "1px solid var(--es-border)",
                      }}
                    >
                      Name
                    </th>
                    <th
                      style={{
                        padding: "4px 12px",
                        textAlign: "left",
                        color: "var(--es-text-muted)",
                        fontWeight: 500,
                        borderBottom: "1px solid var(--es-border)",
                      }}
                    >
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {varEntries.map(([key, val]) => (
                    <tr
                      key={key}
                      style={{
                        borderBottom: "1px solid var(--es-border)",
                      }}
                    >
                      <td
                        style={{
                          padding: "3px 12px",
                          color: "var(--es-accent)",
                        }}
                      >
                        {key}
                      </td>
                      <td
                        style={{
                          padding: "3px 12px",
                          color: "var(--es-text)",
                          wordBreak: "break-all",
                        }}
                      >
                        {typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Breakpoints section */}
          <div
            style={{
              ...SECTION_HEADER,
              marginTop: 8,
              borderTop: "1px solid var(--es-border)",
            }}
          >
            Breakpoints
          </div>
          <div
            style={{
              padding: "6px 12px",
              display: "flex",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <input
              type="text"
              placeholder="Breakpoint label…"
              value={bpInput}
              onChange={(e) => setBpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddBreakpoint();
              }}
              style={{
                flex: 1,
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid var(--es-border)",
                background: "var(--es-surface)",
                color: "var(--es-text)",
                fontSize: 11,
                fontFamily: "JetBrains Mono, monospace",
              }}
            />
            <button
              type="button"
              onClick={handleAddBreakpoint}
              style={CTRL_BTN}
            >
              <Plus size={11} />
              Add
            </button>
          </div>
          {debugBreakpoints.length === 0 ? (
            <div
              style={{
                padding: "2px 16px 12px",
                fontSize: 11,
                color: "var(--es-text-muted)",
                fontStyle: "italic",
              }}
            >
              No breakpoints. Call Engine.debugBreak(label) in game code.
            </div>
          ) : (
            <div
              style={{
                padding: "0 12px 8px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {debugBreakpoints.map((label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 8px",
                    borderRadius: 4,
                    background: "var(--es-surface-2)",
                    border: "1px solid var(--es-border)",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--es-red)",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 11,
                      fontFamily: "JetBrains Mono, monospace",
                      color: "var(--es-text)",
                    }}
                  >
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeBreakpoint(label)}
                    title="Remove breakpoint"
                    style={{
                      display: "flex",
                      padding: 2,
                      background: "none",
                      border: "none",
                      color: "var(--es-text-muted)",
                      cursor: "pointer",
                      borderRadius: 2,
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
