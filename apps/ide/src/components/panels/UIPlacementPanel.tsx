import React from "react";
import { useIDEStore } from "../../store/ideStore";

type UIComponentType = "panel" | "button" | "text" | "progress-bar" | "slider" | "toggle";
type UIAnchor =
  | "top-left" | "top-center" | "top-right"
  | "middle-left" | "middle-center" | "middle-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

const COMPONENT_TEMPLATES: Array<{ type: UIComponentType; label: string; defaultCode: (anchor: UIAnchor, x: number, y: number) => string }> = [
  {
    type: "panel",
    label: "Panel",
    defaultCode: (a, x, y) =>
      `const panel = UISystem.create('panel', {\n  x: ${x}, y: ${y}, width: 200, height: 120,\n  anchor: '${a}',\n  style: { backgroundColor: 0x1a1a2e, opacity: 0.9 },\n});`,
  },
  {
    type: "button",
    label: "Button",
    defaultCode: (a, x, y) =>
      `const btn = UISystem.create('button', {\n  x: ${x}, y: ${y}, width: 120, height: 36,\n  text: 'Button',\n  anchor: '${a}',\n  style: { backgroundColor: 0x3c2d6e },\n});\nbtn.setHoverStyle({ backgroundColor: 0x5c4da0 });\nbtn.onClick(() => { /* TODO */ });`,
  },
  {
    type: "text",
    label: "Text",
    defaultCode: (a, x, y) =>
      `const label = UISystem.create('text', {\n  x: ${x}, y: ${y},\n  text: 'Label',\n  anchor: '${a}',\n  style: { color: 0xffffff, fontSize: 16 },\n});`,
  },
  {
    type: "progress-bar",
    label: "Progress Bar",
    defaultCode: (a, x, y) =>
      `const bar = UISystem.create('progress-bar', {\n  x: ${x}, y: ${y}, width: 200, height: 20,\n  anchor: '${a}',\n  style: { backgroundColor: 0x333, color: 0x4ade80 },\n});\nbar.value = 0.75; // 0..1`,
  },
  {
    type: "slider",
    label: "Slider",
    defaultCode: (a, x, y) =>
      `const slider = UISystem.create('slider', {\n  x: ${x}, y: ${y}, width: 160, height: 24,\n  anchor: '${a}',\n  style: { backgroundColor: 0x333, color: 0x60a5fa },\n});\nslider.value = 0.5;`,
  },
  {
    type: "toggle",
    label: "Toggle",
    defaultCode: (a, x, y) =>
      `const toggle = UISystem.create('toggle', {\n  x: ${x}, y: ${y}, width: 40, height: 24,\n  anchor: '${a}',\n  style: { backgroundColor: 0x333, color: 0x4ade80 },\n});\ntoggle.checked = false;`,
  },
];

const ANCHORS: UIAnchor[] = [
  "top-left", "top-center", "top-right",
  "middle-left", "middle-center", "middle-right",
  "bottom-left", "bottom-center", "bottom-right",
];

const ANCHOR_GRID_POS: Record<UIAnchor, { col: number; row: number }> = {
  "top-left":      { col: 0, row: 0 }, "top-center":    { col: 1, row: 0 }, "top-right":     { col: 2, row: 0 },
  "middle-left":   { col: 0, row: 1 }, "middle-center": { col: 1, row: 1 }, "middle-right":  { col: 2, row: 1 },
  "bottom-left":   { col: 0, row: 2 }, "bottom-center": { col: 1, row: 2 }, "bottom-right":  { col: 2, row: 2 },
};

