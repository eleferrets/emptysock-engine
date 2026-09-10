import React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useHistory } from "../../hooks/useHistory";

// Derived from @emptysock/engine public component exports (packages/engine/src/index.ts)
const AVAILABLE_COMPONENTS = [
  "Transform",
  "Sprite",
  "PhysicsBody",
  "CharacterController",
  "Animator",
  "UIComponent",
  "RigidJoint",
];

function ComponentSection({
  entityId,
  component,
  onRemove,
}: {
  entityId: string;
  component: {
    type: string;
    enabled: boolean;
    properties: Record<string, string>;
  };
  onRemove: (entityId: string, type: string) => void;
}): React.ReactElement {
  const [open, setOpen] = React.useState(true);

  const componentColor: Record<string, string> = {
    Transform: "var(--es-blue)",
    Sprite: "var(--es-green)",
    PhysicsBody: "var(--es-yellow)",
    CharacterController: "var(--es-accent)",
    Animator: "var(--es-red)",
    CameraSystem: "var(--es-blue)",
  };

  const color = componentColor[component.type] ?? "var(--es-text-muted)";

  return (
    <div
      style={{
        border: "1px solid var(--es-border)",
        background: "var(--es-surface)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {/* Use div+role instead of button so the trash button inside is valid HTML */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 10px",
          background: "var(--es-surface-2)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            flexShrink: 0,
            background: color,
          }}
        />
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 500,
            color: "var(--es-text)",
          }}
        >
          {component.type}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(entityId, component.type);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--es-text-muted)",
            padding: 2,
            borderRadius: 2,
            minHeight: "unset",
            minWidth: "unset",
            width: 16,
            height: 16,
          }}
          title={`Remove ${component.type}`}
        >
          <Trash2 size={10} />
        </button>
        <span
          style={{
            color: "var(--es-text-muted)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </div>

      {open && (
        <div
          style={{
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {Object.entries(component.properties).map(([key, value]) => (
            <Input
              key={key}
              label={key}
              defaultValue={value}
              style={{ width: "100%" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EntityHistSnapshot {
  transform: Record<string, string>;
  componentTypes: string[];
}

export function EntityProperties(): React.ReactElement {
  const selectedEntity = useIDEStore((s) => s.selectedEntity);
  const liveEntities = useIDEStore((s) => s.liveEntities);
  const updateEntityTransform = useIDEStore((s) => s.updateEntityTransform);

  // Prefer live component list from running engine when available
  const liveSnap =
    selectedEntity !== null
      ? liveEntities.find((e) => e.id === selectedEntity.id)
      : undefined;
  const deleteEntity = useIDEStore((s) => s.deleteEntity);
  const addComponentToEntity = useIDEStore((s) => s.addComponentToEntity);
  const removeComponentFromEntity = useIDEStore(
    (s) => s.removeComponentFromEntity,
  );
  const [showAddMenu, setShowAddMenu] = React.useState(false);

  const entityId = selectedEntity?.id ?? null;

  const makeSnapshot = (): EntityHistSnapshot => ({
    transform: selectedEntity ? { ...selectedEntity.transform } : {},
    componentTypes: selectedEntity
      ? selectedEntity.components.map((c) => c.type)
      : [],
  });

  const {
    set: setSnap,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<EntityHistSnapshot>(makeSnapshot());

  // Reset history when the selected entity changes
  const prevEntityIdRef = React.useRef<string | null>(entityId);
  React.useEffect(() => {
    if (entityId !== prevEntityIdRef.current) {
      prevEntityIdRef.current = entityId;
    }
  }, [entityId]);

  // Keyboard undo/redo
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const commitTransform = (id: string, patch: Record<string, string>): void => {
    setSnap(makeSnapshot());
    updateEntityTransform(id, patch);
  };

  const commitAddComponent = (id: string, type: string): void => {
    setSnap(makeSnapshot());
    addComponentToEntity(id, type);
  };

  const commitRemoveComponent = (id: string, type: string): void => {
    setSnap(makeSnapshot());
    removeComponentFromEntity(id, type);
  };

  if (selectedEntity === null) {
    return (
      <aside
        className="flex items-center justify-center"
        style={{
          width: 280,
          flexShrink: 0,
          borderLeft: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          color: "var(--es-text-muted)",
          fontSize: 12,
        }}
      >
        Select an entity
      </aside>
    );
  }

  // Use live component list from engine when available; fall back to editor state
  const existingComponentTypes =
    liveSnap !== undefined
      ? liveSnap.components
      : selectedEntity.components.map((c) => c.type);
  const addableComponents = AVAILABLE_COMPONENTS.filter(
    (c) => !existingComponentTypes.includes(c),
  );

  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        borderLeft: "1px solid var(--es-border)",
        background: "var(--es-surface)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 36,
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface-2)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: "var(--es-text)" }}
          >
            {selectedEntity.name}
          </span>
          <Badge variant="default">{selectedEntity.type}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            style={{
              padding: "2px 6px",
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
              padding: "2px 6px",
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
          <Button
            variant="ghost"
            size="icon"
            title="Delete entity"
            onClick={() => deleteEntity(selectedEntity.id)}
          >
            <Trash2 size={11} style={{ color: "var(--es-red)" }} />
          </Button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {/* Transform section (always first) */}
        <div
          className="rounded p-3 flex flex-col gap-2"
          style={{
            border: "1px solid var(--es-border)",
            background: "var(--es-surface)",
          }}
        >
          <div
            className="flex items-center gap-2 mb-1"
            style={{
              borderBottom: "1px solid var(--es-border)",
              paddingBottom: 6,
            }}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--es-blue)" }}
            />
            <span
              className="text-xs font-medium"
              style={{ color: "var(--es-text)" }}
            >
              Transform
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="X"
              value={selectedEntity.transform.x}
              onChange={(e) =>
                commitTransform(selectedEntity.id, { x: e.target.value })
              }
            />
            <Input
              label="Y"
              value={selectedEntity.transform.y}
              onChange={(e) =>
                commitTransform(selectedEntity.id, { y: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Scale X"
              value={selectedEntity.transform.scaleX}
              onChange={(e) =>
                commitTransform(selectedEntity.id, {
                  scaleX: e.target.value,
                })
              }
            />
            <Input
              label="Scale Y"
              value={selectedEntity.transform.scaleY}
              onChange={(e) =>
                commitTransform(selectedEntity.id, {
                  scaleY: e.target.value,
                })
              }
            />
          </div>
          <Input
            label="Rotation"
            value={selectedEntity.transform.rotation}
            onChange={(e) =>
              commitTransform(selectedEntity.id, {
                rotation: e.target.value,
              })
            }
          />
        </div>

        {/* Other components */}
        {selectedEntity.components
          .filter((c) => c.type !== "Transform")
          .map((component) => (
            <ComponentSection
              key={component.type}
              entityId={selectedEntity.id}
              component={component}
              onRemove={commitRemoveComponent}
            />
          ))}

        {/* Add component */}
        <div style={{ position: "relative" }}>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-1"
            onClick={() => setShowAddMenu((v) => !v)}
          >
            <Plus size={11} />
            Add Component
          </Button>
          {showAddMenu && addableComponents.length > 0 && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: 0,
                right: 0,
                background: "var(--es-surface)",
                border: "1px solid var(--es-border)",
                borderRadius: 6,
                zIndex: 100,
                overflow: "hidden",
                marginBottom: 4,
              }}
            >
              {addableComponents.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    commitAddComponent(selectedEntity.id, c);
                    setShowAddMenu(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 12px",
                    fontSize: 12,
                    color: "var(--es-text)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--es-surface-2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "none";
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
