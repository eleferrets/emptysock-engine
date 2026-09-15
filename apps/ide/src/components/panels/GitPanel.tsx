import React from "react";
import { useIDEStore } from "../../store/ideStore";

interface FileStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked";
  staged: boolean;
  diff?: string;
}

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function runGit(args: string[]): Promise<string> {
  if (!isTauri()) return "(git unavailable in browser)";
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return (await invoke<string>("plugin:shell|execute", {
      cmd: "git",
      args,
    })) as string;
  } catch {
    return "";
  }
}

// ── Mock data for browser mode ────────────────────────────────────────────────
const MOCK_FILES: FileStatus[] = [
  {
    path: "src/scenes/GameScene.ts",
    status: "modified",
    staged: true,
    diff: `--- a/src/scenes/GameScene.ts
+++ b/src/scenes/GameScene.ts
@@ -4,7 +4,7 @@ import { Scene, Entity, Transform, Sprite } from '@emptysock/engine';
 export class GameScene extends Scene {
   constructor() {
-    super('GameScene');
+    super('GameScene', { clearColor: 0x1a1a2e });
   }
 
   override start(): void {
@@ -12,6 +12,9 @@ export class GameScene extends Scene {
     player.addComponent(new Transform({ x: 640, y: 360 }));
     player.addComponent(new Sprite({ tint: 0x7c6af7 }));
     player.addTag('player');
+
+    const hud = this.createEntity('HUD');
+    hud.addTag('ui');
   }
 }`,
  },
  {
    path: "src/entities/Player.ts",
    status: "modified",
    staged: false,
    diff: `--- a/src/entities/Player.ts
+++ b/src/entities/Player.ts
@@ -1,5 +1,5 @@
 import { Entity, Transform } from '@emptysock/engine';
 
-export const PLAYER_SPEED = 200;
+export const PLAYER_SPEED = 260;
 
 export class Player extends Entity {}`,
  },
  {
    path: "src/scenes/MenuScene.ts",
    status: "added",
    staged: false,
    diff: `--- /dev/null
+++ b/src/scenes/MenuScene.ts
@@ -0,0 +1,9 @@
+import { Scene } from '@emptysock/engine';
+
+export class MenuScene extends Scene {
+  constructor() {
+    super('MenuScene');
+  }
+
+  override start(): void {}
+}`,
  },
];

// ── Diff renderer ─────────────────────────────────────────────────────────────
function DiffView({ diff }: { diff: string }): React.ReactElement {
  const lines = diff.split("\n");
  return (
    <div
      style={{
        overflowX: "auto",
        borderTop: "1px solid var(--es-border)",
        background: "var(--es-bg)",
      }}
    >
      <pre
        style={{
          margin: 0,
          padding: "6px 0",
          fontSize: 11,
          lineHeight: 1.5,
          fontFamily: "monospace",
          whiteSpace: "pre",
        }}
      >
        {lines.map((line, i) => {
          let bg = "transparent";
          let color = "var(--es-text)";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            bg = "var(--es-diff-add-bg)";
            color = "var(--es-green)";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            bg = "var(--es-diff-rm-bg)";
            color = "var(--es-red)";
          } else if (line.startsWith("@@")) {
            color = "var(--es-accent)";
          } else if (line.startsWith("---") || line.startsWith("+++")) {
            color = "var(--es-text-muted)";
          }
          return (
            <span
              key={i}
              style={{
                display: "block",
                paddingLeft: 12,
                paddingRight: 12,
                background: bg,
                color,
              }}
            >
              {line || " "}
            </span>
          );
        })}
      </pre>
    </div>
  );
}

