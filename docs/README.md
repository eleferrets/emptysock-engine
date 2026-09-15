# EmptySock Engine — Documentation

This is the restructured documentation for EmptySock Engine. Content is divided into four sections that match different reading modes.

---

## Getting Started

New to EmptySock? Start here. These pages get you from zero to a running game in the shortest possible path.

| Page                                                    | What it covers                                      |
| ------------------------------------------------------- | --------------------------------------------------- |
| [Installation](./getting-started/installation.md)       | Node, Rust, Android/iOS SDKs, system libraries      |
| [Your First Game](./getting-started/your-first-game.md) | Clone, install, run the IDE, write your first scene |
| [IDE Tour](./getting-started/ide-tour.md)               | Overview of all panels and keyboard shortcuts       |
| [From GameMaker](./getting-started/from-gamemaker.md)   | GMS2 → EmptySock import tool and GML mapping table  |

---

## Guides

Task-oriented answers to "how do I X?" Each guide explains the concept, shows you how to use it, and links to the full API reference for exhaustive details.

| Guide                                                          | What it covers                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| [Entities and Scenes](./guides/entities-and-scenes.md)         | Scene lifecycle, Entity, Component, Coroutine, SceneManager      |
| [Physics](./guides/physics.md)                                 | 2D and 3D physics, bodies, collision events, CharacterController |
| [Input and Gamepad](./guides/input-and-gamepad.md)             | Keyboard, mouse, touch, gamepad                                  |
| [Saving and Localisation](./guides/saving-and-localisation.md) | SaveSystem, LocalisationSystem                                   |
| [Navigation](./guides/navigation.md)                           | NavMeshSystem, pathfinding, offline NavMesh data                 |
| [Actors and Networking](./guides/actors-and-networking.md)     | Actor Model, ActorSystem, NetworkActor, Transport                |
| [Plugins](./guides/plugins.md)                                 | PluginSystem, writing and registering plugins                    |
| [Hot Reload](./guides/hot-reload.md)                           | How the reload pipeline works, scene-level hot swap              |
| [Building and Exporting](./guides/building-and-exporting.md)   | Export pipeline, platform targets, CLI flags                     |

---

## Reference

Indexed by class and system. Ctrl+F for a method name or type. Not meant to be read sequentially.

| Page                                                             | What it covers                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| [Index](./reference/index.md)                                    | Alphabetical list of all systems with one-line descriptions |
| [Scene](./reference/scene.md)                                    | Scene, SceneConfig, SceneManager                            |
| [Entity](./reference/entity.md)                                  | Entity — full method list                                   |
| [Component](./reference/component.md)                            | Component base class conventions                            |
| [Timer and Coroutine](./reference/timer-and-coroutine.md)        | Timer, TimerHandle, Coroutine, yield helpers                |
| [Camera](./reference/camera.md)                                  | Camera — follow, shake, zoom, fade                          |
| [ActorSystem](./reference/actor-system.md)                       | Actor, ActorSystem, NetworkActor, Transport                 |
| **Systems**                                                      |                                                             |
| [PhysicsSystem2D](./reference/systems/physics-2d.md)             | Full 2D physics API                                         |
| [PhysicsSystem3D](./reference/systems/physics-3d.md)             | Full 3D physics API                                         |
| [InputSystem](./reference/systems/input-system.md)               | Keyboard, mouse, touch, axis API                            |
| [NavMeshSystem](./reference/systems/nav-mesh-system.md)          | NavMeshSystem full API                                      |
| [SaveSystem](./reference/systems/save-system.md)                 | SaveSystem full API                                         |
| [LocalisationSystem](./reference/systems/localisation-system.md) | LocalisationSystem full API                                 |
| [PluginSystem](./reference/systems/plugin-system.md)             | PluginSystem full API                                       |
| [AudioSystem](./reference/systems/audio-system.md)               | Audio playback, music, groups                               |
| [VNSystem](./reference/systems/vn-system.md)                     | VNSystem, DialogueNode, Story Graph integration             |

---

## Tutorials

Complete, step-by-step projects you build from scratch.

| Tutorial                                     | What you build                                              |
| -------------------------------------------- | ----------------------------------------------------------- |
| [Pong](./tutorials/pong.md)                  | Two paddles, ball, score, Actor-driven score system         |
| [Mini Platformer](./tutorials/platformer.md) | Scrolling tilemap, physics, animation, camera, save         |
| [Visual Novel](./tutorials/visual-novel.md)  | Story Graph, VNSystem, save/load, Localisation              |
| [Bullet Hell](./tutorials/bullet-hell.md)    | 8-direction movement, coroutine spawners, physics collision |

---

## Other

| Page                                          | What it covers                                           |
| --------------------------------------------- | -------------------------------------------------------- |
| [Architecture](./architecture.md)             | Layer model, ECS, Actor Model, IDE data flow             |
| [Troubleshooting](./troubleshooting.md)       | Common pitfalls and how to diagnose them                 |
| [Glossary](./glossary.md)                     | Canonical term spellings and definitions                 |
| [Language Reference](./language-reference.md) | TypeScript and JavaScript reference for engine scripting |

---

> The legacy `docs/manual/` files remain at their original paths for backward compatibility with external links. New content and updates go in the directories above.
