import React from "react";
import { useGameGlobalsStore } from "../../store/gameGlobalsStore";
import { useHistory } from "../../hooks/useHistory";

// Empty-state quips (dry, deadpan, stable per session).
const QUIPS: readonly string[] = [
  "No globals. Your state lives elsewhere.",
  "Nothing shared. Refreshingly disciplined.",
  "Zero globals. Zero regrets. Probably.",
  "All quiet. Nothing is reachable from anywhere.",
  "Globals: the thing you swore you would avoid.",
  "Empty. Your future self approves.",
  "No shared state. Bold.",
  "Declare one. It will not judge. Much.",
];

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** Type expressions offered as suggestions; the field itself accepts any TypeScript type expression. */
const TYPE_SUGGESTIONS = [
  "number",
  "string",
  "boolean",
  "number[]",
  "string[]",
  "Record<string, number>",
  "unknown",
];

/** `null` when `name` is usable, else the reason it is not. */
export function validateGlobalName(
  name: string,
  existing: Record<string, string>,
  renamingFrom?: string,
): string | null {
  if (name.length === 0) return "Give it a name.";
  if (!IDENT.test(name))
    return "Letters, digits, _ and $ only; no leading digit.";
  if (name !== renamingFrom && name in existing) return "Already declared.";
  return null;
}

/** Applies `next` to a store through its own add/remove API: removes names no longer present, sets every present one. */
export function syncGlobals(
  current: Record<string, string>,
  next: Record<string, string>,
  set: (name: string, type: string) => void,
  remove: (name: string) => void,
): void {
  for (const name of Object.keys(current)) {
    if (!(name in next)) remove(name);
  }
  for (const [name, type] of Object.entries(next)) {
    if (current[name] !== type) set(name, type);
  }
}

/** Renames while keeping declaration order. */
export function renameGlobal(
  globals: Record<string, string>,
  from: string,
  to: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(globals)) out[k === from ? to : k] = v;
  return out;
}

