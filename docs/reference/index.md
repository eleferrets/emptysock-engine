# Reference Index

Alphabetical list of all engine systems and classes with one-line descriptions. Each links to the full reference page.

---

## Core

| Class / System                        | Description                                                                       |
| ------------------------------------- | --------------------------------------------------------------------------------- |
| [Actor](./actor-system.md)            | Base class for objects that communicate via message-passing within an ActorSystem |
| [ActorSystem](./actor-system.md)      | Owns actor registration, message dispatch, and the inbox-drain-before-update loop |
| [Camera](./camera.md)                 | Controls viewport: follow, shake, zoom, fade                                      |
| [Component](./component.md)           | Base conventions for typed data objects attached to entities                      |
| [Coroutine](./timer-and-coroutine.md) | Generator-based multi-frame sequencing                                            |
| [Entity](./entity.md)                 | Named container for components; carries a unique ID                               |
| [NetworkActor](./actor-system.md)     | Actor subclass that bridges the engine Actor Model to an external Transport       |
| [Scene](./scene.md)                   | Root container for one game screen; owns entities and manages the game loop       |
| [SceneManager](./scene.md)            | Controls which Scene is running; supports push/pop overlay stacks                 |
| [Timer](./timer-and-coroutine.md)     | Game-loop-integrated delay and interval callbacks                                 |
| [Transport](./actor-system.md)        | Interface (not a class) for sending and receiving raw messages in NetworkActor    |

---

## Systems

| System                                                 | Description                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| [AudioSystem](./systems/audio-system.md)               | Sound-effect and music playback, group volume control                   |
| [LocalisationSystem](./systems/localisation-system.md) | i18n: loads locale JSON files and looks up translated strings           |
| [NavMeshSystem](./systems/nav-mesh-system.md)          | Polygon-based 2D pathfinding using A\*                                  |
| [PhysicsSystem2D](./systems/physics-2d.md)             | 2D physics — PhysicsBody, CharacterController, collision events         |
| [PhysicsSystem3D](./systems/physics-3d.md)             | 3D physics wrapping Rapier3D — must be destroyed on scene unload        |
| [InputSystem](./systems/input-system.md)               | Keyboard, mouse, touch, and axis input                                  |
| [PluginSystem](./systems/plugin-system.md)             | Module-level singleton service locator for optional capabilities        |
| [SaveSystem](./systems/save-system.md)                 | Reads and writes persistent save slots                                  |
| [VNSystem](./systems/vn-system.md)                     | Plays back branching dialogue trees exported from the Story Graph panel |

---

## Actor Model

See [ActorSystem reference](./actor-system.md) for `Actor`, `ActorSystem`, `NetworkActor`, and `Transport` in one place.

---

## Quick lookup

| If you are looking for...            | Go to                                                  |
| ------------------------------------ | ------------------------------------------------------ |
| `entity.addComponent`                | [Entity](./entity.md)                                  |
| `entity.requireComponent`            | [Entity](./entity.md)                                  |
| `scene.query`                        | [Scene](./scene.md)                                    |
| `SceneManager.load`                  | [Scene](./scene.md)                                    |
| `Timer.after` / `Timer.every`        | [Timer and Coroutine](./timer-and-coroutine.md)        |
| `waitSeconds` / `waitFrames`         | [Timer and Coroutine](./timer-and-coroutine.md)        |
| `Camera.follow` / `Camera.shake`     | [Camera](./camera.md)                                  |
| `ActorSystem.send` / `broadcast`     | [ActorSystem](./actor-system.md)                       |
| `NavMeshSystem.findPath`             | [NavMeshSystem](./systems/nav-mesh-system.md)          |
| `SaveSystem.save` / `load`           | [SaveSystem](./systems/save-system.md)                 |
| `LocalisationSystem.t`               | [LocalisationSystem](./systems/localisation-system.md) |
| `pluginSystem.register` / `inject`   | [PluginSystem](./systems/plugin-system.md)             |
| `VNSystem.load` / `advance`          | [VNSystem](./systems/vn-system.md)                     |
| `PhysicsBody`, `CharacterController` | [PhysicsSystem2D](./systems/physics-2d.md)             |
| `PhysicsSystem3D.addBody`            | [PhysicsSystem3D](./systems/physics-3d.md)             |
| `InputSystem.isKeyDown` / `axis`     | [InputSystem](./systems/input-system.md)               |
| `Audio.play` / `music`               | [AudioSystem](./systems/audio-system.md)               |
