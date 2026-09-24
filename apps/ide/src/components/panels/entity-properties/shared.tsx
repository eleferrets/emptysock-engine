import React from "react";
import {
  Hash,
  ToggleLeft,
  Type as TypeIcon,
  List,
  Palette,
  Link as LinkIcon,
  Move,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Input } from "../../ui/Input";
import {
  Transform as V2Transform,
  Sprite as V2Sprite,
  PhysicsBody as V2PhysicsBody,
} from "@emptysock/engine";
import type { ComponentSchema, SerializableRecord } from "@emptysock/engine";

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
 *
 * Shared by `EntityProperties.tsx` (single-select) and
 * `MultiEntityProperties.tsx` (multi-select) — both need the exact same
 * schema/color/icon lookup for a component type, so it lives here rather
 * than in either panel file.
 */
export interface ComponentInspectorMeta {
  readonly schema?: ComponentSchema<SerializableRecord>;
  readonly color: string;
}

export const V2_COMPONENT_METADATA: Readonly<
  Record<string, ComponentInspectorMeta>
> = {
  [V2Transform.componentName]: {
    ...(V2Transform.schema !== undefined ? { schema: V2Transform.schema } : {}),
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
export function iconForField(
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

export function FieldIcon({
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

export function SchemaFieldControl({
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

/**
 * The colored-dot + name (+ optional trailing badge/action) row that both
 * `ComponentSection` (single-select) and `MultiEntityProperties`' per-type
 * card (multi-select) render for a component. Before this extraction the
 * two panels hand-duplicated the same dot/name/background markup — a
 * genuine "two adapters for one seam" case (CLAUDE.md's deepening
 * principle): one real header shape, two copies to keep in sync. `trailing`
 * covers what differs — the single-select header adds a remove button and
 * expand/collapse chevron; the multi-select header adds a shared/count
 * badge — everything else (dot color, name, row chrome) is identical.
 */
export function ComponentHeaderRow({
  color,
  name,
  trailing,
  onClick,
}: {
  color: string;
  name: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
}): React.ReactElement {
  return (
    <div
      {...(onClick !== undefined
        ? {
            role: "button",
            tabIndex: 0,
            onClick,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") onClick();
            },
          }
        : {})}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        background: "var(--es-surface-2)",
        ...(onClick !== undefined
          ? { cursor: "pointer" as const, userSelect: "none" as const }
          : {}),
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
        {name}
      </span>
      {trailing}
    </div>
  );
}
