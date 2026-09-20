import React from "react";
import type { VNNode, VariableCondition } from "./persistence";
import {
  defaultCondition,
  setNodeCondition,
  toggleOptionWhen,
  updateOptionWhen,
  removeOption,
} from "./conditionEditing";

interface Props {
  node: VNNode;
  localNodes: VNNode[];
  onSave: (nodes: VNNode[]) => void;
  onClose: () => void;
}

const fieldInputStyle: React.CSSProperties = {
  padding: "4px 8px",
  background: "var(--es-bg)",
  border: "1px solid var(--es-border)",
  borderRadius: 4,
  color: "var(--es-text)",
};

/**
 * Editor for a single `VariableCondition` — the switch/variable check that
 * gates a `"condition"` node's branch or a choice option's `when`. Shared by
 * both call sites so condition authoring looks and behaves the same way
 * everywhere it appears.
 */
function ConditionFields({
  condition,
  onChange,
}: {
  condition: VariableCondition;
  onChange: (next: VariableCondition) => void;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      <select
        value={condition.kind}
        onChange={(e) => {
          const kind = e.target.value as VariableCondition["kind"];
          onChange(
            kind === "switch"
              ? { kind: "switch", index: condition.index, equals: true }
              : {
                  kind: "variable",
                  index: condition.index,
                  op: "eq",
                  value: 0,
                },
          );
        }}
        style={{ ...fieldInputStyle, flex: "0 0 auto" }}
      >
        <option value="switch">Switch</option>
        <option value="variable">Variable</option>
      </select>
      <input
        type="number"
        min={1}
        max={1000}
        value={condition.index}
        onChange={(e) => {
          const index = parseInt(e.target.value, 10);
          if (isNaN(index)) return;
          onChange({ ...condition, index });
        }}
        title="Switch/variable index (1-1000)"
        style={{ ...fieldInputStyle, width: 56 }}
      />
      {condition.kind === "switch" ? (
        <select
          value={String(condition.equals)}
          onChange={(e) =>
            onChange({ ...condition, equals: e.target.value === "true" })
          }
          style={{ ...fieldInputStyle, flex: "0 0 auto" }}
        >
          <option value="true">is ON</option>
          <option value="false">is OFF</option>
        </select>
      ) : (
        <>
          <select
            value={condition.op}
            onChange={(e) => {
              const op = e.target.value as
                | "eq"
                | "neq"
                | "gt"
                | "gte"
                | "lt"
                | "lte";
              onChange({ ...condition, op });
            }}
            style={{ ...fieldInputStyle, flex: "0 0 auto" }}
          >
            <option value="eq">==</option>
            <option value="neq">!=</option>
            <option value="gt">&gt;</option>
            <option value="gte">&gt;=</option>
            <option value="lt">&lt;</option>
            <option value="lte">&lt;=</option>
          </select>
          <input
            type="number"
            value={condition.value}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (isNaN(value)) return;
              onChange({ ...condition, value });
            }}
            style={{ ...fieldInputStyle, width: 64 }}
          />
        </>
      )}
    </div>
  );
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
        {draft.type !== "condition" && (
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
        )}
        {draft.type === "condition" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, color: "var(--es-text-muted)" }}>
              Gate — the True port fires when this holds, the False port
              otherwise (leave False unconnected to end there).
            </div>
            <ConditionFields
              condition={draft.condition ?? defaultCondition()}
              onChange={(condition) =>
                setDraft((n) => setNodeCondition(n, condition))
              }
            />
          </div>
        )}
        {draft.type === "choice" &&
          draft.options?.map((opt, i) => {
            const when = draft.optionWhens?.[i];
            return (
              <div
                key={i}
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <div style={{ display: "flex", gap: 4 }}>
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
                    onClick={() => setDraft((n) => removeOption(n, i))}
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
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--es-text-muted)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={when !== undefined}
                    onChange={(e) =>
                      setDraft((n) => toggleOptionWhen(n, i, e.target.checked))
                    }
                  />
                  Only show when…
                </label>
                {when !== undefined && (
                  <ConditionFields
                    condition={when}
                    onChange={(next) =>
                      setDraft((n) => updateOptionWhen(n, i, next))
                    }
                  />
                )}
              </div>
            );
          })}
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
