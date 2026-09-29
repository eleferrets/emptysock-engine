# EmptySock Engine — AI Agent Guide

This file is the decision record for the monorepo. It records conventions and non-obvious architectural choices. For API signatures and worked examples, see the docs at `docs/`.

---

## Documentation

The docs follow a Unity/Unreal-style layout — four sections that match different reading modes. Start at `docs/README.md` for a full navigation table.

| Section            | Path                         | What it covers                                                                                    |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Getting Started    | `docs/getting-started/`      | Installation, first game, IDE tour, from GameMaker                                                |
| Guides             | `docs/guides/`               | Task-oriented: physics, input, saving, navmesh, actors, plugins, hot-reload, building             |
| Reference          | `docs/reference/`            | Indexed by class/system — Scene, Entity, all systems. Ctrl+F destination, not sequential reading. |
| Tutorials          | `docs/tutorials/`            | Pong, platformer, visual novel, bullet hell — complete step-by-step projects                      |
| Architecture       | `docs/architecture.md`       | Layers, ECS, Actor Model, IDE data flow (contributor deep-dive)                                   |
| Troubleshooting    | `docs/troubleshooting.md`    | Common pitfalls and how to diagnose them                                                          |
| Glossary           | `docs/glossary.md`           | Canonical term spellings, deprecated aliases, definitions                                         |
| Language Reference | `docs/language-reference.md` | TypeScript & JavaScript reference for engine scripting                                            |

> The legacy `docs/manual/` files remain for backward compatibility with external links. New content goes in the directories above.

---

## Repo layout

Top-level packages: `packages/engine` (@emptysock/engine, the ECS runtime — bitECS-backed, one `Scene`/`Entity`/`Component` model, one export surface), `packages/types` (@emptysock/types, shared interfaces with no implementation), `packages/toolchain` (@emptysock/toolchain + the emptysock-toolchain CLI binary), `packages/network` (@emptysock/network, the optional Colyseus multiplayer companion package — never imported by @emptysock/engine itself), `packages/vn` (@emptysock/vn, VNSystem/Story Graph), `packages/battle` (@emptysock/battle, BattleSystem), `packages/tilemap` (@emptysock/tilemap, TilemapSystem/NavMeshSystem; each an optional module package, a `workspace:*` dependant of @emptysock/engine, never the other way around), and `apps/ide` (Tauri v2 + React/Vite). Each panel in the IDE is a single file under `apps/ide/src/components/panels/`. Editor state lives in one store _tree_ rooted at `apps/ide/src/store/ideStore.ts` (Zustand) plus named sibling stores for specific domains (DB, sequence, localisation, variable, audio, VN, VS, CG state, …) composed alongside it — not literally all inside that one file. Build logic lives in `apps/ide/src/services/`.

`packages/engine/src/` is a flat tree at the package root — `Scene.ts`, `Entity.ts`, `Component.ts`, `Game.ts`, `systems/`, `components/`, `ui/`, `bridge/`, `internal/`. There is exactly one export surface (`src/index.ts`, published as `@emptysock/engine`'s `.` entry); there is no subpath split and no second, parallel object model anywhere in this package.

---

## Non-obvious decisions

