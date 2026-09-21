---
"@emptysock/engine": minor
---

Add `v2/bridge/QueryChannel.ts` — a transport-agnostic query/command channel for a live `Scene`/`PhysicsSystem` (ENGINE_DESIGN.md §8), supporting `listEntities`/`entityInfo`/`getComponent` and `raycast2d`/`overlapCircle2d`/`bodyState2d`. Backs the engine-side half of the `emptysock-mcp` live physics/scene tools. `PhysicsSystem` gained `raycast`/`overlapCircle`/`getBodyState` and a `PhysicsNotInitializedError`.
