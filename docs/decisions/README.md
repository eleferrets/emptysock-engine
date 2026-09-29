# Decision records

Split verbatim from the former CLAUDE.md decision record. One line per file.

- [overview.md](overview.md): the former guide's intro, documentation map and repo layout.
- [engine-core.md](engine-core.md): environment boundary, Game services, mailbox/transport interfaces, shared helpers, typed globals, SignalBus.
- [actors-and-ecs.md](actors-and-ecs.md): component identity, ActorSystem, collision callbacks, network field marking, prefab pooling and codegen.
- [rendering-and-pipeline.md](rendering-and-pipeline.md): RenderPipeline, sprites, tilemaps, particles, lighting, surfaces, post-process, shaders, rain, GPU verification.
- [gml-importer.md](gml-importer.md): GMS2 project format quirks, room/view import, prefab and scene emission, DnD, toolchain codegen, layer elements.
- [gml-runtime.md](gml-runtime.md): collision queries, behavior dispatch, GmsProjectRuntime, built-ins, multi-camera, projection, playability fixes and walks.
- [gml-transpiler.md](gml-transpiler.md): GML to TypeScript transpiler fixes, pre-scans, coercion, symbol research, built-in batches.
- [physics-and-navmesh.md](physics-and-navmesh.md): 3D physics lifetime, offline navmesh, deterministic Rapier.
- [persistence-and-transitions.md](persistence-and-transitions.md): scene transitions, SaveSystem adapter, GMS2 persistent instances.
- [input-and-audio.md](input-and-audio.md): input snapshot semantics, audio singleton.
- [ui-and-visual-scripting.md](ui-and-visual-scripting.md): visual script compilation, WidgetTree, UISystem, VN systems.
- [ide-tauri-and-tooling.md](ide-tauri-and-tooling.md): Tauri, rc-dock, Monaco, Inspector bridge, MCP, QueryChannel, export tooling, room editor.
- [conventions-and-process.md](conventions-and-process.md): canonical terms, session tracking, conventions, IDE panel checklist, personality.
