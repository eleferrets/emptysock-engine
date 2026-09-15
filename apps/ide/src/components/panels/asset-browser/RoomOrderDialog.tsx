import React, { useState, useRef } from "react";
import ReactDOM from "react-dom";
import { List, X, GripVertical, FileCode } from "lucide-react";
import type { AssetItem } from "../../../store/ideStore";
import { Button } from "../../ui/Button";

export interface RoomOrderDialogProps {
  scenes: AssetItem[];
  savedOrder: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
}

export function RoomOrderDialog({
  scenes,
  savedOrder,
  onApply,
  onClose,
}: RoomOrderDialogProps): React.ReactElement {
  const [order, setOrder] = useState<AssetItem[]>(() => {
    if (savedOrder.length === 0) return scenes;
    const byId = new Map(scenes.map((s) => [s.id, s]));
    const sorted: AssetItem[] = [];
    for (const id of savedOrder) {
      const item = byId.get(id);
      if (item) sorted.push(item);
    }
    for (const s of scenes) {
      if (!sorted.find((x) => x.id === s.id)) sorted.push(s);
    }
    return sorted;
  });

  const dragIdx = useRef<number | null>(null);

  const handleDragStart = (i: number): void => {
    dragIdx.current = i;
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    i: number,
  ): void => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === i) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return;
    next.splice(i, 0, moved);
    dragIdx.current = i;
    setOrder(next);
  };

  const handleDragEnd = (): void => {
    dragIdx.current = null;
  };

  const apply = (): void => {
    onApply(order.map((s) => s.id));
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--es-surface)",
          border: "1px solid var(--es-border)",
          borderRadius: 10,
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--es-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <List size={14} style={{ color: "var(--es-accent)" }} />
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--es-text)" }}
            >
              Room Order
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--es-text-muted)",
              display: "flex",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {order.length === 0 ? (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--es-text-muted)",
                fontSize: 11,
                fontStyle: "italic",
              }}
            >
              No scene assets yet. Add a .scene file to the asset browser first.
            </div>
          ) : (
            order.map((scene, i) => (
              <div
                key={scene.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 16px",
                  cursor: "grab",
                  userSelect: "none",
                  borderBottom: "1px solid var(--es-border)",
                  background: "var(--es-surface)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "var(--es-surface-raised, var(--es-surface-2))";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "var(--es-surface)";
                }}
              >
                <GripVertical
                  size={14}
                  style={{ color: "var(--es-text-muted)", flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--es-text-muted)",
                    width: 18,
                    flexShrink: 0,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {i + 1}
                </span>
                <FileCode
                  size={14}
                  style={{ color: "var(--es-blue)", flexShrink: 0 }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    color: "var(--es-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {scene.name}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "10px 16px",
            borderTop: "1px solid var(--es-border)",
            flexShrink: 0,
          }}
        >
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" size="sm" onClick={apply}>
            <List size={11} />
            Apply Order
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
