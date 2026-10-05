import React from "react";
import { Grid3X3, Magnet, Ruler } from "lucide-react";
import { useIDEStore } from "../../../store/ideStore";

/**
 * View options cluster: small icon buttons pinned to the top-right
 * corner of an editor's canvas. Grid/snap/ruler only mean something inside a
 * specific tool's canvas, so this lives per-panel rather than in the global
 * toolbar (see CLAUDE.md "IDE UI checklist").
 */
export function ViewControls(): React.ReactElement {
  const editorShowGrid = useIDEStore((s) => s.editorShowGrid);
  const editorSnapToGrid = useIDEStore((s) => s.editorSnapToGrid);
  const editorShowRuler = useIDEStore((s) => s.editorShowRuler);
  const setEditorShowGrid = useIDEStore((s) => s.setEditorShowGrid);
  const setEditorSnapToGrid = useIDEStore((s) => s.setEditorSnapToGrid);
  const setEditorShowRuler = useIDEStore((s) => s.setEditorShowRuler);

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 4,
    border: "none",
    background: active
      ? "color-mix(in srgb, var(--es-accent) 18%, transparent)"
      : "transparent",
    color: active ? "var(--es-accent)" : "var(--es-text-muted)",
    cursor: "pointer",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        zIndex: 5,
        display: "flex",
        gap: 2,
        padding: 2,
        borderRadius: 6,
        background: "color-mix(in srgb, var(--es-surface) 90%, transparent)",
        border: "1px solid var(--es-border)",
        boxShadow: "0 1px 4px rgba(0, 0, 0, 0.15)",
      }}
    >
      <button
        type="button"
        title={
          editorShowGrid
            ? "Grid visible (click to hide)"
            : "Grid hidden (click to show)"
        }
        style={btnStyle(editorShowGrid)}
        onClick={() => setEditorShowGrid(!editorShowGrid)}
      >
        <Grid3X3 size={13} />
      </button>
      <button
        type="button"
        title={
          editorSnapToGrid
            ? "Snap to grid on (click to disable)"
            : "Snap to grid off (click to enable)"
        }
        style={btnStyle(editorSnapToGrid)}
        onClick={() => setEditorSnapToGrid(!editorSnapToGrid)}
      >
        <Magnet size={13} />
      </button>
      <button
        type="button"
        title={
          editorShowRuler
            ? "Rulers visible (click to hide)"
            : "Rulers hidden (click to show)"
        }
        style={btnStyle(editorShowRuler)}
        onClick={() => setEditorShowRuler(!editorShowRuler)}
      >
        <Ruler size={13} />
      </button>
    </div>
  );
}
