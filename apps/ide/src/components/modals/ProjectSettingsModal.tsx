import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ALL_MODULES } from "../../services/ModuleRegistry";
import { useIDEStore } from "../../store/ideStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProjectSettingsModal({
  open,
  onClose,
}: Props): React.ReactElement {
  const { enabledModules, toggleModule } = useIDEStore();

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
          }}
        />
        <Dialog.Content
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 480,
            maxHeight: "80vh",
            overflowY: "auto",
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 24,
            zIndex: 201,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text)",
              }}
            >
              Modules
            </Dialog.Title>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                padding: 4,
                display: "flex",
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ALL_MODULES.map((mod) => {
              const enabled = enabledModules.includes(mod.id);
              return (
                <label
                  key={mod.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    padding: "8px 10px",
                    borderRadius: 6,
                    background: enabled
                      ? "rgba(124,106,247,0.08)"
                      : "transparent",
                    border: "1px solid",
                    borderColor: enabled ? "var(--accent)" : "var(--border)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleModule(mod.id)}
                    style={{
                      marginTop: 3,
                      accentColor: "var(--accent)",
                      cursor: "pointer",
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text)",
                      }}
                    >
                      {mod.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-muted)",
                        marginTop: 2,
                      }}
                    >
                      {mod.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
            Changes take effect the next time the IDE layout is initialised
            (reload the app).
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