// ── File row ──────────────────────────────────────────────────────────────────
function FileRow({
  f,
  expanded,
  onToggle,
  action,
}: {
  f: FileStatus;
  expanded: boolean;
  onToggle: () => void;
  action: React.ReactElement;
}): React.ReactElement {
  const statusColor = (s: FileStatus["status"]): string =>
    ({
      modified: "var(--es-yellow)",
      added: "var(--es-green)",
      deleted: "var(--es-red)",
      untracked: "var(--es-text-muted)",
    })[s];

  const hasDiff = f.diff !== undefined && f.diff.length > 0;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "3px 12px",
          gap: 8,
          cursor: hasDiff ? "pointer" : "default",
          background: expanded ? "var(--es-surface)" : "transparent",
        }}
        onClick={hasDiff ? onToggle : undefined}
      >
        <span
          style={{
            color: statusColor(f.status),
            width: 8,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {(f.status[0] ?? "?").toUpperCase()}
        </span>
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {f.path}
        </span>
        {hasDiff && (
          <span
            style={{
              fontSize: 9,
              padding: "1px 4px",
              borderRadius: 3,
              border: "1px solid var(--es-border)",
              color: "var(--es-text-muted)",
              flexShrink: 0,
              userSelect: "none",
            }}
          >
            DIFF
          </span>
        )}
        <span style={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {action}
        </span>
      </div>
      {expanded && hasDiff && <DiffView diff={f.diff as string} />}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────
export function GitPanel(): React.ReactElement {
  const { projectFolder, addLog } = useIDEStore();
  const [files, setFiles] = React.useState<FileStatus[]>([]);
  const [commitMsg, setCommitMsg] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [branch, setBranch] = React.useState("main");
  const [browserMode] = React.useState(() => !isTauri());
  const [expandedDiffPath, setExpandedDiffPath] = React.useState<string | null>(
    null,
  );

  const toggleDiff = (path: string): void => {
    setExpandedDiffPath((prev) => (prev === path ? null : path));
  };

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!isTauri()) {
      setFiles(MOCK_FILES);
      setBranch("main");
      return;
    }
    const statusOut = await runGit([
      "-C",
      projectFolder,
      "status",
      "--porcelain",
    ]);
    const branchOut = await runGit([
      "-C",
      projectFolder,
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    setBranch(branchOut.trim() || "main");
    const parsed: FileStatus[] = statusOut
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const code = line.slice(0, 2);
        const path = line.slice(3).trim();
        const staged = code[0] !== " " && code[0] !== "?";
        const status: FileStatus["status"] = code.includes("D")
          ? "deleted"
          : code.includes("?")
            ? "untracked"
            : code.includes("A")
              ? "added"
              : "modified";
        return { path, status, staged };
      });

    // Fetch per-file diffs
    const withDiffs = await Promise.all(
      parsed.map(async (f): Promise<FileStatus> => {
        if (f.status === "untracked") return f;
        const diffArgs = f.staged
          ? ["-C", projectFolder, "diff", "--staged", "--", f.path]
          : ["-C", projectFolder, "diff", "--", f.path];
        const diff = await runGit(diffArgs);
        const trimmed = diff.trim();
        return trimmed !== "" ? { ...f, diff: trimmed } : { ...f };
      }),
    );

    setFiles(withDiffs);
  }, [projectFolder]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const stageFile = async (path: string): Promise<void> => {
    await runGit(["-C", projectFolder, "add", path]);
    void refresh();
  };

  const unstageFile = async (path: string): Promise<void> => {
    await runGit(["-C", projectFolder, "reset", "HEAD", path]);
    void refresh();
  };

  const commit = async (): Promise<void> => {
    if (!commitMsg.trim()) return;
    setLoading(true);
    const out = await runGit(["-C", projectFolder, "commit", "-m", commitMsg]);
    addLog("info", `git commit: ${out.split("\n")[0]}`, "GitPanel");
    setCommitMsg("");
    setLoading(false);
    void refresh();
  };

  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => !f.staged);

  const btnBase: React.CSSProperties = {
    padding: "1px 6px",
    background: "var(--es-surface)",
    border: "1px solid var(--es-border)",
    borderRadius: 3,
    color: "var(--es-text)",
    cursor: "pointer",
    fontSize: 10,
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
        // Define diff palette tokens scoped to the panel
        ["--es-diff-add-bg" as string]:
          "color-mix(in srgb, var(--es-green) 12%, transparent)",
        ["--es-diff-rm-bg" as string]:
          "color-mix(in srgb, var(--es-red) 12%, transparent)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "6px 12px",
          borderBottom: "1px solid var(--es-border)",
          background: "var(--es-surface)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 600 }}>
          Git{" "}
          <span style={{ color: "var(--es-accent)", fontWeight: 400 }}>
            {branch}
          </span>
        </span>
        <button onClick={() => void refresh()} style={btnBase}>
          Refresh
        </button>
      </div>

      {/* File list */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Browser-mode disclaimer */}
        {browserMode && (
          <div
            style={{
              padding: "6px 12px",
              background:
                "color-mix(in srgb, var(--es-yellow) 10%, transparent)",
              borderBottom: "1px solid var(--es-yellow)",
              color: "var(--es-yellow)",
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            Preview — no git repo connected
          </div>
        )}

        {/* Staged */}
        <div
          style={{
            padding: "6px 12px 2px",
            color: "var(--es-text-muted)",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          STAGED ({staged.length})
        </div>
        {staged.map((f) => (
          <FileRow
            key={f.path}
            f={f}
            expanded={expandedDiffPath === f.path}
            onToggle={() => toggleDiff(f.path)}
            action={
              <button onClick={() => void unstageFile(f.path)} style={btnBase}>
                -
              </button>
            }
          />
        ))}

        {/* Unstaged */}
        <div
          style={{
            padding: "6px 12px 2px",
            color: "var(--es-text-muted)",
            fontSize: 11,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          UNSTAGED ({unstaged.length})
        </div>
        {unstaged.map((f) => (
          <FileRow
            key={f.path}
            f={f}
            expanded={expandedDiffPath === f.path}
            onToggle={() => toggleDiff(f.path)}
            action={
              <button
                onClick={() => void stageFile(f.path)}
                style={{
                  padding: "1px 6px",
                  background: "var(--es-accent)",
                  border: "none",
                  borderRadius: 3,
                  color: "var(--es-text-on-accent)",
                  cursor: "pointer",
                  fontSize: 10,
                }}
              >
                +
              </button>
            }
          />
        ))}

        {browserMode && files.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--es-text-muted)" }}>
            Git is available in the desktop app
          </div>
        )}
        {!browserMode && files.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--es-text-muted)" }}>
            Nothing changed. Enjoy it while it lasts.
          </div>
        )}
      </div>

      {/* Commit */}
      <div
        style={{
          borderTop: "1px solid var(--es-border)",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="Commit message (Ctrl+Enter to commit)..."
          rows={2}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void commit();
          }}
          style={{
            padding: "4px 8px",
            background: "var(--es-bg)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            resize: "none",
            fontSize: 12,
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={() => void commit()}
          disabled={!commitMsg.trim() || staged.length === 0 || loading}
          style={{
            padding: "5px 0",
            background:
              commitMsg.trim() && staged.length > 0
                ? "var(--es-accent)"
                : "var(--es-surface)",
            border: "none",
            borderRadius: 4,
            color:
              commitMsg.trim() && staged.length > 0
                ? "var(--es-text-on-accent)"
                : "var(--es-text-muted)",
            cursor:
              commitMsg.trim() && staged.length > 0 ? "pointer" : "default",
            fontWeight: 600,
          }}
        >
          {loading
            ? "Committing..."
            : `Commit (${staged.length} file${staged.length !== 1 ? "s" : ""})`}
        </button>
      </div>
    </div>
  );
}
