import React from "react";
import { useIDEStore } from "../../store/ideStore";

interface FileStatus {
  path: string;
  status: "modified" | "added" | "deleted" | "untracked";
  staged: boolean;
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

export function GitPanel(): React.ReactElement {
  const { projectFolder, addLog } = useIDEStore();
  const [files, setFiles] = React.useState<FileStatus[]>([]);
  const [commitMsg, setCommitMsg] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [branch, setBranch] = React.useState("main");
  const [browserMode] = React.useState(() => !isTauri());

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!isTauri()) {
      setFiles([]);
      setBranch("");
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
    setFiles(parsed);
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

  const statusColor = (s: FileStatus["status"]): string =>
    ({
      modified: "#fbbf24",
      added: "#4ade80",
      deleted: "#ef4444",
      untracked: "#94a3b8",
    })[s];

  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => !f.staged);

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
        <button
          onClick={() => void refresh()}
          style={{
            padding: "2px 8px",
            background: "var(--es-surface)",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
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
          <div
            key={f.path}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "3px 12px",
              gap: 8,
            }}
          >
            <span
              style={{
                color: statusColor(f.status),
                width: 8,
                fontWeight: 700,
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
            <button
              onClick={() => void unstageFile(f.path)}
              style={{
                padding: "1px 6px",
                background: "var(--es-surface)",
                border: "1px solid var(--es-border)",
                borderRadius: 3,
                color: "var(--es-text)",
                cursor: "pointer",
                fontSize: 10,
              }}
            >
              -
            </button>
          </div>
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
          <div
            key={f.path}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "3px 12px",
              gap: 8,
            }}
          >
            <span
              style={{
                color: statusColor(f.status),
                width: 8,
                fontWeight: 700,
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
            <button
              onClick={() => void stageFile(f.path)}
              style={{
                padding: "1px 6px",
                background: "var(--es-accent)",
                border: "none",
                borderRadius: 3,
                color: "#fff",
                cursor: "pointer",
                fontSize: 10,
              }}
            >
              +
            </button>
          </div>
        ))}

        {browserMode && (
          <div style={{ padding: "16px 12px", color: "var(--es-text-muted)" }}>
            Git is available in the desktop app
          </div>
        )}
        {!browserMode && files.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--es-text-muted)" }}>
            Working tree clean
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
                ? "#fff"
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
