# EmptySock Engine — Offline Manual

This manual is the complete offline reference for EmptySock Engine and its IDE. Every concept described here is self-contained — no internet connection or external documentation is required to work with the engine.

---

## Sections

| #   | Section                                                                  | What it covers                                                                                            |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1   | [Prerequisites & Required SDKs](./01-prerequisites.md)                   | Node, Rust, Android/iOS toolchains, system requirements                                                   |
| 2   | [Getting Started](./02-getting-started.md)                               | Install, first run, project layout, dev loop                                                              |
| 3   | [Architecture Overview](./03-architecture.md)                            | Monorepo design, Actor Model, ECS, data flow                                                              |
| 4   | [Core Engine Reference](./04-core-reference.md)                          | Scene, Entity, Component, Engine, Timer, Coroutine, SceneManager                                          |
| 5   | [Systems Reference](./05-systems-reference.md)                           | Physics 2D/3D, Input, Touch, NavMesh, Audio, Camera, Save, Localisation, Plugin, Animator, Tilemap, Tween |
| 6   | [Actor Model & Multiplayer](./06-actor-model.md)                         | Actor, ActorSystem, NetworkActor, Transport interface                                                     |
| 7   | [IDE Reference](./07-ide-reference.md)                                   | All docked panels, keyboard shortcuts, build pipeline, PWA                                                |
| 8   | [Tutorial — Build a Pong Clone](./08-tutorial-pong.md)                   | Step-by-step: two paddles, a ball, score, sound, export                                                   |
| 9   | [Troubleshooting](./09-troubleshooting.md)                               | Common pitfalls, error messages, diagnostic steps                                                         |
| 10  | [TypeScript & JavaScript Language Reference](./10-language-reference.md) | Variables, types, classes, async, modules, engine patterns — offline TS/JS reference                      |
| 11  | [GameMaker Studio 2 Migration Guide](./11-gms2-migration.md)             | Import tool, GML → TS mapping table, asset migration status                                               |

---

## Quick-orientation

If you are completely new, read sections **1 → 2 → 8** in order. Section 8 is a hands-on tutorial that touches every major concept with working code.

If you are porting existing knowledge from another engine:

- Unity users: EmptySock scenes own entities; components are plain TypeScript classes, not MonoBehaviours. There is no `Update()` on components — game logic lives in the scene or in Actors.
- Godot users: The ECS here is explicit — you attach components to entities rather than inheriting from nodes. Signals become Actor messages.
- Phaser users: The engine replaces `this.physics.add.*` with typed system calls (`PhysicsBody`, `PhysicsSystem3D`). The loop is managed for you.
- GameMaker Studio 2 users: See section 11 for the migration guide, import tool, and GML → TypeScript mapping table.

---

## Conventions used in this manual

```
TypeScript code blocks — runnable inside the IDE or in any project file
```

> **Note** — informational callout  
> **Warning** — something that will silently break if ignored  
> **Tip** — a pattern that saves time

All imports shown use the public package name `@emptysock/engine`. You never import from internal paths.
