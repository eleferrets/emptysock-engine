import React from "react";
import { useIDEStore } from "../../store/ideStore";

interface FileStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked";
  staged: boolean;
  diff?: string;
}

interface CommitEntry {
  hash: string;
  author: string;
  date: string;
  subject: string;
}

const isTauri = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface GitResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

/**
 * Runs `git <args>` in `projectDir` via the `run_git` Tauri command — a
 * plain `std::process::Command` spawn (see lib.rs), not the
 * `tauri-plugin-shell` JS API, so no shell-execute scope config is needed
 * and a commit message or file path containing shell metacharacters is
 * never at risk of injection (args go straight into a real `Vec`, never
 * through a shell). Returns the raw result rather than just stdout so
 * callers can surface a real error (e.g. "not a git repository", "nothing
 * to commit", a failed push) instead of silently swallowing it.
 */
async function runGit(projectDir: string, args: string[]): Promise<GitResult> {
  if (!isTauri()) {
    return { success: false, stdout: "", stderr: "git unavailable in browser" };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    return await invoke<GitResult>("run_git", { projectDir, args });
  } catch (e) {
    return { success: false, stdout: "", stderr: String(e) };
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

const MOCK_COMMITS: CommitEntry[] = [
  {
    hash: "a1b2c3d",
    author: "You",
    date: "2026-09-23",
    subject: "feat(player): tune movement speed",
  },
  {
    hash: "e4f5a6b",
    author: "You",
    date: "2026-09-22",
    subject: "feat(scenes): add menu scene",
  },
  {
    hash: "c7d8e9f",
    author: "You",
    date: "2026-09-21",
    subject: "chore: initial commit",
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

// ── History (commit log) ────────────────────────────────────────────────────
function HistoryView({
  commits,
  browserMode,
}: {
  commits: CommitEntry[];
  browserMode: boolean;
}): React.ReactElement {
  if (commits.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 12px",
          color: "var(--es-text-muted)",
        }}
      >
        {browserMode
          ? "Commit history is available in the desktop app"
          : "No commits yet — make one from the Changes tab."}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {commits.map((c) => (
        <div
          key={c.hash}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            padding: "6px 12px",
            borderBottom: "1px solid var(--es-border)",
          }}
        >
          <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {c.subject}
          </div>
          <div style={{ fontSize: 10, color: "var(--es-text-muted)" }}>
            <span
              style={{ fontFamily: "monospace", color: "var(--es-accent)" }}
            >
              {c.hash.slice(0, 7)}
            </span>{" "}
            · {c.author} · {c.date}
          </div>
        </div>
      ))}
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
  const [commits, setCommits] = React.useState<CommitEntry[]>([]);
  const [tab, setTab] = React.useState<"changes" | "history">("changes");
  const [pushing, setPushing] = React.useState(false);
  const [ahead, setAhead] = React.useState(0);

  const toggleDiff = (path: string): void => {
    setExpandedDiffPath((prev) => (prev === path ? null : path));
  };

  const git = React.useCallback(
    (args: string[]) => runGit(projectFolder, args),
    [projectFolder],
  );

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!isTauri()) {
      setFiles(MOCK_FILES);
      setBranch("main");
      setCommits(MOCK_COMMITS);
      return;
    }
    const [statusOut, branchOut, logOut, aheadOut] = await Promise.all([
      git(["status", "--porcelain"]),
      git(["rev-parse", "--abbrev-ref", "HEAD"]),
      git([
        "log",
        "-30",
        "--pretty=format:%H%x1f%an%x1f%ad%x1f%s",
        "--date=short",
      ]),
      git(["rev-list", "--count", "@{u}..HEAD"]),
    ]);
    setBranch(branchOut.stdout.trim() || "main");
    setAhead(Number.parseInt(aheadOut.stdout.trim(), 10) || 0);
    setCommits(
      logOut.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [hash = "", author = "", date = "", subject = ""] =
            line.split("\x1f");
          return { hash, author, date, subject };
        }),
    );

    const parsed: FileStatus[] = statusOut.stdout
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
          ? ["diff", "--staged", "--", f.path]
          : ["diff", "--", f.path];
        const diff = await git(diffArgs);
        const trimmed = diff.stdout.trim();
        return trimmed !== "" ? { ...f, diff: trimmed } : { ...f };
      }),
    );

    setFiles(withDiffs);
  }, [git]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const stageFile = async (path: string): Promise<void> => {
    await git(["add", path]);
    void refresh();
  };

  const unstageFile = async (path: string): Promise<void> => {
    await git(["reset", "HEAD", path]);
    void refresh();
  };

  const commit = async (): Promise<void> => {
    if (!commitMsg.trim()) return;
    setLoading(true);
    const result = await git(["commit", "-m", commitMsg]);
    const firstLine = (result.success ? result.stdout : result.stderr).split(
      "\n",
    )[0];
    addLog(
      result.success ? "info" : "error",
      `git commit: ${firstLine ?? "(no output)"}`,
      "GitPanel",
    );
    setCommitMsg("");
    setLoading(false);
    void refresh();
  };

  const push = async (): Promise<void> => {
    setPushing(true);
    const result = await git(["push"]);
    const firstLine = (result.success ? result.stdout : result.stderr)
      .trim()
      .split("\n")
      .pop();
    addLog(
      result.success ? "info" : "error",
      `git push: ${firstLine ?? "(no output)"}`,
      "GitPanel",
    );
    setPushing(false);
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
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            onClick={() => void push()}
            disabled={pushing || browserMode}
            title={
              browserMode
                ? "Push is available in the desktop app"
                : "Push committed changes to the remote"
            }
            style={btnBase}
          >
            {pushing ? "Pushing…" : ahead > 0 ? `Push (${ahead})` : "Push"}
          </button>
          <button onClick={() => void refresh()} style={btnBase}>
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--es-border)",
          flexShrink: 0,
        }}
      >
        {(
          [
            { id: "changes", label: `Changes (${files.length})` },
            { id: "history", label: "History" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "6px 0",
              background: "transparent",
              border: "none",
              borderBottom:
                tab === t.id
                  ? "2px solid var(--es-accent)"
                  : "2px solid transparent",
              color: tab === t.id ? "var(--es-text)" : "var(--es-text-muted)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: tab === t.id ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "changes" ? (
        <>
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
                  <button
                    onClick={() => void unstageFile(f.path)}
                    style={btnBase}
                  >
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
              <div
                style={{ padding: "16px 12px", color: "var(--es-text-muted)" }}
              >
                Git is available in the desktop app
              </div>
            )}
            {!browserMode && files.length === 0 && (
              <div
                style={{ padding: "16px 12px", color: "var(--es-text-muted)" }}
              >
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
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
                  void commit();
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
        </>
      ) : (
        <HistoryView commits={commits} browserMode={browserMode} />
      )}
    </div>
  );
}
