# @emptysock/ide

> Deprecated. Development has stopped; kept as a reference.

The EmptySock IDE: Tauri v2 shell around a React + Vite app. Panels (rc-dock): file tree, Monaco code editor, room/scene editor (Konva), asset browser, inspector, preview, console, profiler.

```bash
pnpm --filter @emptysock/ide dev        # web, http://localhost:5174 style Vite dev server
pnpm --filter @emptysock/ide build
pnpm --filter @emptysock/ide test
```

## Using it

- **File > New Project** creates a blank project (`src/main.ts`, empty `assets/`).
- **File > Open Project...** opens a directory; click a file in the tree to open it in the editor.
- Right-click a file or folder in the tree (Open, Copy Path) or an asset in the Assets panel (open, export, delete). Right-click empty space in the Assets panel to import.
- The initial session shows a small starter project so the panels have something to display.

The desktop shell lives in `src-tauri/` and needs Rust and the Tauri prerequisites; the browser build needs only Node.
