import React from "react";
import { Image, Music, FileCode, FileJson } from "lucide-react";
import type { AssetItem } from "../../../store/ideStore";

export function AssetIcon({
  type,
}: {
  type: AssetItem["type"];
}): React.ReactElement {
  const props = { size: 20, strokeWidth: 1.5 };
  switch (type) {
    case "image":
      return <Image {...props} style={{ color: "var(--es-green)" }} />;
    case "audio":
      return <Music {...props} style={{ color: "var(--es-accent)" }} />;
    case "script":
      return <FileCode {...props} style={{ color: "var(--es-blue)" }} />;
    case "json":
      return <FileJson {...props} style={{ color: "var(--es-yellow)" }} />;
    default:
      return <FileCode {...props} style={{ color: "var(--es-text-muted)" }} />;
  }
}

export function AssetIconSmall({
  type,
}: {
  type: AssetItem["type"];
}): React.ReactElement {
  const props = { size: 14, strokeWidth: 1.5 };
  switch (type) {
    case "image":
      return <Image {...props} style={{ color: "var(--es-green)" }} />;
    case "audio":
      return <Music {...props} style={{ color: "var(--es-accent)" }} />;
    case "script":
      return <FileCode {...props} style={{ color: "var(--es-blue)" }} />;
    case "json":
      return <FileJson {...props} style={{ color: "var(--es-yellow)" }} />;
    default:
      return <FileCode {...props} style={{ color: "var(--es-text-muted)" }} />;
  }
}

export function formatSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export const STRIP_RE = /_strip(\d+)/i;
export const MAX_RECENT = 8;

export function guessAssetType(file: File): AssetItem["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.name.endsWith(".json")) return "json";
  if (file.name.endsWith(".ts") || file.name.endsWith(".js")) return "script";
  return "json";
}
