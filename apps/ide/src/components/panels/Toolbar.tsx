import React from "react";
import {
  Play,
  Pause,
  Square,
  Download,
  Settings,
  ChevronDown,
  Bug,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { Button } from "../ui/Button";
import { useIDEStore } from "../../store/ideStore";
import type { Theme } from "../../store/ideStore";

function BuildStatusPill(): React.ReactElement | null {
  const buildStatus = useIDEStore((s) => s.buildStatus);
  const buildDuration = useIDEStore((s) => s.buildDuration);
  const setBottomTab = useIDEStore((s) => s.setBottomTab);

  if (buildStatus === "idle") return null;

  if (buildStatus === "building") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          borderRadius: 10,
          background: "color-mix(in srgb, var(--es-yellow) 10%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--es-yellow) 25%, transparent)",
          fontSize: 11,
          color: "var(--es-yellow)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--es-yellow)",
            display: "inline-block",
            animation: "es-spin 1s linear infinite",
          }}
        />
        Building…
      </div>
    );
  }

  if (buildStatus === "success") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "2px 8px",
          borderRadius: 10,
          background: "color-mix(in srgb, var(--es-green) 10%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--es-green) 25%, transparent)",
          fontSize: 11,
          color: "var(--es-green)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--es-green)",
            display: "inline-block",
          }}
        />
        {buildDuration !== null ? `${buildDuration}ms` : "OK"}
      </div>
    );
  }

  return (
    <button
      type="button"
      title="Click to view errors in console"
      onClick={() => setBottomTab("console")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 10,
        background: "color-mix(in srgb, var(--es-red) 10%, transparent)",
        border: "1px solid color-mix(in srgb, var(--es-red) 25%, transparent)",
        fontSize: 11,
        color: "var(--es-red)",
        cursor: "pointer",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--es-red)",
          display: "inline-block",
        }}
      />
      Build error
    </button>
  );
}

function LogoMark(): React.ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 320"
      width="24"
      height="24"
      aria-hidden="true"
    >
      <defs>
        <style>{`
          .es-logo-ring { opacity: var(--logo-ring-opacity, 0.4); }
          .es-logo-hole { opacity: var(--logo-hole-opacity, 0.55); }
        `}</style>
        <linearGradient id="es-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop
            offset="0%"
            style={{ stopColor: "var(--logo-bg-start, #0f0f1a)" }}
          />
          <stop
            offset="100%"
            style={{ stopColor: "var(--logo-bg-end, #1a1a3e)" }}
          />
        </linearGradient>
        <linearGradient id="es-logo-accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6c63ff" />
          <stop offset="100%" stopColor="#ff6ca8" />
        </linearGradient>
        <linearGradient id="es-logo-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5b52ee" />
          <stop offset="100%" stopColor="#e85a96" />
        </linearGradient>
        <filter id="es-logo-blur">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="160" cy="160" r="150" fill="url(#es-logo-bg)" />
      <circle
        cx="160"
        cy="160"
        r="148"
        fill="none"
        stroke="url(#es-logo-accent)"
        strokeWidth="2"
        className="es-logo-ring"
      />
      <rect
        x="117"
        y="108"
        width="26"
        height="40"
        rx="13"
        fill="url(#es-logo-accent)"
        filter="url(#es-logo-blur)"
        className="es-logo-hole"
      />
      <rect
        x="177"
        y="108"
        width="26"
        height="40"
        rx="13"
        fill="url(#es-logo-accent)"
        filter="url(#es-logo-blur)"
        className="es-logo-hole"
      />
      <rect
        x="119"
        y="110"
        width="22"
        height="36"
        rx="11"
        fill="url(#es-logo-glow)"
      />
      <rect
        x="179"
        y="110"
        width="22"
        height="36"
        rx="11"
        fill="url(#es-logo-glow)"
      />
      <rect
        x="90"
        y="90"
        width="140"
        height="140"
        rx="20"
        fill="none"
        stroke="url(#es-logo-accent)"
        strokeWidth="3"
      />
    </svg>
  );
}

const THEME_CYCLE: Record<Theme, Theme> = {
  dark: "light",
  light: "system",
  system: "dark",
};
const THEME_ICON: Record<Theme, React.ReactElement> = {
  dark: <Moon size={13} />,
  light: <Sun size={13} />,
  system: <Monitor size={13} />,
};
const THEME_LABEL: Record<Theme, string> = {
  dark: "Dark theme (click to switch)",
  light: "Light theme (click to switch)",
  system: "System theme (click to switch)",
};