export function UIPlacementPanel(): React.ReactElement {
  const setEditorCode = useIDEStore((s) => s.setEditorCode);
  const editorCode = useIDEStore((s) => s.editorCode);
  const addLog = useIDEStore((s) => s.addLog);

  const [selectedAnchor, setSelectedAnchor] = React.useState<UIAnchor>("bottom-center");
  const [offsetX, setOffsetX] = React.useState(0);
  const [offsetY, setOffsetY] = React.useState(-20);
  const [copied, setCopied] = React.useState<string | null>(null);

  const insertSnippet = (tmpl: typeof COMPONENT_TEMPLATES[0]): void => {
    const code = tmpl.defaultCode(selectedAnchor, offsetX, offsetY);
    const existing = editorCode.trim();
    const insertion = `\n// UISystem component: ${tmpl.label}\n${code}\n`;
    setEditorCode(existing + insertion);
    addLog("info", `Inserted UISystem.create('${tmpl.type}') snippet into editor`);
    setCopied(tmpl.type);
    setTimeout(() => setCopied(null), 1200);
  };

  const copySnippet = (tmpl: typeof COMPONENT_TEMPLATES[0]): void => {
    const code = tmpl.defaultCode(selectedAnchor, offsetX, offsetY);
    navigator.clipboard.writeText(code).catch(() => { /* ignore */ });
    setCopied(tmpl.type + "-copy");
    setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--es-bg)", color: "var(--es-text)", fontSize: 12, overflow: "auto" }}>
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--es-border)", fontWeight: 600, color: "var(--es-text-muted)" }}>
        UI Placement
      </div>

      {/* Anchor picker */}
      <div style={{ padding: "10px 10px 6px" }}>
        <div style={{ marginBottom: 6, color: "var(--es-text-muted)" }}>Anchor</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 28px)", gap: 3, marginBottom: 10 }}>
          {ANCHORS.map((a) => {
            const pos = ANCHOR_GRID_POS[a];
            return (
              <div
                key={a}
                title={a}
                onClick={() => setSelectedAnchor(a)}
                style={{
                  gridColumn: pos.col + 1,
                  gridRow: pos.row + 1,
                  width: 28,
                  height: 28,
                  background: selectedAnchor === a ? "var(--es-accent)" : "var(--es-surface)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                }}
              >
                {a.split("-").map((w) => w[0]?.toUpperCase() ?? "").join("")}
              </div>
            );
          })}
        </div>
        <div style={{ color: "var(--es-text-muted)", marginBottom: 4 }}>Selected: <strong>{selectedAnchor}</strong></div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <label style={{ flex: 1 }}>
            X offset
            <input type="number" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} style={{ width: "100%", marginTop: 2, padding: "3px 6px", background: "var(--es-surface)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }} />
          </label>
          <label style={{ flex: 1 }}>
            Y offset
            <input type="number" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} style={{ width: "100%", marginTop: 2, padding: "3px 6px", background: "var(--es-surface)", color: "var(--es-text)", border: "1px solid var(--es-border)", borderRadius: 4 }} />
          </label>
        </div>
      </div>

      {/* Component palette */}
      <div style={{ padding: "0 10px 10px" }}>
        <div style={{ marginBottom: 6, color: "var(--es-text-muted)" }}>Components</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {COMPONENT_TEMPLATES.map((tmpl) => (
            <div key={tmpl.type} style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => insertSnippet(tmpl)}
                title={`Insert ${tmpl.label} snippet into editor`}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  background: copied === tmpl.type ? "#16a34a" : "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
              >
                {copied === tmpl.type ? "✓ Inserted" : `＋ ${tmpl.label}`}
              </button>
              <button
                onClick={() => copySnippet(tmpl)}
                title="Copy snippet to clipboard"
                style={{
                  padding: "6px 8px",
                  background: copied === tmpl.type + "-copy" ? "#16a34a" : "var(--es-surface)",
                  color: "var(--es-text)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {copied === tmpl.type + "-copy" ? "✓" : "⧉"}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 10px 10px", color: "var(--es-text-muted)", fontSize: 11 }}>
        Click <strong>＋</strong> to insert a snippet at the end of your code file, or <strong>⧉</strong> to copy to clipboard.
        Anchor and offset are reflected in the generated code.
      </div>
    </div>
  );
}
