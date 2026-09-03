import React from "react";
import { useIDEStore } from "../../store/ideStore";
import { useHistory } from "../../hooks/useHistory";

type PanelTab = "variables" | "switches";

interface VarsState {
  vars: Record<number, number>;
  switches: Record<number, boolean>;
  varNames: Record<number, string>;
  switchNames: Record<number, string>;
}

export function VariablesPanel(): React.ReactElement {
  const [activeTab, setActiveTab] = React.useState<PanelTab>("variables");

  const storeVars = useIDEStore((s) => s.variableStoreVars);
  const storeSwitches = useIDEStore((s) => s.variableStoreSwitches);
  const storeVarNames = useIDEStore((s) => s.variableStoreVarNames);
  const storeSwitchNames = useIDEStore((s) => s.variableStoreSwitchNames);
  const storeSetVar = useIDEStore((s) => s.setVar);
  const storeSetSwitch = useIDEStore((s) => s.setSwitch);
  const storeSetVarName = useIDEStore((s) => s.setVarName);
  const storeSetSwitchName = useIDEStore((s) => s.setSwitchName);

  const {
    state: vsState,
    set: setVsState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<VarsState>({
    vars: storeVars,
    switches: storeSwitches,
    varNames: storeVarNames,
    switchNames: storeSwitchNames,
  });

  const vars = vsState.vars;
  const switches = vsState.switches;
  const varNames = vsState.varNames;
  const switchNames = vsState.switchNames;

  const prevVsRef = React.useRef<VarsState>(vsState);

  // Sync history → store on undo/redo
  React.useEffect(() => {
    if (vsState !== prevVsRef.current) {
      prevVsRef.current = vsState;
      Object.entries(vsState.vars).forEach(([k, v]) =>
        storeSetVar(Number(k), v),
      );
      Object.entries(vsState.switches).forEach(([k, v]) =>
        storeSetSwitch(Number(k), v),
      );
      Object.entries(vsState.varNames).forEach(([k, v]) =>
        storeSetVarName(Number(k), v),
      );
      Object.entries(vsState.switchNames).forEach(([k, v]) =>
        storeSetSwitchName(Number(k), v),
      );
    }
  }, [
    vsState,
    storeSetVar,
    storeSetSwitch,
    storeSetVarName,
    storeSetSwitchName,
  ]);

  const setVar = (index: number, value: number): void => {
    const next = { ...vsState, vars: { ...vsState.vars, [index]: value } };
    prevVsRef.current = next;
    setVsState(next);
    storeSetVar(index, value);
  };
  const setSwitch = (index: number, value: boolean): void => {
    const next = {
      ...vsState,
      switches: { ...vsState.switches, [index]: value },
    };
    prevVsRef.current = next;
    setVsState(next);
    storeSetSwitch(index, value);
  };
  const setVarName = (index: number, name: string): void => {
    const next = {
      ...vsState,
      varNames: { ...vsState.varNames, [index]: name },
    };
    prevVsRef.current = next;
    setVsState(next);
    storeSetVarName(index, name);
  };
  const setSwitchName = (index: number, name: string): void => {
    const next = {
      ...vsState,
      switchNames: { ...vsState.switchNames, [index]: name },
    };
    prevVsRef.current = next;
    setVsState(next);
    storeSetSwitchName(index, name);
  };

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

  // Determine which indices to show (at least 1..20, or up to the highest set index)
  function visibleIndices(
    data: Record<number, number> | Record<number, boolean>,
    names: Record<number, string>,
  ): number[] {
    const keys = [
      ...Object.keys(data).map(Number),
      ...Object.keys(names).map(Number),
    ].filter((n) => n >= 1);
    const max = keys.length > 0 ? Math.max(...keys) : 0;
    const count = Math.max(20, max);
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  const varIndices = visibleIndices(vars, varNames);
  const switchIndices = visibleIndices(switches, switchNames);

  const addVar = (): void => {
    const nextIndex = varIndices.length + 1;
    setVar(nextIndex, 0);
  };

  const addSwitch = (): void => {
    const nextIndex = switchIndices.length + 1;
    setSwitch(nextIndex, false);
  };

  const handleVarValue = (index: number, raw: string): void => {
    const parsed = parseInt(raw, 10);
    setVar(index, isNaN(parsed) ? 0 : parsed);
  };

  const tabStyle = (tab: PanelTab): React.CSSProperties => ({
    padding: "4px 12px",
    fontSize: 12,
    border: "none",
    borderBottom:
      activeTab === tab
        ? "2px solid var(--es-accent)"
        : "2px solid transparent",
    background: "none",
    color: activeTab === tab ? "var(--es-accent)" : "var(--es-text-muted)",
    cursor: "pointer",
  });

  const btnStyle: React.CSSProperties = {
    padding: "3px 10px",
    fontSize: 11,
    background: "var(--es-surface-raised)",
    color: "var(--es-text)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--es-input-bg, var(--es-surface))",
    color: "var(--es-text)",
    border: "1px solid var(--es-border)",
    borderRadius: 3,
    padding: "2px 6px",
    fontSize: 12,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontSize: 12,
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          flexShrink: 0,
        }}
      >
        <button
          style={tabStyle("variables")}
          onClick={() => setActiveTab("variables")}
        >
          Variables
        </button>
        <button
          style={tabStyle("switches")}
          onClick={() => setActiveTab("switches")}
        >
          Switches
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {activeTab === "variables" && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 44 }} />
              <col />
              <col style={{ width: 100 }} />
            </colgroup>
            <thead>
              <tr
                style={{
                  background: "var(--es-surface)",
                  borderBottom: "1px solid var(--es-border)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <th
                  style={{
                    padding: "4px 8px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "var(--es-text-muted)",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    padding: "4px 8px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--es-text-muted)",
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    padding: "4px 8px",
                    textAlign: "right",
                    fontWeight: 600,
                    color: "var(--es-text-muted)",
                  }}
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {varIndices.map((idx) => (
                <tr
                  key={idx}
                  style={{ borderBottom: "1px solid var(--es-border)" }}
                >
                  <td
                    style={{
                      padding: "3px 8px",
                      textAlign: "center",
                      color: "var(--es-text-muted)",
                      userSelect: "none",
                    }}
                  >
                    {idx}
                  </td>
                  <td style={{ padding: "3px 6px" }}>
                    <input
                      style={inputStyle}
                      type="text"
                      value={varNames[idx] ?? ""}
                      placeholder={`Variable ${idx}`}
                      onChange={(e) => setVarName(idx, e.target.value)}
                    />
                  </td>
                  <td style={{ padding: "3px 6px" }}>
                    <input
                      style={{ ...inputStyle, textAlign: "right" }}
                      type="number"
                      value={vars[idx] ?? 0}
                      onChange={(e) => handleVarValue(idx, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === "switches" && (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: 44 }} />
              <col />
              <col style={{ width: 60 }} />
            </colgroup>
            <thead>
              <tr
                style={{
                  background: "var(--es-surface)",
                  borderBottom: "1px solid var(--es-border)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                <th
                  style={{
                    padding: "4px 8px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "var(--es-text-muted)",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    padding: "4px 8px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "var(--es-text-muted)",
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    padding: "4px 8px",
                    textAlign: "center",
                    fontWeight: 600,
                    color: "var(--es-text-muted)",
                  }}
                >
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {switchIndices.map((idx) => (
                <tr
                  key={idx}
                  style={{ borderBottom: "1px solid var(--es-border)" }}
                >
                  <td
                    style={{
                      padding: "3px 8px",
                      textAlign: "center",
                      color: "var(--es-text-muted)",
                      userSelect: "none",
                    }}
                  >
                    {idx}
                  </td>
                  <td style={{ padding: "3px 6px" }}>
                    <input
                      style={inputStyle}
                      type="text"
                      value={switchNames[idx] ?? ""}
                      placeholder={`Switch ${idx}`}
                      onChange={(e) => setSwitchName(idx, e.target.value)}
                    />
                  </td>
                  <td style={{ padding: "3px 8px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={switches[idx] ?? false}
                      onChange={(e) => setSwitch(idx, e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer toolbar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 10px",
          borderTop: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            ...btnStyle,
            opacity: canUndo ? 1 : 0.4,
            fontSize: 14,
            cursor: canUndo ? "pointer" : "default",
          }}
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{
            ...btnStyle,
            opacity: canRedo ? 1 : 0.4,
            fontSize: 14,
            cursor: canRedo ? "pointer" : "default",
          }}
        >
          ↪
        </button>
        {activeTab === "variables" && (
          <button style={btnStyle} onClick={addVar}>
            + Add Variable
          </button>
        )}
        {activeTab === "switches" && (
          <button style={btnStyle} onClick={addSwitch}>
            + Add Switch
          </button>
        )}
      </div>
    </div>
  );
}
