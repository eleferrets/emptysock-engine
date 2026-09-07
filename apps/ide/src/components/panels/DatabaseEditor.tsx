import React from "react";
import { useDBStore } from "../../store/dbStore";
import { useHistory } from "../../hooks/useHistory";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DBActor {
  id: number;
  name: string;
  className: string;
  maxHp: number;
  maxMp: number;
  atk: number;
  def: number;
  note: string;
}

export interface DBClass {
  id: number;
  name: string;
  expBase: number;
  expExtra: number;
  note: string;
}

export interface DBItem {
  id: number;
  name: string;
  description: string;
  effect: string;
  value: number;
  note: string;
}

export interface DBEnemy {
  id: number;
  name: string;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  note: string;
}

type DBTab = "actors" | "classes" | "items" | "enemies";

const TABS: Array<{ id: DBTab; label: string }> = [
  { id: "actors", label: "Actors" },
  { id: "classes", label: "Classes" },
  { id: "items", label: "Items" },
  { id: "enemies", label: "Enemies" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextId<T extends { id: number }>(items: T[]): number {
  return items.reduce((m, i) => Math.max(m, i.id), 0) + 1;
}

const CELL: React.CSSProperties = {
  padding: "3px 6px",
  border: "1px solid var(--es-border)",
  background: "var(--es-surface)",
  color: "var(--es-text)",
  borderRadius: 3,
  width: "100%",
  boxSizing: "border-box",
};

function NumCell(props: {
  value: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <input
      type="number"
      value={props.value}
      onChange={(e) => props.onChange(Number(e.target.value))}
      style={{ ...CELL, width: 70 }}
    />
  );
}

function StrCell(props: {
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
}): React.ReactElement {
  return (
    <input
      type="text"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      style={{ ...CELL, width: props.wide ? 180 : 110 }}
    />
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface DBState {
  actors: DBActor[];
  classes: DBClass[];
  items: DBItem[];
  enemies: DBEnemy[];
}

export function DatabaseEditor(): React.ReactElement {
  const storeActors = useDBStore((s) => s.dbActors);
  const storeClasses = useDBStore((s) => s.dbClasses);
  const storeItems = useDBStore((s) => s.dbItems);
  const storeEnemies = useDBStore((s) => s.dbEnemies);
  const setStoreActors = useDBStore((s) => s.setDBActors);
  const setStoreClasses = useDBStore((s) => s.setDBClasses);
  const setStoreItems = useDBStore((s) => s.setDBItems);
  const setStoreEnemies = useDBStore((s) => s.setDBEnemies);

  const {
    state: dbState,
    set: setDbState,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<DBState>({
    actors: storeActors as DBActor[],
    classes: storeClasses as DBClass[],
    items: storeItems as DBItem[],
    enemies: storeEnemies as DBEnemy[],
  });

  const dbActors = dbState.actors;
  const dbClasses = dbState.classes;
  const dbItems = dbState.items;
  const dbEnemies = dbState.enemies;

  const prevDbRef = React.useRef<DBState>(dbState);

  // Sync history → store on undo/redo
  React.useEffect(() => {
    if (dbState !== prevDbRef.current) {
      prevDbRef.current = dbState;
      setStoreActors(dbState.actors);
      setStoreClasses(dbState.classes);
      setStoreItems(dbState.items);
      setStoreEnemies(dbState.enemies);
    }
  }, [
    dbState,
    setStoreActors,
    setStoreClasses,
    setStoreItems,
    setStoreEnemies,
  ]);

  const commit = (patch: Partial<DBState>): void => {
    const next = { ...dbState, ...patch };
    prevDbRef.current = next;
    setDbState(next);
    if (patch.actors !== undefined) setStoreActors(patch.actors);
    if (patch.classes !== undefined) setStoreClasses(patch.classes);
    if (patch.items !== undefined) setStoreItems(patch.items);
    if (patch.enemies !== undefined) setStoreEnemies(patch.enemies);
  };

  const setDBActors = (v: DBActor[]): void => commit({ actors: v });
  const setDBClasses = (v: DBClass[]): void => commit({ classes: v });
  const setDBItems = (v: DBItem[]): void => commit({ items: v });
  const setDBEnemies = (v: DBEnemy[]): void => commit({ enemies: v });

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

  const [tab, setTab] = React.useState<DBTab>("actors");

  const updateActor = (id: number, patch: Partial<DBActor>): void => {
    setDBActors(dbActors.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };
  const removeActor = (id: number): void =>
    setDBActors(dbActors.filter((a) => a.id !== id));
  const addActor = (): void =>
    setDBActors([
      ...dbActors,
      {
        id: nextId(dbActors),
        name: "New Actor",
        className: "Fighter",
        maxHp: 500,
        maxMp: 100,
        atk: 10,
        def: 5,
        note: "",
      },
    ]);

  const updateClass = (id: number, patch: Partial<DBClass>): void => {
    setDBClasses(dbClasses.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeClass = (id: number): void =>
    setDBClasses(dbClasses.filter((c) => c.id !== id));
  const addClass = (): void =>
    setDBClasses([
      ...dbClasses,
      {
        id: nextId(dbClasses),
        name: "New Class",
        expBase: 30,
        expExtra: 20,
        note: "",
      },
    ]);

  const updateItem = (id: number, patch: Partial<DBItem>): void => {
    setDBItems(dbItems.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };
  const removeItem = (id: number): void =>
    setDBItems(dbItems.filter((i) => i.id !== id));
  const addItem = (): void =>
    setDBItems([
      ...dbItems,
      {
        id: nextId(dbItems),
        name: "New Item",
        description: "",
        effect: "hp + 100",
        value: 50,
        note: "",
      },
    ]);

  const updateEnemy = (id: number, patch: Partial<DBEnemy>): void => {
    setDBEnemies(dbEnemies.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const removeEnemy = (id: number): void =>
    setDBEnemies(dbEnemies.filter((e) => e.id !== id));
  const addEnemy = (): void =>
    setDBEnemies([
      ...dbEnemies,
      {
        id: nextId(dbEnemies),
        name: "Slime",
        maxHp: 200,
        atk: 8,
        def: 4,
        exp: 10,
        gold: 5,
        note: "",
      },
    ]);

  const btnStyle: React.CSSProperties = {
    padding: "3px 10px",
    background: "var(--es-accent)",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 12,
  };
  const delStyle: React.CSSProperties = { ...btnStyle, background: "#7f1d1d" };
  const thStyle: React.CSSProperties = {
    padding: "4px 6px",
    borderBottom: "1px solid var(--es-border)",
    textAlign: "left",
    whiteSpace: "nowrap",
    color: "var(--es-text-muted)",
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
          alignItems: "center",
          borderBottom: "1px solid var(--es-border)",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "6px 16px",
              background: tab === t.id ? "var(--es-surface)" : "transparent",
              color: "var(--es-text)",
              border: "none",
              borderBottom:
                tab === t.id
                  ? "2px solid var(--es-accent)"
                  : "2px solid transparent",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            padding: "4px 8px",
            background: "transparent",
            border: "none",
            color: "var(--es-text)",
            cursor: canUndo ? "pointer" : "default",
            opacity: canUndo ? 1 : 0.4,
            fontSize: 14,
          }}
        >
          ↩
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{
            padding: "4px 8px",
            background: "transparent",
            border: "none",
            color: "var(--es-text)",
            cursor: canRedo ? "pointer" : "default",
            opacity: canRedo ? 1 : 0.4,
            fontSize: 14,
            marginRight: 4,
          }}
        >
          ↪
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 10 }}>
        {tab === "actors" && (
          <>
            <button style={btnStyle} onClick={addActor}>
              + Actor
            </button>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 8,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Class</th>
                  <th style={thStyle}>HP</th>
                  <th style={thStyle}>MP</th>
                  <th style={thStyle}>ATK</th>
                  <th style={thStyle}>DEF</th>
                  <th style={thStyle}>Note</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {dbActors.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "20px 12px",
                        textAlign: "center",
                        color: "var(--es-text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      No actors yet — click <strong>+ Actor</strong> to add one.
                    </td>
                  </tr>
                )}
                {dbActors.map((a) => (
                  <tr key={a.id}>
                    <td style={{ padding: "2px 6px" }}>{a.id}</td>
                    <td>
                      <StrCell
                        value={a.name}
                        onChange={(v) => updateActor(a.id, { name: v })}
                      />
                    </td>
                    <td>
                      <StrCell
                        value={a.className}
                        onChange={(v) => updateActor(a.id, { className: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={a.maxHp}
                        onChange={(v) => updateActor(a.id, { maxHp: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={a.maxMp}
                        onChange={(v) => updateActor(a.id, { maxMp: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={a.atk}
                        onChange={(v) => updateActor(a.id, { atk: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={a.def}
                        onChange={(v) => updateActor(a.id, { def: v })}
                      />
                    </td>
                    <td>
                      <StrCell
                        value={a.note}
                        onChange={(v) => updateActor(a.id, { note: v })}
                        wide
                      />
                    </td>
                    <td>
                      <button
                        style={delStyle}
                        onClick={() => removeActor(a.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "classes" && (
          <>
            <button style={btnStyle} onClick={addClass}>
              + Class
            </button>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 8,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>EXP Base</th>
                  <th style={thStyle}>EXP Extra</th>
                  <th style={thStyle}>Note</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {dbClasses.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "20px 12px",
                        textAlign: "center",
                        color: "var(--es-text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      No classes yet — click <strong>+ Class</strong> to add
                      one.
                    </td>
                  </tr>
                )}
                {dbClasses.map((c) => (
                  <tr key={c.id}>
                    <td style={{ padding: "2px 6px" }}>{c.id}</td>
                    <td>
                      <StrCell
                        value={c.name}
                        onChange={(v) => updateClass(c.id, { name: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={c.expBase}
                        onChange={(v) => updateClass(c.id, { expBase: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={c.expExtra}
                        onChange={(v) => updateClass(c.id, { expExtra: v })}
                      />
                    </td>
                    <td>
                      <StrCell
                        value={c.note}
                        onChange={(v) => updateClass(c.id, { note: v })}
                        wide
                      />
                    </td>
                    <td>
                      <button
                        style={delStyle}
                        onClick={() => removeClass(c.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "items" && (
          <>
            <button style={btnStyle} onClick={addItem}>
              + Item
            </button>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 8,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Description</th>
                  <th style={thStyle}>Effect</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Note</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {dbItems.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "20px 12px",
                        textAlign: "center",
                        color: "var(--es-text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      No items yet — click <strong>+ Item</strong> to add one.
                    </td>
                  </tr>
                )}
                {dbItems.map((i) => (
                  <tr key={i.id}>
                    <td style={{ padding: "2px 6px" }}>{i.id}</td>
                    <td>
                      <StrCell
                        value={i.name}
                        onChange={(v) => updateItem(i.id, { name: v })}
                      />
                    </td>
                    <td>
                      <StrCell
                        value={i.description}
                        onChange={(v) => updateItem(i.id, { description: v })}
                        wide
                      />
                    </td>
                    <td>
                      <StrCell
                        value={i.effect}
                        onChange={(v) => updateItem(i.id, { effect: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={i.value}
                        onChange={(v) => updateItem(i.id, { value: v })}
                      />
                    </td>
                    <td>
                      <StrCell
                        value={i.note}
                        onChange={(v) => updateItem(i.id, { note: v })}
                        wide
                      />
                    </td>
                    <td>
                      <button style={delStyle} onClick={() => removeItem(i.id)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {tab === "enemies" && (
          <>
            <button style={btnStyle} onClick={addEnemy}>
              + Enemy
            </button>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                marginTop: 8,
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>HP</th>
                  <th style={thStyle}>ATK</th>
                  <th style={thStyle}>DEF</th>
                  <th style={thStyle}>EXP</th>
                  <th style={thStyle}>Gold</th>
                  <th style={thStyle}>Note</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {dbEnemies.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        padding: "20px 12px",
                        textAlign: "center",
                        color: "var(--es-text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      No enemies yet — click <strong>+ Enemy</strong> to add
                      one.
                    </td>
                  </tr>
                )}
                {dbEnemies.map((e) => (
                  <tr key={e.id}>
                    <td style={{ padding: "2px 6px" }}>{e.id}</td>
                    <td>
                      <StrCell
                        value={e.name}
                        onChange={(v) => updateEnemy(e.id, { name: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={e.maxHp}
                        onChange={(v) => updateEnemy(e.id, { maxHp: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={e.atk}
                        onChange={(v) => updateEnemy(e.id, { atk: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={e.def}
                        onChange={(v) => updateEnemy(e.id, { def: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={e.exp}
                        onChange={(v) => updateEnemy(e.id, { exp: v })}
                      />
                    </td>
                    <td>
                      <NumCell
                        value={e.gold}
                        onChange={(v) => updateEnemy(e.id, { gold: v })}
                      />
                    </td>
                    <td>
                      <StrCell
                        value={e.note}
                        onChange={(v) => updateEnemy(e.id, { note: v })}
                        wide
                      />
                    </td>
                    <td>
                      <button
                        style={delStyle}
                        onClick={() => removeEnemy(e.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