export function GameGlobalsPanel(): React.ReactElement {
  const storeGlobals = useGameGlobalsStore((s) => s.gameGlobals);
  const setGameGlobal = useGameGlobalsStore((s) => s.setGameGlobal);
  const removeGameGlobal = useGameGlobalsStore((s) => s.removeGameGlobal);

  const { state, set, undo, redo, canUndo, canRedo } =
    useHistory<Record<string, string>>(storeGlobals);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const quip = React.useRef(
    QUIPS[Math.floor(Math.random() * QUIPS.length)] ?? QUIPS[0],
  );

  // History is the source of truth for edits; push every change (including
  // undo/redo) into the store so Monaco's declarations follow.
  React.useEffect(() => {
    const current = useGameGlobalsStore.getState().gameGlobals;
    syncGlobals(current, state, setGameGlobal, removeGameGlobal);
  }, [state, setGameGlobal, removeGameGlobal]);

  // Ctrl+Z / Ctrl+Shift+Z, only while this panel is on screen.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const root = rootRef.current;
      if (root === null || root.offsetParent === null) return;
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const [newName, setNewName] = React.useState("");
  const [newType, setNewType] = React.useState("number");
  const [filter, setFilter] = React.useState("");

  const nameError =
    newName.length > 0 ? validateGlobalName(newName, state) : null;
  const canAdd = newName.length > 0 && nameError === null;

  const add = (): void => {
    if (!canAdd) return;
    set({ ...state, [newName]: newType.trim() || "unknown" });
    setNewName("");
  };

  const entries = Object.entries(state).filter(([name]) =>
    name.toLowerCase().includes(filter.toLowerCase()),
  );

  const inputStyle: React.CSSProperties = {
    background: "var(--es-surface-raised)",
    color: "var(--es-text)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    padding: "3px 6px",
    fontSize: 12,
    fontFamily: "monospace",
    minWidth: 0,
  };
  const btnStyle: React.CSSProperties = {
    padding: "3px 10px",
    fontSize: 11,
    background: "var(--es-surface-raised)",
    color: "var(--es-text)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    cursor: "pointer",
  };

  return (
    <div
      ref={rootRef}
      data-testid="game-globals-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 10px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          style={{ ...btnStyle, opacity: canUndo ? 1 : 0.4 }}
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
          style={{ ...btnStyle, opacity: canRedo ? 1 : 0.4 }}
        >
          ↪
        </button>
        <input
          type="text"
          value={filter}
          placeholder="Filter globals…"
          onChange={(e) => setFilter(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "6px 10px" }}>
        {Object.keys(state).length === 0 ? (
          <div
            data-testid="game-globals-empty"
            style={{ color: "var(--es-text-muted)", padding: "16px 0" }}
          >
            <div>
              No globals declared — add one below to type{" "}
              <code>ctx.globals.get(&quot;name&quot;)</code>.
            </div>
            <div style={{ marginTop: 6, fontSize: 11 }}>{quip.current}</div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ color: "var(--es-text-muted)", padding: "16px 0" }}>
            No results.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--es-text-muted)", textAlign: "left" }}>
                <th style={{ padding: "2px 4px" }}>Name</th>
                <th style={{ padding: "2px 4px" }}>Type</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map(([name, type]) => (
                <GlobalRow
                  key={name}
                  name={name}
                  type={type}
                  all={state}
                  inputStyle={inputStyle}
                  btnStyle={btnStyle}
                  onRename={(to) => set(renameGlobal(state, name, to))}
                  onType={(t) =>
                    set({ ...state, [name]: t.trim() || "unknown" })
                  }
                  onRemove={() => {
                    const next = { ...state };
                    delete next[name];
                    set(next);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "6px 10px",
          borderTop: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={newName}
          placeholder="name"
          aria-label="New global name"
          aria-invalid={nameError !== null}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <input
          type="text"
          list="game-globals-types"
          value={newType}
          aria-label="New global type"
          onChange={(e) => setNewType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          style={{ ...inputStyle, flex: 1 }}
        />
        <datalist id="game-globals-types">
          {TYPE_SUGGESTIONS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <button
          onClick={add}
          disabled={!canAdd}
          style={{ ...btnStyle, opacity: canAdd ? 1 : 0.4 }}
        >
          + Add
        </button>
      </div>
      {nameError !== null && (
        <div
          role="alert"
          style={{ padding: "2px 10px 6px", color: "var(--es-danger, #d33)" }}
        >
          {nameError}
        </div>
      )}
    </div>
  );
}

interface GlobalRowProps {
  name: string;
  type: string;
  all: Record<string, string>;
  inputStyle: React.CSSProperties;
  btnStyle: React.CSSProperties;
  onRename: (to: string) => void;
  onType: (type: string) => void;
  onRemove: () => void;
}

/** One row; name and type commit on blur or Enter, so a half-typed name never lands in history. */
function GlobalRow(p: GlobalRowProps): React.ReactElement {
  const [name, setName] = React.useState(p.name);
  const [type, setType] = React.useState(p.type);
  React.useEffect(() => setName(p.name), [p.name]);
  React.useEffect(() => setType(p.type), [p.type]);

  const error =
    name !== p.name ? validateGlobalName(name, p.all, p.name) : null;

  const commitName = (): void => {
    if (name === p.name) return;
    if (error === null) p.onRename(name);
    else setName(p.name);
  };
  const commitType = (): void => {
    if (type !== p.type) p.onType(type);
  };

  return (
    <tr data-testid={`game-global-${p.name}`}>
      <td style={{ padding: "2px 4px" }}>
        <input
          type="text"
          value={name}
          aria-label={`Name of ${p.name}`}
          aria-invalid={error !== null}
          title={error ?? undefined}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
          }}
          style={{ ...p.inputStyle, width: "100%" }}
        />
      </td>
      <td style={{ padding: "2px 4px" }}>
        <input
          type="text"
          list="game-globals-types"
          value={type}
          aria-label={`Type of ${p.name}`}
          onChange={(e) => setType(e.target.value)}
          onBlur={commitType}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitType();
          }}
          style={{ ...p.inputStyle, width: "100%" }}
        />
      </td>
      <td style={{ padding: "2px 4px", width: 1 }}>
        <button
          onClick={p.onRemove}
          title="Remove"
          aria-label={`Remove ${p.name}`}
          style={p.btnStyle}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
