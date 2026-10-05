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
  FolderOpen,
} from "lucide-react";
import { useIDEStore } from "../../store/ideStore";
import type { ProjectFile, FileTreeNode } from "../../store/ideStore";
import { ProjectService } from "../../services/ProjectService";
import { ContextMenu } from "../ui/ContextMenu";
import type { ContextMenuEntry } from "../ui/ContextMenu";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp"]);
const BINARY_EXT = new Set([
  "ogg",
  "mp3",
  "wav",
  "ttf",
  "otf",
  "woff",
  "woff2",
  "svg",
  "ico",
  "zip",
  "wasm",
]);

/**
 * Open a tree file in the right place: text in the code editor, images in
 * the image editor (when the file is a known asset), other binaries are only
 * selected (they would show as garbage in a text editor).
 */
function openTreeFile(
  path: string,
  readText?: () => Promise<string | null>,
): void {
  const store = useIDEStore.getState();
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (IMAGE_EXT.has(ext)) {
    const name = path.split("/").pop() ?? path;
    const asset = store.assets.find(
      (a) => a.path === path || a.path.endsWith(`/${name}`) || a.name === name,
    );
    if (asset !== undefined) {
      store.openImageEditor(asset.id);
      return;
    }
    store.addLog("info", `${name}: import it as an asset to edit it`, "IDE");
    return;
  }
  if (BINARY_EXT.has(ext)) {
    store.addLog("info", `${path}: binary file, not opened`, "IDE");
    return;
  }
  const show = (content?: string): void => {
    store.openFile(path, content);
    store.setActiveTab("code");
    store.requestOpenPanel("code");
  };
  if (readText === undefined) show();
  else void readText().then((c) => show(c ?? ""));
}

type MenuPos = { x: number; y: number };

function copyPath(path: string): void {
  void navigator.clipboard.writeText(path).catch(() => {});
}

function rowMenuItems(
  isFolder: boolean,
  path: string,
  open: () => void,
  toggle: () => void,
): ContextMenuEntry[] {
  return [
    isFolder
      ? { label: "Expand / Collapse", onClick: toggle }
      : { label: "Open", onClick: open },
    { separator: true },
    { label: "Copy Path", onClick: () => copyPath(path) },
  ];
}

function FileIcon({ file }: { file: ProjectFile }): React.ReactElement {
  if (file.type === "folder")
    return <Folder size={13} style={{ color: "var(--es-yellow)" }} />;
  const ext = file.name.split(".").pop() ?? "";
  if (["ts", "tsx", "js"].includes(ext))
    return <FileCode size={13} style={{ color: "var(--es-blue)" }} />;
  if (["png", "jpg", "svg", "webp"].includes(ext))
    return <FileImage size={13} style={{ color: "var(--es-green)" }} />;
  if (["ogg", "mp3", "wav"].includes(ext))
    return <FileAudio size={13} style={{ color: "var(--es-accent)" }} />;
  if (ext === "json")
    return <FileJson size={13} style={{ color: "var(--es-yellow)" }} />;
  return <FileCode size={13} style={{ color: "var(--es-text-muted)" }} />;
}

function FileTreeNode({
  file,
  depth = 0,
}: {
  file: ProjectFile;
  depth?: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth < 2);
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const selectedFile = useIDEStore((s) => s.selectedFile);

  const isSelected = selectedFile === file.path;
  const handleClick = (): void => {
    if (file.type === "folder") {
      setExpanded((e) => !e);
    } else {
      openTreeFile(file.path);
    }
  };

  return (
    <div>
      {menu !== null && (
        <ContextMenu
          items={rowMenuItems(
            file.type === "folder",
            file.path,
            handleClick,
            handleClick,
          ).map((i) =>
            "onClick" in i
              ? {
                  ...i,
                  onClick: () => {
                    i.onClick();
                    setMenu(null);
                  },
                }
              : i,
          )}
          position={menu}
          onClose={() => setMenu(null)}
        />
      )}
      <button
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        className="flex items-center w-full gap-1 py-0.5 pr-2 rounded text-left transition-colors"
        style={{
          paddingLeft: `${8 + depth * 12}px`,
          background: isSelected ? "var(--es-selection-bg)" : undefined,
          color: isSelected ? "var(--es-accent)" : "var(--es-text-muted)",
        }}
        onMouseEnter={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLElement).style.background =
              "var(--es-surface-2)";
        }}
        onMouseLeave={(e) => {
          if (!isSelected)
            (e.currentTarget as HTMLElement).style.background = "";
        }}
      >
        {file.type === "folder" && (
          <span
            style={{
              color: "var(--es-text-muted)",
              opacity: 0.6,
              flexShrink: 0,
            }}
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

function diskFileIcon(name: string): React.ReactElement {
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  if (["ts", "tsx", "js", "jsx"].includes(ext))
    return <FileCode size={13} style={{ color: "var(--es-blue)" }} />;
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext))
    return <FileImage size={13} style={{ color: "var(--es-green)" }} />;
  if (["ogg", "mp3", "wav"].includes(ext))
    return <FileAudio size={13} style={{ color: "var(--es-accent)" }} />;
  if (ext === "json" || ext === "emptysock")
    return <FileJson size={13} style={{ color: "var(--es-yellow)" }} />;
  return <FileCode size={13} style={{ color: "var(--es-text-muted)" }} />;
}

