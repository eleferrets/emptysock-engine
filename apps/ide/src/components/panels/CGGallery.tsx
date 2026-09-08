import React from "react";
import {
  Lock,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useHistory } from "../../hooks/useHistory";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CGEntry {
  id: string;
  title: string;
  imagePath: string;
}

// Note: cgEntries are held in local state for this session. The variableStore
// uses Record<number, boolean> with numeric indices, which doesn't accommodate
// the string-keyed `cg_<id>` pattern described in the spec. Unlock state is
// therefore also kept in local state. A future iteration can persist both to
// the project JSON and map unlock state to a designated switch index range.

// ---------------------------------------------------------------------------
// Empty-state quips (dry, deadpan, stable per session)
// ---------------------------------------------------------------------------

const QUIPS: readonly string[] = [
  "No scenes unlocked. Yet.",
  "Gallery's empty. Good secrets are.",
  "All quiet on the CG front.",
  "Nothing to look at. Move along.",
  "A blank gallery: full of potential.",
  "The images are in another castle.",
  "Pristine. Untouched. Unseen.",
  "Add something. Or don't. No pressure.",
  "Zero art. Infinite possibilities.",
  "It's quiet here. Too quiet.",
];

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

interface LightboxProps {
  entries: CGEntry[];
  startIndex: number;
  onClose: () => void;
}

