import React from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Hash,
  ToggleLeft,
  Type as TypeIcon,
  List,
  Palette,
  Link as LinkIcon,
  Move,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import type { EntityItem } from "../../store/ideStore";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { useHistory } from "../../hooks/useHistory";
import {
  COMPONENT_REGISTRY,
  Transform as V2Transform,
  Sprite as V2Sprite,
  PhysicsBody as V2PhysicsBody,
} from "@emptysock/engine";
import type { ComponentSchema, SerializableRecord } from "@emptysock/engine";
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

/**
 * Feature: per-field icons in the Inspector. Maps a field's schema kind
 * (plus a small set of name-based semantic heuristics — "x"/"position",
 * "color", "src"/"texture"/"asset") to a `lucide-react` icon. This only
 * ever runs for fields that already resolved a schema entry — a field
 * with no schema keeps the exact pre-existing plain-`Input` fallback
 * (CLAUDE.md's "component not in the map / field not in that component's
 * schema" rule), so an unmapped field never renders a blank or broken
 * icon slot, it just renders the way it always has.
 */
function iconForField(
  fieldKey: string,
  fieldSchema: NonNullable<ComponentSchema<SerializableRecord>[string]>,
): LucideIcon {
  const key = fieldKey.toLowerCase();
  if (/(^|[_-])(x|y|z)$|position|scale|rotation|offset|velocity/.test(key)) {
    return Move;
  }
  if (/colou?r/.test(key)) return Palette;
  if (/src|path|texture|sprite|asset|sound|audio|icon|file/.test(key)) {
    return LinkIcon;
  }
  switch (fieldSchema.kind) {
    case "boolean":
      return ToggleLeft;
    case "enum":
      return List;
    case "number":
      return Hash;
    case "string":
    default:
      return TypeIcon;
  }
}

function FieldIcon({
  fieldKey,
  fieldSchema,
}: {
  fieldKey: string;
  fieldSchema: NonNullable<ComponentSchema<SerializableRecord>[string]>;
}): React.ReactElement {
  const Icon = iconForField(fieldKey, fieldSchema);
  return (
    <Icon
      size={10}
      style={{ color: "var(--es-text-muted)", flexShrink: 0 }}
      aria-hidden="true"
    />
  );
}

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
        <label style={labelStyle} className="flex items-center gap-1">
          <FieldIcon fieldKey={fieldKey} fieldSchema={fieldSchema} />
          {fieldKey}
        </label>
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
        <span style={labelStyle} className="flex items-center gap-1">
          <FieldIcon fieldKey={fieldKey} fieldSchema={fieldSchema} />
          {fieldKey}
        </span>
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
        <label style={labelStyle} className="flex items-center gap-1">
          <FieldIcon fieldKey={fieldKey} fieldSchema={fieldSchema} />
          {fieldKey}
        </label>
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

/**
 * Multi-select v1 (see CLAUDE.md task notes): viewing works fully for any
 * number of selected entities; edits apply to every selected entity that
 * has the component being edited. A field whose current value differs
 * across the selection shows the "Mixed" placeholder (the Unity-inspector
 * pattern) rather than an arbitrary one of the values, and committing a
 * new value there overwrites it for every selected entity uniformly. This
 * is deliberately not a full per-entity diffing engine — that's out of
 * proportion for the realistic selection sizes (tens) this panel expects.
 */
