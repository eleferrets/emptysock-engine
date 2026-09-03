import React, { useEffect, useRef } from "react";
import { Trash2, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";
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

export function ConsolePanel(): React.ReactElement {
  const { logs, clearLogs } = useIDEStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const quip = useRef(
    IDLE_QUIPS[Math.floor(Math.random() * IDLE_QUIPS.length)],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  return (
    <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{
          height: 28,
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface-2)",
        }}
      >
        <span
          className="text-[10px] uppercase tracking-wider flex-1"
          style={{ color: "var(--es-text-muted)" }}
        >
          {logs.length === 0 ? "Console" : `${logs.length} entries`}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={clearLogs}
          title="Clear console"
        >
          <Trash2 size={11} />
        </Button>
      </div>

      {/* Log entries */}
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
              borderColor: "rgba(42,42,46,0.5)",
              background:
                log.level === "error"
                  ? "rgba(248,113,113,0.05)"
                  : log.level === "warn"
                    ? "rgba(250,204,21,0.04)"
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
              style={{ color: levelColor(log.level), wordBreak: "break-word" }}
            >
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
