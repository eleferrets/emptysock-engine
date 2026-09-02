import React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";

const AVAILABLE_COMPONENTS = [
  "Sprite",
  "PhysicsBody",
  "CharacterController",
  "Animator",
  "CameraSystem",
  "AudioSource",
  "Script",
];

function ComponentSection({
  entityId,
  component,
}: {
  entityId: string;
  component: {
    type: string;
    enabled: boolean;
    properties: Record<string, string>;
  };
}): React.ReactElement {
  const removeComponentFromEntity = useIDEStore(
    (s) => s.removeComponentFromEntity,
  );
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
      className="rounded overflow-hidden"
      style={{
        border: "1px solid var(--es-border)",
        background: "var(--es-surface)",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center w-full gap-2 px-3 py-2 text-left transition-colors"
        style={{ background: "var(--es-surface-2)" }}
      >
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: color }}
        />
        <span
          className="flex-1 text-xs font-medium"
          style={{ color: "var(--es-text)" }}
        >
          {component.type}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            removeComponentFromEntity(entityId, component.type);
          }}
          style={{ color: "var(--es-text-muted)", display: "flex", padding: 2 }}
          title={`Remove ${component.type}`}
        >
          <Trash2 size={10} />
        </button>
        <span style={{ color: "var(--es-text-muted)" }}>
          {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>

      {open && (
        <div className="px-3 py-2 flex flex-col gap-2">
          {Object.entries(component.properties).map(([key, value]) => (
            <Input
              key={key}
              label={key}
              defaultValue={value}
              className="w-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function EntityProperties(): React.ReactElement {
  const selectedEntity = useIDEStore((s) => s.selectedEntity);
  const updateEntityTransform = useIDEStore((s) => s.updateEntityTransform);
  const deleteEntity = useIDEStore((s) => s.deleteEntity);
  const addComponentToEntity = useIDEStore((s) => s.addComponentToEntity);
  const [showAddMenu, setShowAddMenu] = React.useState(false);

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

  const existingComponentTypes = selectedEntity.components.map((c) => c.type);
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
        <Button
          variant="ghost"
          size="icon"
          title="Delete entity"
          onClick={() => deleteEntity(selectedEntity.id)}
        >
          <Trash2 size={11} style={{ color: "var(--es-red)" }} />
        </Button>
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
                updateEntityTransform(selectedEntity.id, { x: e.target.value })
              }
            />
            <Input
              label="Y"
              value={selectedEntity.transform.y}
              onChange={(e) =>
                updateEntityTransform(selectedEntity.id, { y: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Scale X"
              value={selectedEntity.transform.scaleX}
              onChange={(e) =>
                updateEntityTransform(selectedEntity.id, {
                  scaleX: e.target.value,
                })
              }
            />
            <Input
              label="Scale Y"
              value={selectedEntity.transform.scaleY}
              onChange={(e) =>
                updateEntityTransform(selectedEntity.id, {
                  scaleY: e.target.value,
                })
              }
            />
          </div>
          <Input
            label="Rotation"
            value={selectedEntity.transform.rotation}
            onChange={(e) =>
              updateEntityTransform(selectedEntity.id, {
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
                    addComponentToEntity(selectedEntity.id, c);
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