function DiskTreeRow({
  node,
  depth = 0,
}: {
  node: FileTreeNode;
  depth?: number;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(depth < 2);
  const [menu, setMenu] = useState<MenuPos | null>(null);
  const isFolder = node.children !== undefined;

  const handleClick = (): void => {
    if (isFolder) {
      setExpanded((e) => !e);
    } else {
      openTreeFile(node.path, () => ProjectService.readFile(node.path));
    }
  };

  return (
    <div>
      {menu !== null && (
        <ContextMenu
          items={rowMenuItems(
            isFolder,
            node.path,
            handleClick,
            handleClick,
          ).map((i) =>
            "onClick" in i
              ? {
                  ...i,
                  onClick: () => {
                    i.onClick();
                    setMenu(null);
                  },
                }
              : i,
          )}
          position={menu}
          onClose={() => setMenu(null)}
        />
      )}
      <button
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        className="flex items-center w-full gap-1 py-0.5 pr-2 rounded text-left transition-colors"
        style={{
          paddingLeft: `${8 + depth * 12}px`,
          color: "var(--es-text-muted)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background =
            "var(--es-surface-2)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "";
        }}
      >
        {isFolder ? (
          <span
            style={{
              color: "var(--es-text-muted)",
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </span>
        ) : (
          <span style={{ width: 10, flexShrink: 0 }} />
        )}
        {isFolder ? (
          <Folder
            size={13}
            style={{ color: "var(--es-yellow)", flexShrink: 0 }}
          />
        ) : (
          diskFileIcon(node.name)
        )}
        <span className="truncate text-xs ml-0.5">{node.name}</span>
      </button>

      {isFolder && expanded && node.children !== undefined && (
        <div>
          {node.children.map((child) => (
            <DiskTreeRow key={child.path} node={child} depth={depth + 1} />
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
    <div style={{ borderBottom: "1px solid var(--es-border)", flexShrink: 0 }}>
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center w-full gap-1 px-3 h-7"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--es-text-muted)",
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
                color: "var(--es-text-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--es-surface-2)";
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
                  color: "var(--es-text-muted)",
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
  const fileTree = useIDEStore((s) => s.fileTree);
  const projectRoot = useIDEStore((s) => s.projectRoot);
  const [section, setSection] = useState<SidebarSection>("files");

  return (
    <aside
      className="flex h-full"
      style={{
        width: 240,
        flexShrink: 0,
        borderRight: "1px solid var(--es-border)",
        background: "var(--es-surface)",
      }}
    >
      {/* Icon rail */}
      <div
        className="flex flex-col items-center gap-1 py-2"
        style={{
          width: 36,
          flexShrink: 0,
          borderRight: "1px solid var(--es-border)",
          background: "var(--es-bg)",
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
            style={{
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              border: "none",
              background:
                section === item.id ? "var(--es-selection-bg)" : "transparent",
              color:
                section === item.id
                  ? "var(--es-accent)"
                  : "var(--es-text-muted)",
              cursor: "pointer",
              flexShrink: 0,
              padding: 0,
            }}
          >
            {item.icon}
          </button>
        ))}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div
          className="flex items-center px-3 h-8 flex-shrink-0 gap-1"
          style={{ borderBottom: "1px solid var(--es-border)" }}
        >
          <span
            className="text-[10px] uppercase tracking-widest font-semibold flex-1 truncate"
            style={{ color: "var(--es-text-muted)" }}
            title={projectRoot ?? undefined}
          >
            {section === "files"
              ? (projectRoot ?? "Project")
              : section === "tools"
                ? "Components"
                : section === "images"
                  ? "Textures"
                  : "Audio"}
          </span>
          {section === "files" && (
            <button
              title="Open folder"
              onClick={() => {
                void ProjectService.openDirectory();
              }}
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                padding: 3,
                borderRadius: 3,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--es-text-muted)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = "var(--es-text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color =
                  "var(--es-text-muted)";
              }}
            >
              <FolderOpen size={13} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {section === "files" && <RecentFilesSection />}
          <div className="py-1">
            {section === "files" && (
              <>
                {fileTree.length > 0
                  ? fileTree.map((node) => (
                      <DiskTreeRow key={node.path} node={node} />
                    ))
                  : files.map((file) => (
                      <FileTreeNode key={file.path} file={file} />
                    ))}
                {fileTree.length === 0 && files.length === 0 && (
                  <div
                    style={{
                      padding: "20px 12px",
                      textAlign: "center",
                      color: "var(--es-text-muted)",
                      fontSize: 11,
                    }}
                  >
                    <p style={{ marginBottom: 4 }}>
                      Click the folder icon above to open a project directory.
                    </p>
                    <p style={{ fontSize: 10, opacity: 0.6 }}>
                      Or add files in the code editor.
                    </p>
                  </div>
                )}
              </>
            )}

            {section === "tools" && (
              <div className="px-3 py-4">
                {[
                  { name: "Transform", color: "var(--es-blue)" },
                  { name: "Sprite", color: "var(--es-green)" },
                  { name: "PhysicsBody", color: "var(--es-yellow)" },
                  { name: "CharacterController", color: "var(--es-accent)" },
                  { name: "Animator", color: "var(--es-red)" },
                  { name: "AudioSource", color: "var(--es-accent)" },
                ].map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center gap-2 px-2 py-1.5 rounded mb-0.5 cursor-grab text-xs"
                    style={{ color: "var(--es-text-muted)" }}
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
                style={{ color: "var(--es-text-muted)", fontSize: 11 }}
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
