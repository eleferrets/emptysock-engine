import React from "react";
import type { VNNode } from "./persistence";

interface Props {
  node: VNNode;
  localNodes: VNNode[];
  onSave: (nodes: VNNode[]) => void;
  onClose: () => void;
}

export function VNNodeEditModal({
  node,
  localNodes,
  onSave,
  onClose,
}: Props): React.ReactElement {
  const [draft, setDraft] = React.useState<VNNode>(node);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "var(--es-surface)",
          border: "1px solid var(--es-border)",
          borderRadius: 8,
          padding: 16,
          width: 360,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 600 }}>Edit Node</div>
        {draft.type === "dialogue" && (
          <input
            value={draft.speaker ?? ""}
            onChange={(e) =>
              setDraft((n) => ({ ...n, speaker: e.target.value }))
            }
            placeholder="Speaker"
            style={{
              padding: "4px 8px",
              background: "var(--es-bg)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              color: "var(--es-text)",
            }}
          />
        )}
        <textarea
          value={draft.text}
          rows={4}
          onChange={(e) => setDraft((n) => ({ ...n, text: e.target.value }))}
          style={{
            padding: "4px 8px",
            background: "var(--es-bg)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            resize: "vertical",
          }}
        />
        {draft.type === "choice" &&
          draft.options?.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 4 }}>
              <input
                value={opt}
                onChange={(e) =>
                  setDraft((n) => {
                    if (!n.options) return n;
                    const opts = [...n.options];
                    opts[i] = e.target.value;
                    return { ...n, options: opts };
                  })
                }
                placeholder={`Option ${i + 1}`}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  background: "var(--es-bg)",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  color: "var(--es-text)",
                }}
              />
              <button
                onClick={() =>
                  setDraft((n) => {
                    if (!n.options) return n;
                    return {
                      ...n,
                      options: n.options.filter((_, j) => j !== i),
                    };
                  })
                }
                style={{
                  padding: "2px 6px",
                  background: "none",
                  border: "1px solid var(--es-border)",
                  borderRadius: 4,
                  color: "var(--es-red)",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>
          ))}
        {draft.type === "choice" && (
          <button
            onClick={() =>
              setDraft((n) => ({
                ...n,
                options: [
                  ...(n.options ?? []),
                  `Option ${(n.options?.length ?? 0) + 1}`,
                ],
              }))
            }
            style={{
              padding: "3px 8px",
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              color: "var(--es-text)",
              cursor: "pointer",
              fontSize: 11,
            }}
          >
            + Add option
          </button>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              onSave(localNodes.map((n) => (n.id === draft.id ? draft : n)));
              onClose();
            }}
            style={{
              flex: 1,
              padding: "5px 0",
              background: "var(--es-accent)",
              border: "none",
              borderRadius: 4,
              color: "var(--es-text-on-accent)",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "5px 0",
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 4,
              color: "var(--es-text)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