function Lightbox({ entries, startIndex, onClose }: LightboxProps): React.ReactElement {
  const [index, setIndex] = React.useState(startIndex);

  // Pointer-drag swipe state
  const dragStartX = React.useRef<number | null>(null);

  const entry = entries[index];

  const goPrev = React.useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : entries.length - 1));
  }, [entries.length]);

  const goNext = React.useCallback(() => {
    setIndex((i) => (i < entries.length - 1 ? i + 1 : 0));
  }, [entries.length]);

  // Keyboard navigation
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  function handleOverlayPointerDown(e: React.PointerEvent<HTMLDivElement>): void {
    dragStartX.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handleOverlayPointerUp(e: React.PointerEvent<HTMLDivElement>): void {
    if (dragStartX.current === null) return;
    const dx = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(dx) > 60) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>): void {
    // Only close if the click target is the overlay itself (not the image)
    if (e.target === e.currentTarget) onClose();
  }

  if (entry === undefined) return <></>;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={handleOverlayClick}
      onPointerDown={handleOverlayPointerDown}
      onPointerUp={handleOverlayPointerUp}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: "rgba(255,255,255,0.12)",
          border: "none",
          borderRadius: 6,
          color: "#fff",
          cursor: "pointer",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          minHeight: 44,
        }}
        aria-label="Close lightbox"
      >
        <X size={20} />
      </button>

      {/* Previous arrow */}
      {entries.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          style={{
            position: "absolute",
            left: 16,
            background: "rgba(255,255,255,0.12)",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            cursor: "pointer",
            padding: "12px 8px",
            display: "flex",
            alignItems: "center",
            minHeight: 44,
          }}
          aria-label="Previous image"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Image */}
      <img
        src={entry.imagePath}
        alt={entry.title}
        style={{
          maxWidth: "90vw",
          maxHeight: "90vh",
          objectFit: "contain",
          borderRadius: 4,
          pointerEvents: "none",
          userSelect: "none",
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Next arrow */}
      {entries.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          style={{
            position: "absolute",
            right: 16,
            background: "rgba(255,255,255,0.12)",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            cursor: "pointer",
            padding: "12px 8px",
            display: "flex",
            alignItems: "center",
            minHeight: 44,
          }}
          aria-label="Next image"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Title */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          color: "#fff",
          fontSize: 14,
          pointerEvents: "none",
          textAlign: "center",
          padding: "0 16px",
        }}
      >
        {entry.title}
        {entries.length > 1 && (
          <span style={{ opacity: 0.6, marginLeft: 8 }}>
            {index + 1} / {entries.length}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-entry form
// ---------------------------------------------------------------------------

interface AddEntryFormProps {
  onSave: (entry: CGEntry) => void;
  onCancel: () => void;
}

function AddEntryForm({ onSave, onCancel }: AddEntryFormProps): React.ReactElement {
  const [id, setId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [imagePath, setImagePath] = React.useState("");

  function handleSave(): void {
    const trimId = id.trim();
    const trimTitle = title.trim();
    const trimPath = imagePath.trim();
    if (trimId.length === 0 || trimTitle.length === 0 || trimPath.length === 0) return;
    onSave({ id: trimId, title: trimTitle, imagePath: trimPath });
  }

  const inputStyle: React.CSSProperties = {
    background: "var(--es-bg)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    color: "var(--es-text)",
    fontSize: 12,
    padding: "6px 8px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  return (
    <div
      style={{
        background: "var(--es-surface)",
        border: "1px solid var(--es-border)",
        borderRadius: 6,
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginBottom: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 12, color: "var(--es-text)", marginBottom: 2 }}>
        New CG Entry
      </div>
      <input
        style={inputStyle}
        placeholder="ID (unique, e.g. scene1_rain)"
        value={id}
        onChange={(e) => setId(e.target.value)}
        autoFocus
      />
      <input
        style={inputStyle}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        style={inputStyle}
        placeholder="assets/cg/scene1.png"
        value={imagePath}
        onChange={(e) => setImagePath(e.target.value)}
      />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          onClick={onCancel}
          style={{
            background: "transparent",
            border: "1px solid var(--es-border)",
            borderRadius: 4,
            color: "var(--es-text)",
            cursor: "pointer",
            fontSize: 12,
            padding: "5px 12px",
            minHeight: 28,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={id.trim().length === 0 || title.trim().length === 0 || imagePath.trim().length === 0}
          style={{
            background: "var(--es-accent, #3b82f6)",
            border: "none",
            borderRadius: 4,
            color: "#fff",
            cursor: "pointer",
            fontSize: 12,
            padding: "5px 12px",
            minHeight: 28,
            opacity: id.trim().length === 0 || title.trim().length === 0 || imagePath.trim().length === 0 ? 0.5 : 1,
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CG card
// ---------------------------------------------------------------------------

interface CGCardProps {
  entry: CGEntry;
  unlocked: boolean;
  onOpen: () => void;
  onToggleLock: () => void;
}

function CGCard({ entry, unlocked, onOpen, onToggleLock }: CGCardProps): React.ReactElement {
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      title={unlocked ? entry.title : "Locked"}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: "var(--es-surface)",
        border: "1px solid var(--es-border)",
        borderRadius: 8,
        overflow: "hidden",
        cursor: unlocked ? "pointer" : "default",
        opacity: unlocked ? 1 : 0.5,
        boxShadow: hovered && unlocked ? "0 0 0 2px var(--es-accent, #3b82f6)" : "none",
        transition: "box-shadow 0.15s, transform 0.15s",
        transform: hovered && unlocked ? "scale(1.02)" : "scale(1)",
        display: "flex",
        flexDirection: "column",
        minHeight: 160,
      }}
      onClick={unlocked ? onOpen : undefined}
    >
      {/* Thumbnail area */}
      <div
        style={{
          width: "100%",
          aspectRatio: "4/3",
          background: "var(--es-bg)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {unlocked ? (
          <img
            src={entry.imagePath}
            alt={entry.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              borderRadius: "8px 8px 0 0",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--es-text)",
              opacity: 0.4,
            }}
          >
            <Lock size={32} />
          </div>
        )}
      </div>

      {/* Title */}
      <div
        style={{
          padding: "6px 8px 4px",
          fontSize: 11,
          color: "var(--es-text)",
          fontWeight: 500,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
        }}
      >
        {entry.title}
      </div>

      {/* Unlock/lock toggle button */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleLock(); }}
        title={unlocked ? "Lock" : "Unlock"}
        style={{
          background: "transparent",
          border: "none",
          borderTop: "1px solid var(--es-border)",
          color: "var(--es-text)",
          cursor: "pointer",
          fontSize: 10,
          padding: "4px 8px",
          textAlign: "left",
          width: "100%",
          minHeight: 28,
          opacity: 0.7,
        }}
      >
        {unlocked ? "Lock" : "Unlock"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CGGallery panel
// ---------------------------------------------------------------------------

export function CGGallery(): React.ReactElement {
  // Stable quip for this session
  const quip = React.useRef(
    QUIPS[Math.floor(Math.random() * QUIPS.length)] ?? QUIPS[0],
  ).current;

  // Entry list — local state with undo/redo (session-only; project JSON persistence
  // is handled externally when project save is wired up)
  const {
    state: entries,
    set: setEntries,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useHistory<CGEntry[]>([]);

  // Unlock state: keyed by entry.id. The variableStore uses Record<number, boolean>
  // with numeric indices and doesn't support string keys, so unlock state lives here.
  const [unlocked, setUnlocked] = React.useState<Record<string, boolean>>({});

  const [search, setSearch] = React.useState("");
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);

  // Keyboard undo/redo
  React.useEffect(() => {
    function handleKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canUndo) undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "z") {
        e.preventDefault();
        if (canRedo) redo();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [canUndo, canRedo, undo, redo]);

  const unlockedEntries = React.useMemo(
    () => entries.filter((e) => unlocked[e.id] === true),
    [entries, unlocked],
  );

  const filteredEntries = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length === 0) return entries;
    return entries.filter((e) => e.title.toLowerCase().includes(q));
  }, [entries, search]);

  function handleAddEntry(entry: CGEntry): void {
    // Prevent duplicate IDs
    if (entries.some((e) => e.id === entry.id)) return;
    setEntries((prev) => [...prev, entry]);
    setShowAddForm(false);
  }

  function handleToggleLock(entryId: string): void {
    setUnlocked((prev) => ({ ...prev, [entryId]: prev[entryId] !== true }));
  }

  function handleCardOpen(entry: CGEntry): void {
    const idx = unlockedEntries.findIndex((e) => e.id === entry.id);
    if (idx !== -1) setLightboxIndex(idx);
  }

  const unlockedCount = entries.filter((e) => unlocked[e.id] === true).length;

  const headerBtnStyle: React.CSSProperties = {
    background: "var(--es-surface)",
    border: "1px solid var(--es-border)",
    borderRadius: 4,
    color: "var(--es-text)",
    cursor: "pointer",
    fontSize: 11,
    padding: "4px 8px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    minHeight: 28,
  };

  const accentBtnStyle: React.CSSProperties = {
    background: "var(--es-accent, #3b82f6)",
    border: "none",
    borderRadius: 4,
    color: "#fff",
    cursor: "pointer",
    fontSize: 11,
    padding: "4px 10px",
    display: "flex",
    alignItems: "center",
    gap: 4,
    minHeight: 28,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "var(--es-bg)",
        color: "var(--es-text)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--es-border)",
          flexShrink: 0,
          flexWrap: "wrap",
          rowGap: 6,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>CG Gallery</span>

        {entries.length > 0 && (
          <span
            style={{
              background: "var(--es-surface)",
              border: "1px solid var(--es-border)",
              borderRadius: 10,
              fontSize: 10,
              padding: "1px 7px",
              color: "var(--es-text)",
              opacity: 0.8,
            }}
          >
            {unlockedCount} / {entries.length} unlocked
          </span>
        )}

        <div style={{ flex: 1, minWidth: 100 }}>
          {entries.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "var(--es-surface)",
                border: "1px solid var(--es-border)",
                borderRadius: 4,
                padding: "0 6px",
                minHeight: 28,
              }}
            >
              <Search size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter entries…"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--es-text)",
                  fontSize: 12,
                  width: "100%",
                }}
              />
            </div>
          )}
        </div>

        {/* Undo/redo */}
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
          style={{ ...headerBtnStyle, opacity: canUndo ? 1 : 0.35 }}
        >
          <RotateCcw size={13} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          style={{ ...headerBtnStyle, opacity: canRedo ? 1 : 0.35 }}
        >
          <RotateCw size={13} />
        </button>

        <button
          onClick={() => setShowAddForm((v) => !v)}
          style={accentBtnStyle}
        >
          <Plus size={13} />
          Add Entry
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px" }}>
        {/* Add-entry form */}
        {showAddForm && (
          <AddEntryForm
            onSave={handleAddEntry}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Empty state */}
        {entries.length === 0 && !showAddForm && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 200,
              gap: 12,
              color: "var(--es-text)",
              opacity: 0.6,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 13 }}>
              No entries yet. Add a CG entry to get started.
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>{quip}</div>
            <button
              onClick={() => setShowAddForm(true)}
              style={{ ...accentBtnStyle, opacity: 1, marginTop: 4 }}
            >
              <Plus size={13} />
              Add Entry
            </button>
          </div>
        )}

        {/* No search results */}
        {entries.length > 0 && filteredEntries.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 16px",
              color: "var(--es-text)",
              opacity: 0.5,
              fontSize: 12,
            }}
          >
            No entries match "{search}"
          </div>
        )}

        {/* Gallery grid */}
        {filteredEntries.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {filteredEntries.map((entry) => (
              <CGCard
                key={entry.id}
                entry={entry}
                unlocked={unlocked[entry.id] === true}
                onOpen={() => handleCardOpen(entry)}
                onToggleLock={() => handleToggleLock(entry.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && unlockedEntries.length > 0 && (
        <Lightbox
          entries={unlockedEntries}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
