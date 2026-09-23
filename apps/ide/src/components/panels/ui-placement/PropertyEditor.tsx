import React from "react";
import type { PlacedWidget, WidgetType } from "./layout";

type FieldKind = "number" | "text" | "boolean" | "color" | "select";

interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
}

// Field lists mirror each ECS widget-kind component's own fields exactly
// (see packages/engine/src/ecs/components/Widgets.ts). `x`/`y`/`anchor` are
// edited elsewhere in the panel; every other field is authorable here.
const FIELDS: Record<WidgetType, FieldSpec[]> = {
  panel: [
    { key: "width", label: "width", kind: "number" },
    { key: "height", label: "height", kind: "number" },
    { key: "background", label: "background", kind: "color" },
    { key: "borderColor", label: "borderColor", kind: "color" },
    { key: "borderWidth", label: "borderWidth", kind: "number" },
    { key: "borderRadius", label: "borderRadius", kind: "number" },
  ],
  button: [
    { key: "width", label: "width", kind: "number" },
    { key: "height", label: "height", kind: "number" },
    { key: "label", label: "label", kind: "text" },
    { key: "color", label: "color", kind: "color" },
    { key: "background", label: "background", kind: "color" },
    { key: "hoverBackground", label: "hoverBackground", kind: "color" },
    { key: "pressedBackground", label: "pressedBackground", kind: "color" },
    { key: "borderRadius", label: "borderRadius", kind: "number" },
    { key: "fontSize", label: "fontSize", kind: "number" },
    { key: "disabled", label: "disabled", kind: "boolean" },
  ],
  label: [
    { key: "text", label: "text", kind: "text" },
    { key: "fontSize", label: "fontSize", kind: "number" },
    { key: "color", label: "color", kind: "color" },
    {
      key: "align",
      label: "align",
      kind: "select",
      options: ["left", "center", "right"],
    },
  ],
  "progress-bar": [
    { key: "width", label: "width", kind: "number" },
    { key: "height", label: "height", kind: "number" },
    { key: "value", label: "value", kind: "number" },
    { key: "min", label: "min", kind: "number" },
    { key: "max", label: "max", kind: "number" },
    { key: "fillColor", label: "fillColor", kind: "color" },
    { key: "trackColor", label: "trackColor", kind: "color" },
  ],
  slider: [
    { key: "width", label: "width", kind: "number" },
    { key: "height", label: "height", kind: "number" },
    { key: "value", label: "value", kind: "number" },
    { key: "min", label: "min", kind: "number" },
    { key: "max", label: "max", kind: "number" },
    { key: "step", label: "step", kind: "number" },
    { key: "trackColor", label: "trackColor", kind: "color" },
    { key: "thumbColor", label: "thumbColor", kind: "color" },
  ],
  checkbox: [
    { key: "label", label: "label", kind: "text" },
    { key: "checked", label: "checked", kind: "boolean" },
    { key: "color", label: "color", kind: "color" },
    { key: "background", label: "background", kind: "color" },
    { key: "borderColor", label: "borderColor", kind: "color" },
    { key: "fontSize", label: "fontSize", kind: "number" },
  ],
  image: [
    { key: "width", label: "width", kind: "number" },
    { key: "height", label: "height", kind: "number" },
    { key: "src", label: "src", kind: "text" },
  ],
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "2px 4px",
  background: "var(--es-surface)",
  color: "var(--es-text)",
  border: "1px solid var(--es-border)",
  borderRadius: 3,
  fontSize: 11,
};

export function PropertyEditor({
  widget,
  onChange,
}: {
  widget: PlacedWidget;
  onChange: (opts: Record<string, unknown>) => void;
}): React.ReactElement {
  const fields = FIELDS[widget.type];
  const opts = widget.opts as unknown as Record<string, unknown>;

  return (
    <>
      {(["x", "y"] as const).map((field) => (
        <label
          key={field}
          style={{ display: "flex", flexDirection: "column", gap: 1 }}
        >
          <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
            {field}
          </span>
          <input
            type="number"
            value={Number(opts[field] ?? 0)}
            onChange={(e) => onChange({ [field]: Number(e.target.value) })}
            style={inputStyle}
          />
        </label>
      ))}
      {fields.map((f) => {
        const value = opts[f.key];
        if (f.kind === "boolean") {
          return (
            <label
              key={f.key}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange({ [f.key]: e.target.checked })}
              />
              <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                {f.label}
              </span>
            </label>
          );
        }
        if (f.kind === "select") {
          const options = f.options ?? [];
          if (options.length === 0) return null;
          return (
            <label
              key={f.key}
              style={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                {f.label}
              </span>
              <select
                value={String(value ?? options[0])}
                onChange={(e) => onChange({ [f.key]: e.target.value })}
                style={inputStyle}
              >
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        if (f.kind === "color") {
          const str = typeof value === "string" ? value : "";
          const isHex = /^#[0-9a-fA-F]{6}$/.test(str);
          return (
            <label
              key={f.key}
              style={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                {f.label}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <input
                  type="color"
                  value={isHex ? str : "#000000"}
                  onChange={(e) => onChange({ [f.key]: e.target.value })}
                  style={{
                    width: 28,
                    padding: 0,
                    border: "1px solid var(--es-border)",
                    borderRadius: 3,
                  }}
                />
                <input
                  type="text"
                  value={str}
                  placeholder="unset"
                  onChange={(e) =>
                    onChange({
                      [f.key]:
                        e.target.value === "" ? undefined : e.target.value,
                    })
                  }
                  style={inputStyle}
                />
              </div>
            </label>
          );
        }
        if (f.kind === "number") {
          return (
            <label
              key={f.key}
              style={{ display: "flex", flexDirection: "column", gap: 1 }}
            >
              <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
                {f.label}
              </span>
              <input
                type="number"
                value={Number(value ?? 0)}
                onChange={(e) => onChange({ [f.key]: Number(e.target.value) })}
                style={inputStyle}
              />
            </label>
          );
        }
        return (
          <label
            key={f.key}
            style={{ display: "flex", flexDirection: "column", gap: 1 }}
          >
            <span style={{ color: "var(--es-text-muted)", fontSize: 10 }}>
              {f.label}
            </span>
            <input
              type="text"
              value={String(value ?? "")}
              onChange={(e) => onChange({ [f.key]: e.target.value })}
              style={inputStyle}
            />
          </label>
        );
      })}
    </>
  );
}
