import React from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useHistory } from "../../hooks/useHistory";
import { COMPONENT_REGISTRY } from "@emptysock/engine";
import {
  Transform as V2Transform,
  Sprite as V2Sprite,
  PhysicsBody as V2PhysicsBody,
} from "@emptysock/engine/ecs";
import type {
  ComponentSchema,
  SerializableRecord,
} from "@emptysock/engine/ecs";
import { engineChannel } from "../../services/EngineChannel";

/**
 * ENGINE_DESIGN.md §10.1: "co-located optional schema, not decorators" —
 * `defineComponent`'s optional `.schema` describes each field's inspector
 * control. `ComponentDef` itself has no inspector-color field (that would
 * touch `packages/engine/src/ecs/Component.ts`, which is out of scope for
 * this pass), so schema and color are kept as ONE co-located metadata map
 * here instead of two separate hand-maintained `Record`s — every
 * schema-bearing component gets a single `V2_COMPONENT_METADATA` entry
 * covering both, rather than needing this file edited in two places. This
 * maps a component's `componentName` (the same string key
 * `component.type` already uses in editor state — see CLAUDE.md's
 * "Component types as identity keys") to its schema+color so
 * `ComponentSection` can look one up by name without importing every
 * component module individually. A component with no entry here (or no
 * `.schema` on its def) falls back to the raw per-field editor and the
 * default muted color below — that's the intended, non-error path for
 * schema-less components.
 */
interface ComponentInspectorMeta {
  readonly schema?: ComponentSchema<SerializableRecord>;
  readonly color: string;
}

const V2_COMPONENT_METADATA: Readonly<Record<string, ComponentInspectorMeta>> =
  {
    [V2Transform.componentName]: {
      ...(V2Transform.schema !== undefined
        ? { schema: V2Transform.schema }
        : {}),
      color: "var(--es-blue)",
    },
    [V2Sprite.componentName]: {
      ...(V2Sprite.schema !== undefined ? { schema: V2Sprite.schema } : {}),
      color: "var(--es-green)",
    },
    [V2PhysicsBody.componentName]: {
      ...(V2PhysicsBody.schema !== undefined
        ? { schema: V2PhysicsBody.schema }
        : {}),
      color: "var(--es-yellow)",
    },
    // Older, singleton-style components with no schema yet still get an inspector color.
    CharacterController: { color: "var(--es-accent)" },
    Animator: { color: "var(--es-red)" },
    CameraSystem: { color: "var(--es-blue)" },
  };

function SchemaFieldControl({
  fieldKey,
  fieldSchema,
  rawValue,
  onCommit,
}: {
  fieldKey: string;
  fieldSchema: NonNullable<ComponentSchema<SerializableRecord>[string]>;
  rawValue: unknown;
  onCommit: (newValue: unknown) => void;
}): React.ReactElement | null {
  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--es-text-muted)",
    fontWeight: 500,
  };
  const controlStyle: React.CSSProperties = {
    width: "100%",
    background: "var(--es-bg)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    color: "var(--es-text)",
    fontSize: 11,
    padding: "3px 6px",
    boxSizing: "border-box",
  };

  if (fieldSchema.kind === "number") {
    const numValue =
      typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
    return (
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>{fieldKey}</label>
        <input
          type="number"
          value={Number.isNaN(numValue) ? 0 : numValue}
          onChange={(e) => onCommit(Number(e.target.value))}
          style={{ ...controlStyle, fontFamily: "monospace" }}
        />
      </div>
    );
  }

  if (fieldSchema.kind === "boolean") {
    const boolValue =
      typeof rawValue === "boolean" ? rawValue : rawValue === "true";
    return (
      <label
        className="flex items-center gap-2"
        style={{ fontSize: 11, color: "var(--es-text)" }}
      >
        <input
          type="checkbox"
          checked={boolValue}
          onChange={(e) => onCommit(e.target.checked)}
        />
        <span style={labelStyle}>{fieldKey}</span>
      </label>
    );
  }

  if (fieldSchema.kind === "enum") {
    // Conditional UI: a <select> with no options must not render at all —
    // it would show as a broken/empty picker.
    if (fieldSchema.options.length === 0) return null;
    const strValue = typeof rawValue === "string" ? rawValue : "";
    return (
      <div className="flex flex-col gap-1">
        <label style={labelStyle}>{fieldKey}</label>
        <select
          value={strValue}
          onChange={(e) => onCommit(e.target.value)}
          style={controlStyle}
        >
          {fieldSchema.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    );
  }

  // "string"
  const strValue =
    typeof rawValue === "string" ? rawValue : String(rawValue ?? "");
  return (
    <Input
      label={fieldKey}
      defaultValue={strValue}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onCommit(e.target.value)
      }
      style={{ width: "100%" }}
    />
  );
}

function ComponentSection({
  entityId,
  component,
  liveFields,
  onRemove,
  onPatch,
}: {
  entityId: string;
  component: {
    type: string;
    enabled: boolean;
    properties: Record<string, string>;
  };
  liveFields?: Record<string, unknown>;
  onRemove: (entityId: string, type: string) => void;
  onPatch?: (fieldKey: string, newValue: unknown) => void;
}): React.ReactElement {
  const meta = V2_COMPONENT_METADATA[component.type];
  const schema = meta?.schema;
  const [open, setOpen] = React.useState(true);

  const color = meta?.color ?? "var(--es-text-muted)";

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
          {Object.entries(component.properties).map(([key, value]) => {
            const liveVal = liveFields?.[key];
            const fieldSchema = schema?.[key];

            // Schema-driven path: a real typed control bound to the live
            // (or last-known) value for this field.
            if (fieldSchema !== undefined) {
              const rawValue = liveVal !== undefined ? liveVal : value;
              return (
                <SchemaFieldControl
                  key={key}
                  fieldKey={key}
                  fieldSchema={fieldSchema}
                  rawValue={rawValue}
                  onCommit={(newValue) => onPatch?.(key, newValue)}
                />
              );
            }

            // No schema for this field (or this component) — fall back to
            // the raw string editor, unchanged.
            const displayValue =
              liveVal !== undefined ? String(liveVal) : value;
            return (
              <Input
                key={`${key}-${displayValue}`}
                label={key}
                defaultValue={displayValue}
                onChange={
                  onPatch !== undefined
                    ? (e: React.ChangeEvent<HTMLInputElement>) =>
                        onPatch(key, e.target.value)
                    : undefined
                }
                style={{ width: "100%" }}
              />
            );
          })}
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
  const liveComponentFields = useIDEStore((s) => s.liveComponentFields);
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

  const handlePatch = (
    componentType: string,
    fieldKey: string,
    newValue: unknown,
  ): void => {
    if (entityId === null) return;
    // Property edits mutate editor-visible entity data, so they go through
    // the same history stack as transform/add/remove-component edits
    // (CLAUDE.md: "Undo/redo is mandatory in every panel that mutates
    // editor data").
    setSnap(makeSnapshot());
    engineChannel.postToEngine({
      type: "es:set-component",
      id: entityId,
      component: componentType,
      patch: { [fieldKey]: newValue },
    });
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
  const addableComponents = COMPONENT_REGISTRY.filter(
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
              {...(liveComponentFields?.[component.type] !== undefined
                ? { liveFields: liveComponentFields[component.type] }
                : {})}
              onRemove={commitRemoveComponent}
              onPatch={(fieldKey, newValue) =>
                handlePatch(component.type, fieldKey, newValue)
              }
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