interface ToolbarProps {
  onExport: () => void;
}

export function Toolbar({ onExport }: ToolbarProps): React.ReactElement {
  const {
    playState,
    projectName,
    setPlayState,
    buildMode,
    toggleBuildMode,
    setSettingsOpen,
    theme,
    setTheme,
  } = useIDEStore();

  const handlePlay = (): void => {
    if (playState === "playing") {
      setPlayState("paused");
    } else {
      setPlayState("playing");
    }
  };

  const handleStop = (): void => {
    setPlayState("stopped");
  };

  const debugTooltip =
    buildMode === "debug"
      ? "Debug: physics overlays visible, console kept. Click for Release."
      : "Release: stripped, minified. Click for Debug.";

  return (
    <>
      <style>{`
        @keyframes es-spin {
          from { opacity: 1; }
          50% { opacity: 0.3; }
          to { opacity: 1; }
        }
      `}</style>

      <header
        className="flex items-center h-10 px-3 gap-2 border-b"
        style={{
          background: "var(--es-surface)",
          borderColor: "var(--es-border)",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <LogoMark />
          <span
            className="font-semibold text-sm tracking-tight"
            style={{ color: "var(--es-text)" }}
          >
            EmptySock
          </span>
        </div>

        {/* Separator */}
        <div
          className="w-px h-5 mx-1"
          style={{ background: "var(--es-border)" }}
        />

        {/* Project name */}
        <button
          type="button"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--es-surface-2)]"
          style={{ color: "var(--es-text-muted)" }}
        >
          <span style={{ color: "var(--es-text)" }} className="font-medium">
            {projectName}
          </span>
          <ChevronDown size={11} />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Build status pill */}
        <BuildStatusPill />

        {/* Play controls */}
        <div
          className="flex items-center rounded overflow-hidden border"
          style={{ borderColor: "var(--es-border)" }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePlay}
            title={playState === "playing" ? "Pause" : "Play"}
            style={{
              borderRadius: 0,
              color:
                playState === "playing"
                  ? "var(--es-yellow)"
                  : "var(--es-green)",
              background:
                playState === "playing"
                  ? "color-mix(in srgb, var(--es-yellow) 8%, transparent)"
                  : undefined,
            }}
          >
            {playState === "playing" ? <Pause size={13} /> : <Play size={13} />}
          </Button>
          <div
            className="w-px h-5"
            style={{ background: "var(--es-border)" }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStop}
            disabled={playState === "stopped"}
            title="Stop"
            style={{ borderRadius: 0, color: "var(--es-red)" }}
          >
            <Square size={13} />
          </Button>

          <div
            className="w-px h-5"
            style={{ background: "var(--es-border)" }}
          />

          {/* Debug / Release toggle */}
          <button
            type="button"
            title={debugTooltip}
            onClick={toggleBuildMode}
            className="flex items-center gap-1 px-2"
            style={{
              height: "100%",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.05em",
              border: "none",
              borderRadius: 0,
              cursor: "pointer",
              background:
                buildMode === "debug"
                  ? "color-mix(in srgb, var(--es-accent) 12%, transparent)"
                  : "transparent",
              color:
                buildMode === "debug"
                  ? "var(--es-accent)"
                  : "var(--es-text-muted)",
              transition: "background 0.15s, color 0.15s",
              minWidth: 64,
              justifyContent: "center",
            }}
          >
            <Bug size={10} />
            {buildMode === "debug" ? "DEBUG" : "RELEASE"}
          </button>
        </div>

        {/* Separator */}
        <div
          className="w-px h-5 mx-1"
          style={{ background: "var(--es-border)" }}
        />

        {/* Export */}
        <Button variant="accent" size="sm" onClick={onExport}>
          <Download size={11} />
          Export
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          title={THEME_LABEL[theme]}
          onClick={() => setTheme(THEME_CYCLE[theme])}
        >
          {THEME_ICON[theme]}
        </Button>

        {/* Settings */}
        <Button
          variant="ghost"
          size="icon"
          title="Settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={13} />
        </Button>
      </header>
    </>
  );
}