function MultiEntityProperties({ ids }: { ids: string[] }): React.ReactElement {
  const entities = useIDEStore((s) => s.entities);
  const liveEntities = useIDEStore((s) => s.liveEntities);
  const deleteEntity = useIDEStore((s) => s.deleteEntity);

  // Reuse whichever entity list SceneInspector is currently showing (live
  // engine data when available, editor state otherwise) so multi-select
  // reflects the exact same entities the list on the left shows.
  const pool: EntityItem[] =
    liveEntities.length > 0
      ? liveEntities.map((s) => ({
          id: s.id,
          name: s.name,
          active: s.active,
          type: "Entity",
          components: s.components,
          children: [],
        }))
      : (function flatten(items: EntityItem[]): EntityItem[] {
          const out: EntityItem[] = [];
          const walk = (list: EntityItem[]): void => {
            for (const e of list) {
              out.push(e);
              walk(e.children);
            }
          };
          walk(items);
          return out;
        })(entities);

  const selected = pool.filter((e) => ids.includes(e.id));

  // Per-entity live field values, fetched on demand — editor-state entities
  // carry only a bare component-type-name list (no field values), so a
  // multi-select's shared-field view has to ask the live bridge directly,
  // the same `getComponent` query ComponentSection's live path already
  // reads from. Keyed `${entityId}:${componentType}`.
  const [liveByEntity, setLiveByEntity] = React.useState<
    Record<string, Record<string, unknown>>
  >({});
  const idsKey = ids.slice().sort().join(",");
  React.useEffect(() => {
    let cancelled = false;
    const sharedTypes = new Set<string>();
    for (const e of selected) {
      for (const t of e.components) {
        if (V2_COMPONENT_METADATA[t]?.schema !== undefined) sharedTypes.add(t);
      }
    }
    for (const e of selected) {
      const numericId = Number(e.id);
      if (!Number.isFinite(numericId)) continue;
      for (const type of sharedTypes) {
        void engineChannel
          .query<Record<string, unknown>>({
            kind: "getComponent",
            entityId: numericId,
            component: type,
          })
          .then((result) => {
            if (cancelled) return;
            if (result.ok) {
              setLiveByEntity((prev) => ({
                ...prev,
                [`${e.id}:${type}`]: result.data,
              }));
            }
          })
          .catch(() => undefined);
      }
    }
    return () => {
      cancelled = true;
    };
    // idsKey (a sorted, joined snapshot of `ids`) is the intentional dep —
    // `selected` is derived from it plus store state every render, so
    // depending on `selected` itself would re-fire this on every render.
  }, [idsKey]);

  if (selected.length === 0) {
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
        Selection is stale — nothing here matches anymore.
      </aside>
    );
  }

  // Component-type -> how many of the selected entities have it.
  const typeCounts = new Map<string, number>();
  for (const e of selected) {
    for (const t of e.components)
      typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const allTypes = Array.from(typeCounts.keys()).sort();

  const commitToAll = (
    componentType: string,
    fieldKey: string,
    value: unknown,
  ): void => {
    for (const e of selected) {
      const numericId = Number(e.id);
      if (Number.isFinite(numericId)) {
        void engineChannel.query({
          kind: "setComponent",
          entityId: numericId,
          component: componentType,
          patch: { [fieldKey]: value },
        });
      }
    }
  };

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
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 36,
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface-2)",
        }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--es-text)" }}
        >
          {selected.length} entities selected
        </span>
        <Button
          variant="ghost"
          size="icon"
          title="Delete selected"
          onClick={() => selected.forEach((e) => deleteEntity(e.id))}
        >
          <Trash2 size={11} style={{ color: "var(--es-red)" }} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {allTypes.length === 0 && (
          <p style={{ fontSize: 11, color: "var(--es-text-muted)" }}>
            None of the selected entities carry any components yet.
          </p>
        )}
        {allTypes.map((type) => {
          const meta = V2_COMPONENT_METADATA[type];
          const schema = meta?.schema;
          const count = typeCounts.get(type) ?? 0;
          const shared = count === selected.length;

          // Collect every value seen for each schema field across entities
          // that actually have this component, so a field can be reported
          // as "mixed" when it differs. Values come from the live bridge
          // fetch above — an entity whose fetch hasn't resolved yet (or
          // isn't live-connected at all) simply contributes no value,
          // which reads as "mixed" once any other entity has one.
          const fieldValues: Record<string, Set<string>> = {};
          if (schema) {
            for (const e of selected) {
              const props = liveByEntity[`${e.id}:${type}`];
              if (props === undefined) continue;
              for (const key of Object.keys(schema)) {
                (fieldValues[key] ??= new Set()).add(String(props[key] ?? ""));
              }
            }
          }

          return (
            <div
              key={type}
              style={{
                border: "1px solid var(--es-border)",
                background: "var(--es-surface)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  background: "var(--es-surface-2)",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: meta?.color ?? "var(--es-text-muted)",
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
                  {type}
                </span>
                <span style={{ fontSize: 10, color: "var(--es-text-muted)" }}>
                  {shared ? "shared" : `${count}/${selected.length}`}
                </span>
              </div>
              {schema && shared && (
                <div
                  style={{
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {Object.entries(schema).map(([key, fieldSchema]) => {
                    if (fieldSchema === undefined) return null;
                    const values = fieldValues[key];
                    const isMixed = values !== undefined && values.size > 1;
                    if (isMixed) {
                      // Mixed values across the selection: show the
                      // placeholder rather than an arbitrary member's
                      // value, and let a fresh entry overwrite all of them.
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <label
                            className="flex items-center gap-1"
                            style={{
                              fontSize: 10,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                              color: "var(--es-text-muted)",
                              fontWeight: 500,
                            }}
                          >
                            <FieldIcon
                              fieldKey={key}
                              fieldSchema={fieldSchema}
                            />
                            {key}
                          </label>
                          <Input
                            placeholder="Mixed — type to set for all"
                            defaultValue=""
                            onChange={(
                              e: React.ChangeEvent<HTMLInputElement>,
                            ) =>
                              commitToAll(
                                type,
                                key,
                                fieldSchema.kind === "number"
                                  ? Number(e.target.value)
                                  : fieldSchema.kind === "boolean"
                                    ? e.target.value === "true"
                                    : e.target.value,
                              )
                            }
                            style={{ width: "100%" }}
                          />
                        </div>
                      );
                    }
                    const single =
                      values !== undefined ? Array.from(values)[0] : "";
                    return (
                      <SchemaFieldControl
                        key={key}
                        fieldKey={key}
                        fieldSchema={fieldSchema}
                        rawValue={single}
                        onCommit={(newValue) =>
                          commitToAll(type, key, newValue)
                        }
                      />
                    );
                  })}
                </div>
              )}
              {(!schema || !shared) && (
                <p
                  style={{
                    margin: 0,
                    padding: "6px 10px",
                    fontSize: 10,
                    color: "var(--es-text-muted)",
                  }}
                >
                  {shared
                    ? "No editable fields for this component yet."
                    : `Only ${count} of ${selected.length} selected have this — editing here would apply to all of them.`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

interface EntityHistSnapshot {
  transform: Record<string, string>;
  componentTypes: string[];
}

export function EntityProperties(): React.ReactElement {
  const selectedEntity = useIDEStore((s) => s.selectedEntity);
  const selectedEntityIds = useIDEStore((s) => s.selectedEntityIds);
  const liveEntities = useIDEStore((s) => s.liveEntities);
  const liveComponentFields = useIDEStore((s) => s.liveComponentFields);
  const updateEntityTransform = useIDEStore((s) => s.updateEntityTransform);

  if (selectedEntityIds.length > 1) {
    return <MultiEntityProperties ids={selectedEntityIds} />;
  }

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
    const numericId = Number(entityId);
    if (Number.isFinite(numericId)) {
      void engineChannel.query({
        kind: "setComponent",
        entityId: numericId,
        component: componentType,
        patch: { [fieldKey]: newValue },
      });
    }
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
