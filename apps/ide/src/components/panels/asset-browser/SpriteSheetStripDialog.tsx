import React from "react";
import { Grid, X } from "lucide-react";
import { Button } from "../../ui/Button";
import { formatSize } from "./helpers";

export interface StripDialog {
  fileName: string;
  detectedN: number;
  frameCount: string;
  objectUrl: string;
  size: number;
}

export interface SpriteSheetStripDialogProps {
  dialog: StripDialog;
  onFrameCountChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SpriteSheetStripDialog({
  dialog,
  onFrameCountChange,
  onConfirm,
  onCancel,
}: SpriteSheetStripDialogProps): React.ReactElement {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          background: "var(--es-surface)",
          border: "1px solid var(--es-border)",
          borderRadius: 10,
          width: 400,
          maxWidth: "calc(100vw - 32px)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--es-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Grid size={14} style={{ color: "var(--es-accent)" }} />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--es-text)",
              }}
            >
              Import Sprite Sheet
            </span>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--es-text-muted)",
              display: "flex",
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div
          style={{
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "var(--es-text-muted)",
              fontFamily: "JetBrains Mono, monospace",
              wordBreak: "break-all",
            }}
          >
            {dialog.fileName}
            <span style={{ marginLeft: 8, opacity: 0.6 }}>
              {formatSize(dialog.size)}
            </span>
          </div>

          <div
            style={{
              borderRadius: 6,
              overflow: "hidden",
              border: "1px solid var(--es-border)",
              background: "var(--es-surface-deep)",
              maxHeight: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={dialog.objectUrl}
              alt="strip preview"
              style={{
                maxWidth: "100%",
                maxHeight: 120,
                objectFit: "contain",
                imageRendering: "pixelated",
              }}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label
              style={{
                fontSize: 12,
                color: "var(--es-text)",
                whiteSpace: "nowrap",
              }}
            >
              Frame count
            </label>
            <input
              type="number"
              min={1}
              max={1024}
              value={dialog.frameCount}
              onChange={(e) => onFrameCountChange(e.target.value)}
              style={{
                flex: 1,
                background: "var(--es-bg)",
                border: "1px solid var(--es-border)",
                borderRadius: 5,
                color: "var(--es-text)",
                fontSize: 12,
                padding: "4px 8px",
                outline: "none",
                fontFamily: "JetBrains Mono, monospace",
              }}
            />
            {dialog.detectedN > 0 && (
              <span style={{ fontSize: 11, color: "var(--es-text-muted)" }}>
                detected: {dialog.detectedN}
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: 11,
              color: "var(--es-text-muted)",
              lineHeight: 1.5,
            }}
          >
            Frames are read left-to-right from a single horizontal strip. Set
            the frame count manually if the filename detection was incorrect.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            padding: "10px 16px",
            borderTop: "1px solid var(--es-border)",
          }}
        >
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="accent"
            size="sm"
            onClick={onConfirm}
            disabled={
              isNaN(parseInt(dialog.frameCount, 10)) ||
              parseInt(dialog.frameCount, 10) < 1
            }
          >
            <Grid size={11} />
            Import Strip
          </Button>
        </div>
      </div>
    </div>
  );
}
