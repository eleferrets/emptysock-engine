import React from "react";
import { useVNStore } from "../../store/vnStore";

interface VNNode {
  id: string;
  type: "dialogue" | "choice" | "event" | "jump";
  speaker?: string;
  text: string;
  options?: string[];
  backgroundPath?: string;
  cgPath?: string;
  characters?: Array<{ slot: "left" | "center" | "right"; imagePath: string }>;
  // event node fields
  eventName?: string;
  name?: string;
  // jump node fields
  target?: string;
  scene?: string;
}

const PANEL_W = 480;
const PANEL_H = 270;
const TB_HEIGHT = 100;
const NP_HEIGHT = 28;

function renderPreview(
  ctx: CanvasRenderingContext2D,
  node: VNNode,
  bgImage: HTMLImageElement | null,
  charImages: Record<string, HTMLImageElement>,
): void {
  ctx.clearRect(0, 0, PANEL_W, PANEL_H);

  // Background
  if (bgImage) {
    const r = Math.min(
      PANEL_W / bgImage.naturalWidth,
      PANEL_H / bgImage.naturalHeight,
    );
    const bw = bgImage.naturalWidth * r;
    const bh = bgImage.naturalHeight * r;
    ctx.drawImage(bgImage, (PANEL_W - bw) / 2, (PANEL_H - bh) / 2, bw, bh);
  } else {
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, PANEL_W, PANEL_H);
  }

  // Characters
  const SLOT_X = { left: 0.2, center: 0.5, right: 0.8 };
  if (node.characters) {
    for (const ch of node.characters) {
      const img = charImages[ch.imagePath];
      if (!img) continue;
      const maxH = PANEL_H * 0.65;
      const scale = Math.min(
        maxH / img.naturalHeight,
        (PANEL_W * 0.35) / img.naturalWidth,
      );
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const cx = PANEL_W * SLOT_X[ch.slot];
      ctx.drawImage(img, cx - dw / 2, PANEL_H * 0.78 - dh, dw, dh);
    }
  }

  if (node.type === "dialogue") {
    const tbY = PANEL_H - TB_HEIGHT;
    ctx.fillStyle = "rgba(13,13,26,0.88)";
    ctx.fillRect(0, tbY, PANEL_W, TB_HEIGHT);

    if (node.speaker) {
      ctx.fillStyle = "#3c2d6e";
      ctx.fillRect(12, tbY - NP_HEIGHT, 120, NP_HEIGHT);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(node.speaker, 20, tbY - NP_HEIGHT + 18);
    }

    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    const lines = wrapText(ctx, node.text, PANEL_W - 40);
    lines.forEach((line, i) => ctx.fillText(line, 20, tbY + 20 + i * 18));
  } else if (node.type === "choice") {
    const tbY = PANEL_H - TB_HEIGHT;
    ctx.fillStyle = "rgba(13,13,26,0.88)";
    ctx.fillRect(0, tbY, PANEL_W, TB_HEIGHT);
    ctx.fillStyle = "#ccc";
    ctx.font = "italic 11px sans-serif";
    ctx.fillText(node.text, 20, tbY + 20);
    ctx.fillStyle = "#fff";
    ctx.font = "12px sans-serif";
    (node.options ?? []).forEach((opt, i) =>
      ctx.fillText(`${i + 1}. ${opt}`, 30, tbY + 38 + i * 16),
    );
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

export function VNPreviewPanel(): React.ReactElement {
  const vnNodes = useVNStore(
    (s) => s.vnNodes as unknown as VNNode[] | undefined,
  );
  const [selectedId, setSelectedId] = React.useState<string>("");
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const bgRef = React.useRef<HTMLImageElement | null>(null);
  const charImgRef = React.useRef<Record<string, HTMLImageElement>>({});

  const nodes: VNNode[] = vnNodes ?? [];
  const selectedNode =
    nodes.find((n) => n.id === selectedId) ?? nodes[0] ?? null;

  React.useEffect(() => {
    if (!selectedNode) return;
    let pending = 0;
    const done = (): void => {
      pending--;
      if (pending === 0) draw();
    };
    const draw = (): void => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      renderPreview(ctx, selectedNode, bgRef.current, charImgRef.current);
    };

    bgRef.current = null;
    if (selectedNode.backgroundPath) {
      pending++;
      const img = new Image();
      img.onload = () => {
        bgRef.current = img;
        done();
      };
      img.onerror = done;
      img.src = selectedNode.backgroundPath;
    }

    charImgRef.current = {};
    for (const ch of selectedNode.characters ?? []) {
      if (charImgRef.current[ch.imagePath]) continue;
      pending++;
      const img = new Image();
      img.onload = () => {
        charImgRef.current[ch.imagePath] = img;
        done();
      };
      img.onerror = done;
      img.src = ch.imagePath;
    }

    if (pending === 0) draw();
  }, [selectedNode]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        fontFamily: "sans-serif",
      }}
    >
      {nodes.length > 0 && (
        <div
          style={{
            padding: "6px 10px",
            borderBottom: "1px solid var(--es-border)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          <span style={{ color: "var(--es-text-muted)" }}>Node:</span>
          <select
            value={selectedId || (nodes[0]?.id ?? "")}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              background: "var(--es-surface)",
              color: "var(--es-text)",
              border: "1px solid var(--es-border)",
              borderRadius: 3,
              padding: "2px 6px",
              fontSize: 12,
            }}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id}
                {n.speaker ? ` — ${n.speaker}` : ""}: {n.text.slice(0, 40)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
        }}
      >
        {nodes.length === 0 ? (
          <span style={{ opacity: 0.4 }}>
            No Story Graph nodes. Open the Story Graph panel to add dialogue.
          </span>
        ) : (
          <canvas
            ref={canvasRef}
            width={PANEL_W}
            height={PANEL_H}
            style={{
              border: "1px solid var(--es-border)",
              maxWidth: "100%",
              imageRendering: "auto",
            }}
          />
        )}
      </div>
    </div>
  );
}
