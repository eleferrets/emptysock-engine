import React from "react";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Eye,
  EyeOff,
  Box,
} from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import type { EntityItem } from "../../store/ideStore";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { useHistory } from "../../hooks/useHistory";

function useIsMobile(): boolean {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < 768);
  React.useEffect(() => {
    const handler = (): void => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return mobile;
}

function EntityRow({
  entity,
  depth = 0,
  selectedIds,
  onEntityClick,
}: {
  entity: EntityItem;
  depth?: number;
  selectedIds: Set<string>;
  onEntityClick: (e: React.MouseEvent, entity: EntityItem) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = React.useState(true);
  const selectEntity = useIDEStore((s) => s.selectEntity);
  const setRightPanelOpen = useIDEStore((s) => s.setRightPanelOpen);
  const toggleEntityActive = useIDEStore((s) => s.toggleEntityActive);
  const isMobile = useIsMobile();

  const isSelected = selectedIds.has(entity.id);
  const hasChildren = entity.children.length > 0;

  return (
    <div>
      <button
        onClick={(e) => {
          selectEntity(entity.id);
          if (isMobile) setRightPanelOpen(true);
          onEntityClick(e, entity);
        }}
        className="flex items-center w-full gap-1 py-1 pr-2 group"
        style={{
          paddingLeft: `${8 + depth * 14}px`,
          background: isSelected ? "rgba(124,106,247,0.15)" : undefined,
          borderLeft: isSelected
            ? "2px solid var(--es-accent)"
            : "2px solid transparent",
          color: entity.active ? "var(--es-text)" : "var(--es-text-muted)",
        }}
      >
        {/* Expand toggle */}
        <span
          className="flex-shrink-0 opacity-60"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded((ex) => !ex);
          }}
          style={{
            cursor: hasChildren ? "pointer" : "default",
            color: "var(--es-text-muted)",
          }}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown size={11} />
            ) : (
              <ChevronRight size={11} />
            )
          ) : (
            <span style={{ width: 11, display: "inline-block" }} />
          )}
        </span>

        {/* Icon */}
        <Box
          size={11}
          style={{
            flexShrink: 0,
            color: isSelected ? "var(--es-accent)" : "var(--es-text-muted)",
          }}
        />

        {/* Name */}
        <span className="flex-1 text-xs truncate text-left ml-1">
          {entity.name}
        </span>

        {/* Active toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleEntityActive(entity.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
          style={{ color: "var(--es-text-muted)" }}
          title={entity.active ? "Hide" : "Show"}
        >
          {entity.active ? <Eye size={11} /> : <EyeOff size={11} />}
        </button>
      </button>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {entity.children.map((child) => (
            <EntityRow
              key={child.id}
              entity={child}
              depth={depth + 1}
              selectedIds={selectedIds}
              onEntityClick={onEntityClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Simple history entry type for the scene
interface SceneHistEntry {
  addedIds: string[];
}

function flattenEntities(entities: EntityItem[]): EntityItem[] {
  const result: EntityItem[] = [];
  function walk(ents: EntityItem[]): void {
    for (const e of ents) {
      result.push(e);
      walk(e.children);
    }
  }
  walk(entities);
  return result;
}

export function SceneInspector(): React.ReactElement {
  const entities = useIDEStore((s) => s.entities);
  const addEntity = useIDEStore((s) => s.addEntity);
  const deleteEntity = useIDEStore((s) => s.deleteEntity);

  const [filter, setFilter] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = React.useState<string | null>(null);

  // History tracks added entity IDs so we can delete them on undo
  const {
    set: pushHist,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<SceneHistEntry>({ addedIds: [] });

  const handleAddEntity = (): void => {
    const name = `Entity${entities.length + 1}`;
    addEntity(name);
    // Track for undo — find the entity that was just added by name
    // Note: addEntity is synchronous, so entities won't update until next render
    pushHist({ addedIds: [name] });
  };

  // Keyboard undo/redo + Delete
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.size > 0
      ) {
        e.preventDefault();
        selectedIds.forEach((id) => deleteEntity(id));
        setSelectedIds(new Set());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedIds, deleteEntity]);

  const flat = flattenEntities(entities);
  const filtered = filter
    ? flat.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()))
    : entities;

  const handleEntityClick = (e: React.MouseEvent, entity: EntityItem): void => {
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(entity.id)) next.delete(entity.id);
        else next.add(entity.id);
        return next;
      });
    } else if (e.shiftKey && lastClickedId !== null) {
      const allFlat = flattenEntities(entities);
      const fromIdx = allFlat.findIndex((x) => x.id === lastClickedId);
      const toIdx = allFlat.findIndex((x) => x.id === entity.id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const lo = Math.min(fromIdx, toIdx);
        const hi = Math.max(fromIdx, toIdx);
        const range = new Set(allFlat.slice(lo, hi + 1).map((x) => x.id));
        setSelectedIds(range);
      }
    } else {
      setSelectedIds(new Set([entity.id]));
    }
    setLastClickedId(entity.id);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{ height: 32, borderBottom: "1px solid var(--es-border)" }}
      >
        <span
          className="text-xs font-medium"
          style={{ color: "var(--es-text)" }}
        >
          Scene
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              padding: "2px 5px",
              background: "none",
              border: "none",
              color: "var(--es-text)",
              cursor: canUndo ? "pointer" : "default",
              opacity: canUndo ? 1 : 0.4,
              fontSize: 13,
            }}
          >
            ↩
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            style={{
              padding: "2px 5px",
              background: "none",
              border: "none",
              color: "var(--es-text)",
              cursor: canRedo ? "pointer" : "default",
              opacity: canRedo ? 1 : 0.4,
              fontSize: 13,
            }}
          >
            ↪
          </button>
          <Badge variant="default">{entities.length} entities</Badge>
          <Button
            variant="ghost"
            size="icon"
            title="Add Entity"
            onClick={handleAddEntity}
          >
            <Plus size={13} />
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div
        style={{
          padding: "4px 8px",
          borderBottom: "1px solid var(--es-border)",
          flexShrink: 0,
        }}
      >
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter entities…"
          style={{
            width: "100%",
            padding: "2px 6px",
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            fontSize: 11,
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto py-1">
        {(filter ? (filtered as EntityItem[]) : entities).map((entity) => (
          <EntityRow
            key={entity.id}
            entity={entity}
            selectedIds={selectedIds}
            onEntityClick={handleEntityClick}
          />
        ))}
      </div>
    </div>
  );
}
