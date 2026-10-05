import React from "react";
import type { AssetItem } from "../../../store/ideStore";
import { AssetIcon, AssetIconSmall, formatSize } from "./helpers";

export const POPOVER_WIDTH = 224;

export interface AssetPreviewPopoverProps {
  asset: AssetItem;
  anchorRect: DOMRect;
  openFiles: Record<string, string>;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

export function AssetPreviewPopover({
  asset,
  anchorRect,
  openFiles,
  onPointerEnter,
  onPointerLeave,
}: AssetPreviewPopoverProps): React.ReactElement {
  const flipLeft = anchorRect.right + POPOVER_WIDTH + 16 > window.innerWidth;
  const left = flipLeft
    ? anchorRect.left - POPOVER_WIDTH - 8
    : anchorRect.right + 8;
  const top = Math.min(anchorRect.top, window.innerHeight - 300);

  let previewContent: React.ReactElement;

  if (asset.type === "image") {
    previewContent = (
      <div
        style={{
          background: "var(--es-bg)",
          borderRadius: 4,
          border: "1px solid var(--es-border)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 80,
        }}
      >
        <img
          src={asset.path}
          alt=""
          style={{
            maxWidth: "100%",
            maxHeight: 180,
            objectFit: "contain",
            display: "block",
            imageRendering: "pixelated",
          }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = "none";
            const parent = el.parentElement;
            if (parent !== null) {
              parent.style.minHeight = "36px";
              const msg = document.createElement("span");
              msg.textContent = "Preview unavailable";
              msg.style.cssText =
                "font-size:10px;color:var(--es-text-muted);padding:8px;";
              parent.appendChild(msg);
            }
          }}
        />
      </div>
    );
  } else if (asset.type === "audio") {
    const bars = Array.from({ length: 28 }, (_, i) => {
      const h = Math.round(10 + Math.abs(Math.sin(i * 0.65)) * 22);
      return h;
    });
    previewContent = (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            height: 48,
            borderRadius: 4,
            background: "var(--es-bg)",
            border: "1px solid var(--es-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            padding: "0 8px",
            overflow: "hidden",
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                background: "var(--es-accent)",
                borderRadius: 2,
                opacity: 0.65,
                flexShrink: 0,
              }}
            />
          ))}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "var(--es-text-muted)",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          Audio file — no duration data
        </div>
      </div>
    );
  } else if (asset.type === "script") {
    const fileContent = openFiles[asset.path];
    const lines =
      fileContent !== undefined
        ? fileContent.split("\n").slice(0, 5).join("\n")
        : "// Source not open in editor";
    previewContent = (
      <pre
        style={{
          margin: 0,
          fontSize: 9.5,
          lineHeight: 1.55,
          color: "var(--es-text-muted)",
          fontFamily: "JetBrains Mono, monospace",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          maxHeight: 110,
          overflow: "hidden",
          background: "var(--es-bg)",
          border: "1px solid var(--es-border)",
          borderRadius: 4,
          padding: "6px 8px",
        }}
      >
        {lines}
      </pre>
    );
  } else if (asset.type === "scene" || asset.type === "json") {
    // Metadata-only preview for a scene/prefab JSON asset: this counts
    // entities/prefab instances and distinct component types when the
    // file happens to already be open in the editor (`openFiles`) and
    // parses as a real SceneFile/PrefabFile shape. There is no offline
    // asset-content reader here, so a scene/prefab that isn't currently
    // open in a Code tab falls back to the plain path+size metadata below
    // — an honest v1, not a full asset-database preview.
    const fileContent = openFiles[asset.path];
    let summary: React.ReactElement | null = null;
    if (fileContent !== undefined) {
      try {
        const parsed: unknown = JSON.parse(fileContent);
        if (parsed !== null && typeof parsed === "object") {
          const obj = parsed as Record<string, unknown>;
          // v2 scene documents list every entity in `entities`; v1 scenes list
          // prefab instances in `prefabInstances`; a prefab file is one entry.
          const instances =
            obj["formatVersion"] === 2 && Array.isArray(obj["entities"])
              ? (obj["entities"] as unknown[])
              : Array.isArray(obj["prefabInstances"])
                ? (obj["prefabInstances"] as unknown[])
                : Array.isArray(obj["components"])
                  ? [obj]
                  : [];
          const componentTypes = new Set<string>();
          for (const inst of instances) {
            if (inst !== null && typeof inst === "object") {
              const comps = (inst as Record<string, unknown>)["components"];
              if (
                comps !== null &&
                typeof comps === "object" &&
                !Array.isArray(comps)
              ) {
                for (const name of Object.keys(comps)) componentTypes.add(name);
              } else if (Array.isArray(comps)) {
                for (const c of comps) {
                  if (c !== null && typeof c === "object" && "type" in c) {
                    componentTypes.add(String((c as { type: unknown }).type));
                  }
                }
              }
            }
          }
          summary = (
            <div
              style={{
                fontSize: 10,
                color: "var(--es-text-muted)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span>
                {instances.length}{" "}
                {instances.length === 1 ? "entity" : "entities"}
              </span>
              <span>
                {componentTypes.size}{" "}
                {componentTypes.size === 1
                  ? "component type"
                  : "component types"}
              </span>
            </div>
          );
        }
      } catch {
        summary = null;
      }
    }
    previewContent = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: "8px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AssetIcon type={asset.type} />
          <span
            style={{
              fontSize: 11,
              color: "var(--es-text-muted)",
              wordBreak: "break-all",
            }}
          >
            {asset.path}
          </span>
        </div>
        {summary ?? (
          <span
            style={{ fontSize: 9, color: "var(--es-text-muted)", opacity: 0.7 }}
          >
            Open it in the Code tab for an entity/component count.
          </span>
        )}
      </div>
    );
  } else {
    previewContent = (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 0",
        }}
      >
        <AssetIcon type={asset.type} />
        <span
          style={{
            fontSize: 11,
            color: "var(--es-text-muted)",
            wordBreak: "break-all",
          }}
        >
          {asset.path}
        </span>
      </div>
    );
  }

  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 9999,
        width: POPOVER_WIDTH,
        background: "var(--es-surface)",
        border: "1px solid var(--es-border)",
        borderRadius: 8,
        padding: 10,
        boxShadow: "0 4px 24px rgba(0,0,0,0.3), 0 1px 4px rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        pointerEvents: "auto",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          borderBottom: "1px solid var(--es-border)",
          paddingBottom: 7,
        }}
      >
        <AssetIconSmall type={asset.type} />
        <span
          style={{
            flex: 1,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--es-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {asset.name}
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--es-text-muted)",
            background: "var(--es-surface-2)",
            border: "1px solid var(--es-border)",
            borderRadius: 3,
            padding: "1px 4px",
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {asset.type}
        </span>
      </div>

      {previewContent}

      {asset.size !== undefined && (
        <div
          style={{
            fontSize: 9,
            color: "var(--es-text-muted)",
            opacity: 0.7,
          }}
        >
          {formatSize(asset.size)}
        </div>
      )}
    </div>
  );
}
