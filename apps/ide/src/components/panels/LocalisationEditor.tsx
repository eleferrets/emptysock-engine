import React from "react";

type Locale = string;
type Key = string;
type Translations = Record<Key, Record<Locale, string>>;

const INITIAL_LOCALES: Locale[] = ["en", "fr", "de", "ja"];
const INITIAL_TRANSLATIONS: Translations = {
  "ui.start_game": {
    en: "Start Game",
    fr: "Démarrer",
    de: "Spiel Starten",
    ja: "ゲーム開始",
  },
  "ui.settings": {
    en: "Settings",
    fr: "Paramètres",
    de: "Einstellungen",
    ja: "設定",
  },
  "ui.quit": { en: "Quit", fr: "Quitter", de: "Beenden", ja: "終了" },
  "dialog.hero.greeting": {
    en: "Hello, traveller!",
    fr: "Bonjour, voyageur!",
    de: "Hallo, Reisender!",
    ja: "こんにちは、旅人！",
  },
  "hud.health": { en: "Health", fr: "Santé", de: "Gesundheit", ja: "体力" },
};

export function LocalisationEditor(): React.ReactElement {
  const [locales, setLocales] = React.useState<Locale[]>(INITIAL_LOCALES);
  const [translations, setTranslations] =
    React.useState<Translations>(INITIAL_TRANSLATIONS);
  const [editing, setEditing] = React.useState<{
    key: Key;
    locale: Locale;
  } | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [newKey, setNewKey] = React.useState("");
  const [filter, setFilter] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const keys = Object.keys(translations).filter(
    (k) =>
      k.includes(filter) ||
      locales.some((l) =>
        (translations[k]?.[l] ?? "")
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
  );

  const startEdit = (key: Key, locale: Locale): void => {
    setEditing({ key, locale });
    setEditValue(translations[key]?.[locale] ?? "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitEdit = (): void => {
    if (!editing) return;
    setTranslations((prev) => ({
      ...prev,
      [editing.key]: { ...prev[editing.key], [editing.locale]: editValue },
    }));
    setEditing(null);
  };

  const addKey = (): void => {
    const k = newKey.trim();
    if (!k || translations[k]) return;
    setTranslations((prev) => ({ ...prev, [k]: {} }));
    setNewKey("");
  };

  const addLocale = (): void => {
    const code = prompt("Locale code (e.g. es):")?.trim();
    if (code && !locales.includes(code)) setLocales((prev) => [...prev, code]);
  };

  const exportCSV = (): void => {
    const header = ["key", ...locales].join(",");
    const rows = Object.entries(translations).map(([k, vals]) =>
      [
        k,
        ...locales.map((l) => `"${(vals[l] ?? "").replace(/"/g, '"""')}"`),
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "localisation.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCSV = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").filter(Boolean);
      const firstLine = lines[0];
      if (firstLine === undefined) return;
      const header = firstLine.split(",");
      const importedLocales = header.slice(1);
      const imported: Translations = {};
      for (const line of lines.slice(1)) {
        const cols = line.match(/(?:"([^"]*(?:""[^"]*)*)"|([^,]*))/g) ?? [];
        const key = cols[0]?.replace(/^"|"$/g, "") ?? "";
        if (!key) continue;
        const entry: Record<string, string> = {};
        imported[key] = entry;
        importedLocales.forEach((loc, i) => {
          if (loc === undefined) return;
          entry[loc] = (cols[i + 1] ?? "")
            .replace(/^"|"$/g, "")
            .replace(/""/g, '"');
        });
      }
      setTranslations(imported);
      const newLocs = importedLocales.filter((l) => !locales.includes(l));
      if (newLocs.length) setLocales((prev) => [...prev, ...newLocs]);
    };
    reader.readAsText(file);
    e.target.value = "";
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
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          padding: "6px 10px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter keys..."
          style={{
            padding: "3px 8px",
            background: "var(--es-bg)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            width: 160,
          }}
        />
        <input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addKey()}
          placeholder="New key..."
          style={{
            padding: "3px 8px",
            background: "var(--es-bg)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            width: 180,
          }}
        />
        <button
          onClick={addKey}
          style={{
            padding: "3px 10px",
            background: "var(--es-accent)",
            border: "none",
            borderRadius: 4,
            color: "#fff",
            cursor: "pointer",
          }}
        >
          + Key
        </button>
        <button
          onClick={addLocale}
          style={{
            padding: "3px 10px",
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            cursor: "pointer",
          }}
        >
          + Locale
        </button>
        <button
          onClick={exportCSV}
          style={{
            padding: "3px 10px",
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            cursor: "pointer",
            marginLeft: "auto",
          }}
        >
          Export CSV
        </button>
        <label
          style={{
            padding: "3px 10px",
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            cursor: "pointer",
          }}
        >
          Import CSV
          <input
            type="file"
            accept=".csv"
            onChange={importCSV}
            style={{ display: "none" }}
          />
        </label>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr
              style={{
                background: "var(--es-surface)",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <th
                style={{
                  padding: "6px 10px",
                  textAlign: "left",
                  borderBottom: "1px solid var(--es-border)",
                  width: 200,
                  color: "var(--es-text-muted)",
                  fontWeight: 600,
                }}
              >
                Key
              </th>
              {locales.map((l) => (
                <th
                  key={l}
                  style={{
                    padding: "6px 10px",
                    textAlign: "left",
                    borderBottom: "1px solid var(--es-border)",
                    color: "var(--es-text-muted)",
                    fontWeight: 600,
                  }}
                >
                  {l.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((key, ri) => (
              <tr
                key={key}
                style={{
                  background:
                    ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                }}
              >
                <td
                  style={{
                    padding: "4px 10px",
                    borderBottom: "1px solid var(--es-border)",
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: "var(--es-text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {key}
                </td>
                {locales.map((locale) => {
                  const isEditing =
                    editing?.key === key && editing.locale === locale;
                  return (
                    <td
                      key={locale}
                      onClick={() => startEdit(key, locale)}
                      style={{
                        padding: "4px 10px",
                        borderBottom: "1px solid var(--es-border)",
                        cursor: "text",
                        maxWidth: 0,
                      }}
                    >
                      {isEditing ? (
                        <input
                          ref={inputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEdit();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          style={{
                            width: "100%",
                            padding: "2px 4px",
                            background: "var(--es-bg)",
                            border: "1px solid var(--es-accent)",
                            borderRadius: 3,
                            color: "var(--es-text)",
                            fontSize: 12,
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: translations[key]?.[locale]
                              ? "var(--es-text)"
                              : "var(--es-text-muted)",
                          }}
                        >
                          {translations[key]?.[locale] ?? <em>empty</em>}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
