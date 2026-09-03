import React from "react";
import { useIDEStore } from "../store/ideStore";
import { useHistory } from "../hooks/useHistory";

type AutoTileRule = { mask: number; tileIndex: number };
type RuleSets = Record<string, AutoTileRule[]>;

interface EditState {
  base: string;
  idx: number;
  mask: string;
  tileIndex: string;
}

interface AddState {
  base: string;
  mask: string;
  tileIndex: string;
}

export function AutoTileRulesModal(props: {
  onClose: () => void;
}): React.ReactElement {
  const storeRuleSets = useIDEStore((s) => s.autoTileRuleSets);
  const setStoreRuleSets = useIDEStore((s) => s.setAutoTileRuleSets);

  const {
    state: ruleSets,
    set: setRuleSets,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<RuleSets>(storeRuleSets as RuleSets);

  const prevRef = React.useRef(ruleSets);
  React.useEffect(() => {
    if (prevRef.current !== ruleSets) {
      prevRef.current = ruleSets;
      setStoreRuleSets(ruleSets);
    }
  }, [ruleSets, setStoreRuleSets]);

  const [editState, setEditState] = React.useState<EditState | null>(null);
  const [addState, setAddState] = React.useState<AddState | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<{
    base: string;
    idx: number;
  } | null>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") {
        props.onClose();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "z"))
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, props]);

  const applyAdd = (): void => {
    if (!addState) return;
    const base = addState.base.trim();
    const maskNum = parseInt(addState.mask, 10);
    const tileIndexNum = parseInt(addState.tileIndex, 10);
    if (!base || isNaN(maskNum) || isNaN(tileIndexNum)) return;
    const existing = ruleSets[base] ?? [];
    setRuleSets({
      ...ruleSets,
      [base]: [...existing, { mask: maskNum, tileIndex: tileIndexNum }],
    });
    setAddState(null);
  };

  const applyEdit = (): void => {
    if (!editState) return;
    const maskNum = parseInt(editState.mask, 10);
    const tileIndexNum = parseInt(editState.tileIndex, 10);
    if (isNaN(maskNum) || isNaN(tileIndexNum)) return;
    const rules = ruleSets[editState.base] ?? [];
    const updated = rules.map((r, i) =>
      i === editState.idx ? { mask: maskNum, tileIndex: tileIndexNum } : r,
    );
    setRuleSets({ ...ruleSets, [editState.base]: updated });
    setEditState(null);
  };

  const deleteRule = (base: string, idx: number): void => {
    const rules = ruleSets[base] ?? [];
    const next = rules.filter((_, i) => i !== idx);
    if (next.length === 0) {
      const rest = Object.fromEntries(
        Object.entries(ruleSets).filter(([k]) => k !== base),
      );
      setRuleSets(rest);
    } else {
      setRuleSets({ ...ruleSets, [base]: next });
    }
    setConfirmDelete(null);
  };

  const totalRules = Object.values(ruleSets).reduce(
    (acc, arr) => acc + arr.length,
    0,
  );

  const btnBase: React.CSSProperties = {
    padding: "3px 10px",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
  };

  const inputStyle: React.CSSProperties = {
    padding: "2px 4px",
    background: "var(--es-bg)",
    color: "var(--es-text)",
    border: "1px solid var(--es-border)",
    borderRadius: 3,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        style={{
          background: "var(--es-surface)",
          border: "1px solid var(--es-border)",
          borderRadius: 8,
          padding: 20,
          width: 560,
          maxHeight: "80vh",
          overflow: "auto",
          color: "var(--es-text)",
          fontSize: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong style={{ fontSize: 13 }}>Auto-Tile Rules</strong>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              style={{
                ...btnBase,
                background: "var(--es-bg)",
                color: "var(--es-text)",
                opacity: canUndo ? 1 : 0.4,
                cursor: canUndo ? "pointer" : "default",
              }}
            >
              &#x21A9; Undo
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              style={{
                ...btnBase,
                background: "var(--es-bg)",
                color: "var(--es-text)",
                opacity: canRedo ? 1 : 0.4,
                cursor: canRedo ? "pointer" : "default",
              }}
            >
              &#x21AA; Redo
            </button>
            <button
              onClick={props.onClose}
              title="Close (Esc)"
              style={{
                background: "none",
                border: "none",
                color: "var(--es-text)",
                cursor: "pointer",
                fontSize: 16,
                padding: "0 4px",
              }}
            >
              &#x2715;
            </button>
          </div>
        </div>

        <p style={{ opacity: 0.55, margin: 0, lineHeight: 1.5 }}>
          Each rule maps a neighbour bitmask (8-bit: NW N NE W E SW S SE) to a
          tile variant index. The engine picks the matching variant automatically
          when painting.
        </p>

        {totalRules === 0 && !addState ? (
          <p style={{ opacity: 0.45, margin: 0 }}>
            No rules yet. Add one to get started.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr
                  style={{
                    opacity: 0.55,
                    textAlign: "left",
                    borderBottom: "1px solid var(--es-border)",
                  }}
                >
                  <th style={{ padding: "2px 10px 6px 0", fontWeight: 500 }}>Base</th>
                  <th style={{ padding: "2px 10px 6px 0", fontWeight: 500 }}>Mask</th>
                  <th style={{ padding: "2px 10px 6px 0", fontWeight: 500 }}>Binary</th>
                  <th style={{ padding: "2px 10px 6px 0", fontWeight: 500 }}>Variant</th>
                  <th style={{ padding: "2px 0 6px 0", fontWeight: 500 }}></th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ruleSets).flatMap(([base, rules]) =>
                  (rules as AutoTileRule[]).map((r, i) => {
                    const isEditing =
                      editState?.base === base && editState.idx === i;
                    const isConfirming =
                      confirmDelete?.base === base && confirmDelete.idx === i;
                    return (
                      <tr
                        key={`${base}-${String(i)}`}
                        style={{ borderBottom: "1px solid var(--es-border)" }}
                      >
                        {isEditing ? (
                          <>
                            <td style={{ padding: "5px 10px 5px 0" }}>
                              <span style={{ opacity: 0.6 }}>{base}</span>
                            </td>
                            <td style={{ padding: "5px 10px 5px 0" }}>
                              <input
                                type="number"
                                min={0}
                                max={255}
                                value={editState.mask}
                                onChange={(e) =>
                                  setEditState({ ...editState, mask: e.target.value })
                                }
                                style={{ ...inputStyle, width: 64 }}
                                autoFocus
                              />
                            </td>
                            <td
                              style={{
                                padding: "5px 10px 5px 0",
                                opacity: 0.5,
                                fontFamily: "monospace",
                              }}
                            >
                              {isNaN(parseInt(editState.mask, 10))
                                ? "—"
                                : `0b${parseInt(editState.mask, 10).toString(2).padStart(8, "0")}`}
                            </td>
                            <td style={{ padding: "5px 10px 5px 0" }}>
                              <input
                                type="number"
                                min={0}
                                value={editState.tileIndex}
                                onChange={(e) =>
                                  setEditState({ ...editState, tileIndex: e.target.value })
                                }
                                style={{ ...inputStyle, width: 64 }}
                              />
                            </td>
                            <td style={{ padding: "5px 0", whiteSpace: "nowrap" }}>
                              <span style={{ display: "inline-flex", gap: 4 }}>
                                <button
                                  onClick={applyEdit}
                                  style={{
                                    ...btnBase,
                                    background: "var(--es-accent)",
                                    color: "#fff",
                                    border: "none",
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditState(null)}
                                  style={{
                                    ...btnBase,
                                    background: "var(--es-bg)",
                                    color: "var(--es-text)",
                                  }}
                                >
                                  Cancel
                                </button>
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: "5px 10px 5px 0" }}>{base}</td>
                            <td style={{ padding: "5px 10px 5px 0" }}>{r.mask}</td>
                            <td
                              style={{
                                padding: "5px 10px 5px 0",
                                opacity: 0.55,
                                fontFamily: "monospace",
                              }}
                            >
                              {`0b${r.mask.toString(2).padStart(8, "0")}`}
                            </td>
                            <td style={{ padding: "5px 10px 5px 0" }}>{r.tileIndex}</td>
                            <td style={{ padding: "5px 0", whiteSpace: "nowrap" }}>
                              {isConfirming ? (
                                <span style={{ display: "inline-flex", gap: 4 }}>
                                  <button
                                    onClick={() => deleteRule(base, i)}
                                    style={{
                                      ...btnBase,
                                      background: "#991b1b",
                                      color: "#fff",
                                      border: "none",
                                    }}
                                  >
                                    Confirm delete
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    style={{
                                      ...btnBase,
                                      background: "var(--es-bg)",
                                      color: "var(--es-text)",
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </span>
                              ) : (
                                <span style={{ display: "inline-flex", gap: 4 }}>
                                  <button
                                    onClick={() => {
                                      setEditState({
                                        base,
                                        idx: i,
                                        mask: String(r.mask),
                                        tileIndex: String(r.tileIndex),
                                      });
                                      setConfirmDelete(null);
                                    }}
                                    style={{
                                      ...btnBase,
                                      background: "var(--es-bg)",
                                      color: "var(--es-text)",
                                    }}
                                    title="Edit rule"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmDelete({ base, idx: i });
                                      setEditState(null);
                                    }}
                                    style={{
                                      ...btnBase,
                                      background: "var(--es-bg)",
                                      color: "#f87171",
                                      border: "1px solid #f87171",
                                    }}
                                    title="Delete rule"
                                  >
                                    &#x2715;
                                  </button>
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  }),
                )}
                {addState && (
                  <tr style={{ borderBottom: "1px solid var(--es-border)" }}>
                    <td style={{ padding: "5px 10px 5px 0" }}>
                      <input
                        type="number"
                        min={0}
                        placeholder="Base #"
                        value={addState.base}
                        onChange={(e) =>
                          setAddState({ ...addState, base: e.target.value })
                        }
                        style={{ ...inputStyle, width: 64 }}
                        autoFocus
                      />
                    </td>
                    <td style={{ padding: "5px 10px 5px 0" }}>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        placeholder="0-255"
                        value={addState.mask}
                        onChange={(e) =>
                          setAddState({ ...addState, mask: e.target.value })
                        }
                        style={{ ...inputStyle, width: 70 }}
                      />
                    </td>
                    <td
                      style={{
                        padding: "5px 10px 5px 0",
                        opacity: 0.5,
                        fontFamily: "monospace",
                      }}
                    >
                      {isNaN(parseInt(addState.mask, 10))
                        ? "—"
                        : `0b${parseInt(addState.mask, 10).toString(2).padStart(8, "0")}`}
                    </td>
                    <td style={{ padding: "5px 10px 5px 0" }}>
                      <input
                        type="number"
                        min={0}
                        placeholder="Variant #"
                        value={addState.tileIndex}
                        onChange={(e) =>
                          setAddState({ ...addState, tileIndex: e.target.value })
                        }
                        style={{ ...inputStyle, width: 70 }}
                      />
                    </td>
                    <td style={{ padding: "5px 0", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          onClick={applyAdd}
                          style={{
                            ...btnBase,
                            background: "var(--es-accent)",
                            color: "#fff",
                            border: "none",
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setAddState(null)}
                          style={{
                            ...btnBase,
                            background: "var(--es-bg)",
                            color: "var(--es-text)",
                          }}
                        >
                          Cancel
                        </button>
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {!addState && (
          <button
            onClick={() => {
              setAddState({ base: "", mask: "", tileIndex: "" });
              setEditState(null);
              setConfirmDelete(null);
            }}
            style={{
              ...btnBase,
              background: "var(--es-surface)",
              color: "var(--es-text)",
              alignSelf: "flex-start",
              padding: "5px 14px",
            }}
          >
            + Add rule
          </button>
        )}
      </div>
    </div>
  );
}
