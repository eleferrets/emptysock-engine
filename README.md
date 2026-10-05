# EmptySock Engine

> **Deprecated / archived.** Development has stopped. The code is kept as a portfolio piece and a working reference. It builds, its tests pass, and the IDE runs, but no new features or fixes are planned.

EmptySock is a 2D/3D TypeScript game engine with a desktop and web IDE. The runtime is an ECS (bitECS-backed) on top of PixiJS (WebGL/WebGPU), Rapier physics and Yoga layout, plus optional modules for tilemaps, visual novels, turn-based battle and multiplayer.

## What is in here

| Path                                             | What it is                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [`packages/engine`](packages/engine)             | Core runtime: ECS, scenes, rendering, physics, input, audio, UI widgets, save system. Single export surface `src/index.ts`. |
| [`packages/types`](packages/types)               | Zod schemas for the scene and project file formats.                                                                         |
| [`packages/tilemap`](packages/tilemap)           | Tilemaps, auto-tiling, navmesh pathfinding.                                                                                 |
| [`packages/vn`](packages/vn)                     | Visual novel runtime: dialogue trees, textbox, story graphs.                                                                |
| [`packages/battle`](packages/battle)             | Turn-based battle system.                                                                                                   |
| [`packages/network`](packages/network)           | Multiplayer sync (Colyseus-shaped transport).                                                                               |
| [`packages/export-utils`](packages/export-utils) | Web/mobile export helpers.                                                                                                  |
| [`packages/toolchain`](packages/toolchain)       | `emptysock-toolchain` CLI: toolchain detection, desktop (Tauri) builds, included files, prefab codegen.                     |
| [`apps/ide`](apps/ide)                           | The IDE: Tauri v2 + React + Vite, Monaco code editor, room/scene editor, asset browser, preview.                            |
| [`templates`](templates)                         | Project templates (blank, platformer, visual novel).                                                                        |
| [`docs`](docs)                                   | Manual, guides, tutorials, API reference. Start at [`docs/README.md`](docs/README.md).                                      |

Companion repos: `emptysock-mcp` (MCP server for AI agents) and `emptysock-ai-skills` (agent skill pack). Both are deprecated with this engine.

## Quick start

Requirements: Node 20+, pnpm. Rust + Tauri prerequisites only for the desktop shell.

```bash
pnpm install
pnpm build
pnpm test
```

Run the IDE in the browser:

```bash
pnpm --filter @emptysock/ide dev
```

Then open the printed local URL. **File > New Project** creates a blank project; open a directory with **File > Open Project...** and click files in the tree to edit them. Right-click files and assets for the context menu.

## Notes

- `packages/engine/dist-types` is committed and checked against the source by a test; regenerate with `pnpm --filter @emptysock/engine build:types` and format with prettier.
- Commits follow Conventional Commits (Husky + commitlint + lint-staged).
- See [`CLAUDE.md`](CLAUDE.md) for the repo's working rules.
