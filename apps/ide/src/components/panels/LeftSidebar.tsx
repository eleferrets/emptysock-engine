import React, { useState } from "react";
import {
  Folder,
  FileCode,
  FileImage,
  FileAudio,
  FileJson,
  ChevronRight,
  ChevronDown,
  Layers,
  ImageIcon,
  Music,
  Box,
  Clock,
  X,
} from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import type { ProjectFile } from "../../store/ideStore";

function FileIcon({ file }: { file: ProjectFile }): React.ReactElement {
  if (file.type === "folder")
    return <Folder size={13} style={{ color: "var(--yellow)" }} />;
  const ext = file.name.split(".").pop() ?? "";
  if (["ts", "tsx", "js"].includes(ext))
    return <FileCode size={13} style={{ color: "var(--blue)" }} />;
  if (["png", "jpg", "svg", "webp"].includes(ext))
    return <FileImage size={13} style={{ color: "var(--green)" }} />;
  if (["ogg", "mp3", "wav"].includes(ext))
    return <FileAudio size={13} style={{ color: "var(--accent)" }} />;
  if (ext === "json")
    return <FileJson size={13} style={{ color: "var(--yellow)" }} />;
  return <FileCode size={13} style={{ color: "var(--text-muted)" }} />;
}

function FileTreeNode({
  file,
  depth = 0,
}: {
  file: ProjectFile;
  depth?: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth < 2);
  const { selectedFile, selectFile, setActiveTab } = useIDEStore();

  const isSelected = selectedFile === file.path;
  const handleClick = (): void => {
    if (file.type === "folder") {
      setExpanded((e) => !e);
    } else {
      selectFile(file.path);
      setActiveTab("code");
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        className="flex items-center w-full gap-1 py-0.5 pr-2 rounded text-left transition-colors"
        style={{
          paddingLeft: `${8 + depth * 12}px`,
          background: isSelected ? "rgba(124,106,247,0.15)" : undefined,
          color: isSelected ? "var(--accent)" : "var(--text-muted)",
        }}
        onMouseEnter={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLElement).style.background =
              "var(--surface-2)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLElement).style.background = "";
        }}
      >
        {file.type === "folder" && (
          <span
            style={{ color: "var(--text-muted)", opacity: 0.6, flexShrink: 0 }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        )}
        {file.type === "file" && <span style={{ width: 10, flexShrink: 0 }} />}
        <FileIcon file={file} />
        <span className="truncate text-xs">{file.name}</span>
      </button>

      {file.type === "folder" && expanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileTreeNode key={child.path} file={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecentFilesSection(): React.ReactElement {
  const { recentFiles, openFile, clearRecentFiles } = useIDEStore();
  const [collapsed, setCollapsed] = useState(false);

  if (recentFiles.length === 0) return <></>;

  return (
    <div style={{ borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center w-full gap-1 px-3 h-7"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ marginRight: 2 }}>
          {collapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
        </span>
        <Clock size={11} />
        <span
          className="text-[10px] uppercase tracking-widest font-semibold flex-1 text-left"
          style={{ marginLeft: 4 }}
        >
          Recent
        </span>
        <span
          role="button"
          title="Clear recent"
          onClick={(e) => {
            e.stopPropagation();
            clearRecentFiles();
          }}
          style={{
            opacity: 0.4,
            display: "flex",
            alignItems: "center",
            padding: 2,
            borderRadius: 3,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.4";
          }}
        >
          <X size={10} />
        </span>
      </button>

      {!collapsed && (
        <div className="py-0.5">
          {recentFiles.map((rf) => (
            <button
              key={rf.path}
              onClick={() => openFile(rf.path)}
              className="flex items-center w-full gap-1.5 py-0.5 pr-2 text-left transition-colors truncate"
              style={{
                paddingLeft: 20,
                color: "var(--text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--surface-2)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "";
              }}
              title={rf.path}
            >
              <FileCode
                size={11}
                style={{
                  flexShrink: 0,
                  color: "var(--text-muted)",
                  opacity: 0.7,
                }}
              />
              <span className="truncate text-xs">{rf.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type SidebarSection = "files" | "tools" | "images" | "audio";

export function LeftSidebar(): React.ReactElement {
  const { files } = useIDEStore();
  const [section, setSection] = useState<SidebarSection>("files");

  return (
    <aside
      className="flex h-full"
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      {/* Icon rail */}
      <div
        className="flex flex-col items-center gap-1 py-2"
        style={{
          width: 36,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          background: "var(--bg)",
        }}
      >
        {[
          { id: "files", icon: <Layers size={15} />, label: "Project" },
          { id: "tools", icon: <Box size={15} />, label: "Components" },
          { id: "images", icon: <ImageIcon size={15} />, label: "Textures" },
          { id: "audio", icon: <Music size={15} />, label: "Audio" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id as SidebarSection)}
            title={item.label}
            className="w-7 h-7 flex items-center justify-center rounded transition-colors"
            style={{
              color:
                section === item.id ? "var(--accent)" : "var(--text-muted)",
              background:
                section === item.id ? "rgba(124,106,247,0.15)" : undefined,
            }}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div
          className="flex items-center px-3 h-8 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="text-[10px] uppercase tracking-widest font-semibold"
            style={{ color: "var(--text-muted)" }}
          >
            {section === "files"
              ? "Project"
              : section === "tools"
                ? "Components"
                : section === "images"
                  ? "Textures"
                  : "Audio"}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {section === "files" && <RecentFilesSection />}
          <div className="py-1">
            {section === "files" && (
              <>
                {files.map((file) => (
                  <FileTreeNode key={file.path} file={file} />
                ))}
              </>
            )}

            {section === "tools" && (
              <div className="px-3 py-4">
                {[
                  { name: "Transform", color: "var(--blue)" },
                  { name: "Sprite", color: "var(--green)" },
                  { name: "PhysicsBody", color: "var(--yellow)" },
                  { name: "CharacterController", color: "var(--accent)" },
                  { name: "Animator", color: "var(--red)" },
                  { name: "AudioSource", color: "var(--accent)" },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center gap-2 px-2 py-1.5 rounded mb-0.5 cursor-grab text-xs"
                    style={{ color: "var(--text-muted)" }}
                    draggable
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: c.color }}
                    />
                    {c.name}
                  </div>
                ))}
              </div>
            )}

            {(section === "images" || section === "audio") && (
              <div
                className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
                style={{ color: "var(--text-muted)", fontSize: 11 }}
              >
                {section === "images" ? (
                  <ImageIcon size={24} strokeWidth={1} />
                ) : (
                  <Music size={24} strokeWidth={1} />
                )}
                <span>
                  {section === "images" ? "Texture" : "Audio"} browser coming
                  soon.
                  <br />
                  Use the Asset panel below.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
