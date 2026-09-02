# 14. Canonical Glossary

This file is the single source of truth for term spelling and capitalisation across all EmptySock documentation, skill files, and agent-facing content. When a term appears in any doc, use the **Canonical Term** column exactly — no synonyms, no alternate capitalisations.

---

## Term table

| Canonical Term          | Deprecated Aliases                                    | Definition                                                                                                                                                                                          |
| ----------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ActorSystem`           | "Actor System" (two words)                            | The class that owns actor registration, message dispatch, and the inbox-drain-before-update loop. Always one word, PascalCase.                                                                      |
| `NavMeshSystem`         | "NavmeshSystem", "NavMesh System", "Navmesh system"   | The engine system that loads pre-built polygon graphs and answers path queries. The class name is `NavMeshSystem`; the data structure it operates on is called a **NavMesh** (one word, capital M). |
| `NavMesh`               | "navmesh", "nav mesh", "Navmesh"                      | A pre-built polygon navigation graph asset. Produced offline; loaded by `NavMeshSystem.load()`.                                                                                                     |
| `PluginSystem`          | "Plugin System" (two words)                           | The module-level singleton service locator for optional capabilities. Always one word, PascalCase. Accessed via the `pluginSystem` export (camelCase when referring to the singleton instance).     |
| `pluginSystem`          | —                                                     | The exported singleton instance of `PluginSystem`. Lowercase `p` — it is a module-level `const`, not a class reference.                                                                             |
| `PhysicsSystem2D`       | "Physics System 2D", "PhysicsSystem 2D"               | The 2-D physics engine wrapper.                                                                                                                                                                     |
| `PhysicsSystem3D`       | "Physics System 3D", "PhysicsSystem 3D"               | The 3-D physics engine wrapper (Rapier3D). Must be destroyed when a scene unloads.                                                                                                                  |
| `Story Graph`           | "VN Graph", "VNGraph", "VN Editor", "VNEditor"        | The IDE panel for authoring branching dialogue trees. The panel tab is labelled **Story Graph**. The underlying runtime system is `VNSystem`.                                                       |
| `VNSystem`              | "VN System" (two words)                               | The runtime that plays back `.vnscript` files produced by the Story Graph panel.                                                                                                                    |
| `VisualScriptEditor`    | "Visual Script Editor" (as a class name), "VS Editor" | The IDE panel for node-graph logic. The panel tab label is **Visual Script Editor** (three words, spaces); the component class exported from the engine is `VisualScriptComponent`.                 |
| `VisualScriptComponent` | "VisualScript Component", "Visual Script Component"   | The entity component that references a `.esvs` file and runs it through the graph interpreter.                                                                                                      |
| `Tilemap`               | "TileMap", "tile map", "tilemap" (lowercase)          | The data type for a grid of tile indices. The IDE panel is **Tilemap Editor**; the term in prose is **Tilemap** (capital T, one word).                                                              |
| `GameBuildService`      | "Build Service", "Game Build Service"                 | The IDE service that invokes esbuild-wasm and produces the game bundle.                                                                                                                             |
| `esbuild`               | "ESBuild", "Esbuild", "esBuild"                       | The bundler used inside the IDE. Always lowercase `e`, one word.                                                                                                                                    |
| `Localisation`          | "Localization"                                        | The EmptySock i18n system. British spelling throughout (matches the class name `LocalisationSystem`).                                                                                               |
| `LocalisationSystem`    | "LocalizationSystem", "i18n System"                   | The engine system for loading `.locale.json` files and looking up translated strings.                                                                                                               |
| `Transport`             | —                                                     | The interface (not a class) that `NetworkActor` accepts for sending and receiving raw messages. No concrete implementation ships in the engine.                                                     |
| `NetworkActor`          | "Network Actor" (two words as a class name)           | An `Actor` subclass that bridges the engine actor model to an external `Transport`.                                                                                                                 |
| `Actor`                 | —                                                     | The base class for objects that communicate via message-passing within an `ActorSystem`.                                                                                                            |
| `Scene`                 | —                                                     | The top-level container for entities and systems. Has an `onLoad` / `onUpdate` / `onDestroy` lifecycle.                                                                                             |
| `Entity`                | —                                                     | A lightweight integer handle (plus component table) managed by a `Scene`.                                                                                                                           |
| `SaveSystem`            | "Save System" (two words)                             | The engine system for reading and writing persistent save slots.                                                                                                                                    |
| `AssetBrowser`          | "Asset Browser" (as a class or panel name)            | The IDE panel for importing and organising project assets.                                                                                                                                          |

---

## Usage notes

- When introducing a term for the first time in a document, use the canonical form in **bold** and give a one-line definition.
- Deprecated aliases may appear in migration docs (`11-gms2-migration.md`, `ai/CLAUDE.md`) only when explicitly contrasting old and new terminology.
- Code samples must use the exact casing shown in the **Canonical Term** column — e.g. `import { ActorSystem } from '@emptysock/engine'`, not `Actor System` or `Actorsystem`.
