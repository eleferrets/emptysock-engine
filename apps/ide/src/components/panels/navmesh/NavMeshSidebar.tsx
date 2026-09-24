import React from "react";
import type { EditorNavPolygon } from "../../../store/navMeshStore";

export type NavMeshTool = "select" | "draw" | "connect" | "delete";

const TOOLS: { id: NavMeshTool; label: string; hint: string }[] = [
  { id: "select", label: "Select", hint: "Drag vertices or whole polygons" },
  {
    id: "draw",
    label: "Draw",
    hint: "Click to place vertices, Enter to finish",
  },
  {
    id: "connect",
    label: "Connect",
    hint: "Click two polygons to toggle a link",
  },
  { id: "delete", label: "Delete", hint: "Click a polygon to remove it" },
];

interface NavMeshSidebarProps {
  tool: NavMeshTool;
  onSelectTool: (tool: NavMeshTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  draftVertexCount: number;
  onFinishDraft: () => void;
  selectedPolygon: EditorNavPolygon | null;
  onDeleteSelected: () => void;
  polygonCount: number;
  onLoad: () => void;
  onExport: () => void;
}

/**
 * The NavMesh editor's left-hand tool/inspector panel — split out of
 * `NavMeshEditor.tsx` purely to keep that file (the actual Konva stage +
 * interaction logic) well under the 1000-line file-size guideline. This
 * component is pure presentation over props the parent owns; it holds no
 * state of its own.
 */
export function NavMeshSidebar(props: NavMeshSidebarProps): React.ReactElement {
  const {
    tool,
    onSelectTool,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    draftVertexCount,
    onFinishDraft,
    selectedPolygon,
    onDeleteSelected,
    polygonCount,
    onLoad,
    onExport,
  } = props;

  const undoBtnStyle: React.CSSProperties = {
    padding: "3px 8px",
    background: "var(--es-surface)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    color: "var(--es-text)",
    cursor: canUndo ? "pointer" : "default",
    opacity: canUndo ? 1 : 0.4,
  };
  const redoBtnStyle: React.CSSProperties = {
    ...undoBtnStyle,
    cursor: canRedo ? "pointer" : "default",
    opacity: canRedo ? 1 : 0.4,
  };

  return (
    <div
      style={{
        width: 190,
        borderRight: "1px solid var(--es-border)",
        display: "flex",
        flexDirection: "column",
        padding: 8,
        gap: 12,
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 4 }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          style={undoBtnStyle}
          title="Undo (Ctrl+Z)"
        >
          &#x21A9;
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          style={redoBtnStyle}
          title="Redo (Ctrl+Shift+Z)"
        >
          &#x21AA;
        </button>
      </div>

      <div>
        <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
          Tool
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectTool(t.id)}
              title={t.hint}
              style={{
                padding: "4px 8px",
                background:
                  tool === t.id ? "var(--es-accent)" : "var(--es-surface)",
                color: "var(--es-text)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tool === "draw" && (
          <button
            onClick={onFinishDraft}
            disabled={draftVertexCount < 3}
            style={{
              marginTop: 6,
              width: "100%",
              padding: "3px 0",
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              color: "var(--es-text)",
              cursor: draftVertexCount >= 3 ? "pointer" : "default",
              opacity: draftVertexCount >= 3 ? 1 : 0.4,
            }}
            title="Finish polygon (Enter)"
          >
            Finish polygon ({draftVertexCount})
          </button>
        )}
      </div>

      <div>
        <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>
          Selected polygon
        </div>
        {selectedPolygon === null ? (
          <div style={{ color: "var(--es-text-muted)", fontSize: 11 }}>
            None selected.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div>id: {selectedPolygon.id}</div>
            <div>vertices: {selectedPolygon.vertices.length}</div>
            <div>
              neighbours:{" "}
              {selectedPolygon.neighbours.length > 0
                ? selectedPolygon.neighbours.join(", ")
                : "none"}
            </div>
            <button
              onClick={onDeleteSelected}
              style={{
                marginTop: 4,
                padding: "3px 6px",
                background: "var(--es-surface)",
                color: "var(--es-red, #ef4444)",
                border: "1px solid var(--es-border)",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Delete polygon
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          onClick={onLoad}
          style={{
            padding: "4px 8px",
            background: "var(--es-surface)",
            color: "var(--es-text)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Load navmesh.json&#x2026;
        </button>
        <button
          onClick={onExport}
          disabled={polygonCount === 0}
          style={{
            padding: "4px 8px",
            background: "var(--es-surface)",
            color: "var(--es-text)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            cursor: polygonCount > 0 ? "pointer" : "default",
            opacity: polygonCount > 0 ? 1 : 0.4,
            textAlign: "left",
          }}
        >
          Export navmesh.json
        </button>
      </div>
    </div>
  );
}
