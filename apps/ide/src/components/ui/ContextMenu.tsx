import React from "react";
import ReactDOM from "react-dom";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactElement;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface ContextMenuSeparator {
  separator: true;
}

export type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

export interface ContextMenuProps {
  items: ContextMenuEntry[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({
  items,
  position,
  onClose,
}: ContextMenuProps): React.ReactElement {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [resolvedPos, setResolvedPos] = React.useState(position);

  React.useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const rect = menu.getBoundingClientRect();
    let x = position.x;
    let y = position.y;
    if (x + rect.width > window.innerWidth) x = x - rect.width;
    if (y + rect.height > window.innerHeight) y = y - rect.height;
    setResolvedPos({ x: Math.max(0, x), y: Math.max(0, y) });
  }, [position.x, position.y]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    const handleMouseDown = (e: MouseEvent): void => {
      if (
        menuRef.current !== null &&
        !menuRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onClose]);

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        left: resolvedPos.x,
        top: resolvedPos.y,
        zIndex: 9999,
        minWidth: 160,
        background: "var(--es-surface)",
        border: "1px solid var(--es-border)",
        borderRadius: 6,
        padding: "3px 0",
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        fontSize: 11,
      }}
    >
      {items.map((entry, i) => {
        if ("separator" in entry) {
          return (
            <hr
              key={i}
              style={{
                margin: "3px 0",
                border: "none",
                borderTop: "1px solid var(--es-border)",
              }}
            />
          );
        }
        const item = entry;
        return (
          <button
            key={i}
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            onMouseEnter={(e) => {
              if (item.disabled !== true) {
                (e.currentTarget as HTMLButtonElement).style.background =
                  "var(--es-surface-2)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "transparent";
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "5px 12px",
              background: "transparent",
              border: "none",
              cursor: item.disabled === true ? "default" : "pointer",
              color:
                item.danger === true ? "var(--es-red)" : "var(--es-text)",
              fontSize: 11,
              textAlign: "left",
              opacity: item.disabled === true ? 0.4 : 1,
            }}
          >
            {item.icon !== undefined && item.icon}
            {item.label}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
