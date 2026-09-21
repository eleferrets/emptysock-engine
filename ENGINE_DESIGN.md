# EmptySock v2 — Engine Design

Status: **draft, for review**. This is a from-scratch redesign of `packages/engine`
(and what it implies for the IDE, MCP tools, and docs/skills). Nothing is shipping
yet — this file is the spec to argue with before anything gets rewritten. Nobody
uses the current engine, so there is no migration constraint: every idea here is
free to break the current shape of `Scene`/`Entity`/`Component`.

Sections 1–2 are the argument. Sections 3–8 are the actual design. Section 9 is
what's explicitly _not_ in this pass. Section 10 is the open questions I need
answered before writing code.

---

## 1. What we're optimizing for

In priority order:

1. **Foolproof by default.** A beginner who does the obvious thing gets correct
   behavior. Getting it wrong should be _hard_, not just discouraged in a doc
   comment. If a rule can be enforced by the type system or by the engine owning
   the resource, it must be — "remember to call X" is a bug in our design, not
   a fact of life for the developer.
2. **One clean path to power.** Nothing is dumbed down or capped — the same
   objects a beginner touches are the objects a systems programmer drops down
   into. No parallel "simple API" that has to be abandoned once you need real
   control.
3. **Performance is not for sale.** The friendly surface is a facade over
   contiguous component storage, not a tax on it. A beginner's code and an
   optimized inner loop compile to the same access pattern.
4. **Don't reinvent solved problems.** Physics (Rapier), rendering (Pixi),
   audio (Howler) stay as the underlying libraries. We're not writing a
   physics engine. What we _do_ write is the ergonomics layer on top.

## 2. What we're moving away from, and why

**From the current EmptySock engine** (documented in `CLAUDE.md` today, all of
which is up for replacement):

- Manual `physics.destroy()` on scene unload, manual `new ActorSystem()` /
  `.destroy()` per scene, `onCollisionEnter` requiring a separate registration
  call, `async onUpdate` silently breaking the frame budget. These are all the
  same failure mode: **a resource whose lifetime the engine could own, but
  currently asks the developer to remember instead.** v2's rule: if the engine
  created it, the engine destroys it. No exceptions, no "don't forget."

**From Godot**, since it's the closest thing to a good reference and the user
named it directly — the specific things it gets wrong that we should not copy:

- **Node-inheritance-as-composition.** `KinematicBody2D` vs `RigidBody2D` vs
  `Area2D` is a class hierarchy standing in for what should be independent,
  combinable traits (has a transform, has a collider, has a body type). Deep
  `extends` chains force you into whichever node type happened to bundle the
  behaviors you wanted. We use components, not node subclassing — has-a, not
  is-a, all the way down.
- **String-addressed references.** `NodePath` (`$"../Enemy/Hitbox"`) and
  signal connections wired by name are invisible to the type checker and
  silently break on a rename or a move in the tree. Every cross-reference in
  v2 is a typed handle or a typed query result — refactors that break a
  reference are compile errors, not runtime `null` surprises discovered in
  playtesting.
- **Ambiguous callback ordering.** `_ready`, `_process`, `_physics_process`,
  and signal callbacks can all fire in an order that depends on tree position
  and node type, which even experienced Godot users have to look up. v2 has
  exactly one update phase per frame with one documented, fixed order (§4).
- **Autoload singletons as the escape hatch for shared state.** They work, but
  they're a magic global that's invisible from the call site. v2's equivalent
  (§5, "Services") is still explicit dependency access, not ambient globals.

## 3. The object model: components as data, a friendly handle on top

Entities are **not** classes you subclass. An entity is an opaque ID. Behavior
comes from composing components; components are plain data classes with no
required base-class ceremony beyond declaring their fields. Systems are the
only things that contain logic that runs across many entities at once.

This is a real ECS underneath (components live in contiguous per-type arrays,
not `Map<string, Component>` — more on why in §7), but nobody writing game
code has to think in ECS terms. The facade reads like ordinary OOP:

```ts
// Beginner writes this. No inheritance, no lifecycle methods to override.
const player = scene.spawn("Player", { x: 100, y: 200 });
player.add(Sprite, { texture: "hero.png" });
player.add(PhysicsBody, { type: "dynamic", shape: "capsule" });

player.on(Update, (dt) => {
  const body = player.get(PhysicsBody);
  if (input.isDown("right")) body.velocity.x = 200;
});
```

`player` here is a lightweight handle (an `Entity` value, cheap to copy, valid
until `scene.destroy(player)`), not an object holding your game state — the
state lives in the component arrays `.get()` reaches into. This is the same
trick Bevy/Flecs use to give ECS performance an OOP-shaped front door.

**Power path, same objects:**

```ts
// Same components, no per-entity handles — the power-user path is a query
// over the raw storage, for when you're updating thousands of entities and
// player.get(PhysicsBody) per-entity dispatch is the wrong tool.
scene.query(Transform, PhysicsBody).forEach((transform, body, entity) => {
  transform.x += body.velocity.x * dt;
});
```

Nothing about `Transform`, `PhysicsBody`, or `Sprite` changes between the two
examples. There is one component system, not a simple one and a real one.

## 4. Lifecycle: the engine owns everything it creates

One update phase, fixed order, every frame:

```
1. Input snapshot (InputSystem) — polled once, frozen for the frame
2. Actor mailbox flush (unchanged from v1: drain-before-update, same reasoning)
3. Fixed-timestep physics step(s) (PhysicsSystem/PhysicsSystem3D)
4. Collision/sensor dispatch (still centralized in PhysicsSystem — §6)
5. Behavior/component `Update` callbacks (order: parent before child, stable
   within a frame — no signal-driven reordering)
6. Camera/viewport resolve
7. Render (RenderPipeline)
```

That's the whole list. It's printed once, in the reference docs, and it never
depends on node type or tree depth.

**Resource ownership is structural, not a convention:**

- A `Scene` is created by `Game.loadScene(...)`. The engine creates its
  `ActorSystem` and `PhysicsSystem`/`PhysicsSystem3D` _as part of_ creating the
  scene — they are not separately-constructed objects a developer can forget.
  `Game.unloadScene(...)` tears them down, unconditionally, before the scene's
  own `onUnload` hook runs. There is no code path that leaks a physics world
  or leaves a stale `ActorSystem` registered — because there's no code path
  where the developer constructs those objects at all.
- `onUpdate` cannot be `async` — not "shouldn't," _cannot_. The type it's
  assigned to is `(dt: number) => void`; returning a `Promise<void>` is a
  **type error**, not a runtime footgun to document. Multi-frame work is a
  coroutine (`entity.startCoroutine(...)`, unchanged idea from v1 — it's a
  good escape hatch, keeping it).
- Collision callbacks are a plain property, not a registration call:
  `body.onCollide = (other) => {}`. Setting it is the registration. Dispatch
  is still centralized in `PhysicsSystem` (only it owns the Rapier
  `World`/`EventQueue` — that part of the v1 design was right, see the
  "Collision/sensor callbacks" decision in the current `CLAUDE.md`), it's just
  that "register" and "declare the behavior" are now the same line of code
  instead of two.

**Override point:** advanced users who want manual control over a scene's
physics/actor lifetime (e.g. sharing one physics world across a seamless
open-world "scene" boundary) pass `Game.loadScene(x, { manageLifecycle: false
})` and get the raw `PhysicsSystem`/`ActorSystem` instances to own themselves.
This is the one escape hatch in this section, and it's opt-in per call, not a
global switch.

## 5. Services: the non-Node-Autoload answer to shared state

Godot's autoloads are singletons that are always there, addressed by name,
invisible to the type checker at the call site. v2's equivalent is explicit
and typed:

```ts
class ScoreService {
  score = 0;
  add(n: number) {
    this.score += n;
  }
}

// Registered once, wherever the game boots:
game.services.register(ScoreService);

// Used anywhere, with a real type and a real import:
const score = game.services.get(ScoreService);
score.add(10);
```

Same underlying idea as `PluginSystem` in v1 (process-global, not per-scene),
generalized so it's not a special case just for plugins — save data, audio
mixing state, input remapping, and actual third-party plugins are all
"services," one mechanism instead of several ad hoc singletons.

## 6. Physics & collision — Rapier stays, ergonomics change

- Rapier2D/3D remain the physics backends. No change to what they compute.
- `PhysicsBody` component keeps plain-language properties (`velocity`,
  `type: "dynamic" | "static" | "kinematic"`, `shape`) over raw Rapier types —
  this part of v1 was already right.
- What changes: `onCollide` / `onSensorEnter` etc. become properties you set
  directly on the component (§4), and **default collision groups are inferred
  from scene structure** (two bodies collide unless told not to) rather than
  requiring a layer-mask setup before anything collides at all — the zero-
  config case is "everything collides with everything," and layer/mask
  tuning is the opt-in, not the prerequisite.

## 7. Why real ECS storage, not `Map<string, Component>`

v1's component storage is `Map<string, Component>` keyed by a `type` string
field (documented in `CLAUDE.md` under "Component types as identity keys").
That has two problems v2 drops:

1. **Performance**: a `Map` per entity means no cache-friendly iteration for
   "every entity with a `Transform`" — exactly the access pattern a game loop
   does 60 times a second.
2. **Foolproofness**: the v1 doc explicitly warns that a subclass's `type`
   string won't satisfy a lookup for its base class's `type` — a subtle,
   easy-to-hit bug that a real type-keyed store (keyed by the component
   _class_, not a string a developer has to keep unique and consistent by
   hand) can't produce in the first place.

v2 stores components as structure-of-arrays per component type, queried by
class reference (`entity.get(PhysicsBody)`, `scene.query(Transform, Sprite)`).
No string keys anywhere in the hot path.

## 8. MCP: a live bridge, not a second physics engine

Current state (verified, not assumed): every physics tool in `emptysock-mcp`
(`physics_raycast_2d`, `physics_overlap_circle`, `physics_body_state`) is a
stub that returns `null`/`[]` unconditionally — none of them do real physics,
and `physics_raycast_3d` throws outright. The instinct that led here (3D
needs a WASM build server-side) was solving the wrong problem: **the engine
is already running the real simulation in the browser/Tauri process.** MCP
doesn't need its own copy of Rapier in Node for either 2D or 3D — it needs a
connection to the one that's already live.

v2 architecture:

- The engine exposes a small query/command channel (extending the existing
  `core/IDEBridge.ts` concept) over which a running game instance — the IDE's
  preview iframe, or a launched dev build — answers structured queries:
  raycasts, overlap tests, entity/component reads, scene entity lists.
- `emptysock-mcp` becomes a thin relay: each tool call opens/reuses a
  connection to a running instance (local WebSocket or the IDE's own bridge)
  and forwards the query, returning the real live result.
- **No live instance connected → a clear error, not a fabricated answer.**
  "No live engine connected — start the game in the IDE or launch a dev
  build" beats a silently-wrong `hit: null`. Foolproof cuts both ways: wrong
  answers that look valid are worse than an honest "I don't know."
- Tools that operate on static project data (save files, scene JSON, GMS2
  import, VN script export) are unaffected — they never needed a live
  instance and keep working exactly as they do now.

## 9. Explicitly out of scope for this pass

Per the agreed sequencing: this pass is the engine core design + doc only.
Once the design here is approved and the core is rewritt en, a **separate**
pass rewrites, in this order:

1. `packages/engine` implementation against this doc.
2. `apps/ide` — component/inspector panels, code-gen snippets, the MCP-facing
   IDEBridge channel from §8.
3. `emptysock-mcp` — the live-bridge relay + real tool implementations.
4. `emptysock-ai-skills` (`ai/CLAUDE.md`, `api-reference.json`, `skills/*.md`)
   and `docs/` in this repo — none of it should be touched until the API in
   1–3 is real, or the docs will describe a shape that doesn't exist yet.

GMS2 import: no scope reduction. Only 2.3+ `.yyp`/`.yy` projects are a target
(GMS1.4's `.gmx` format stays out — different, older, XML-based format, not
worth a second importer). The GM8.1 leftover-symbol handling in `compat/`
(surfacing `action_move`/`gml_pragma` etc. as unresolved identifiers rather
than faking them) is _existing, intentional, working behavior_ for projects
that were migrated from GM8.1 into GMS2 — it stays exactly as it is; it was
never proposed for removal, only mischaracterized as "not supporting GM8.1"
in an earlier pass of this conversation, which was wrong. The importer's job
for this pass is an audit: confirm every documented GMS2 2.3+ import path
(events, room layers, sprites, action-list transpilation) is actually wired
end-to-end, not stubbed anywhere in the chain.

## 10. Decisions locked from review round 1

1. **Component inspector metadata: co-located optional schema, not
   decorators.** `Health.schema = { hp: "number" }` sits next to the plain
   class, read by the IDE's Inspector if present; a component with no schema
   still works everywhere, it just gets a raw-JSON fallback editor instead of
   a generated one. Decorators were rejected because they add required
   ceremony to every component and don't work in plain JS without a build
   step — both contradict §1/§3 and the JS decision below. No component ever
   _needs_ a schema to function; it's a docs/tooling nicety a schema turns on.
2. **JavaScript stays first-class, TypeScript is recommended, not required.**
   Both compile/run against the same API — no separate "simple" surface for
   JS. TS users get the full compile-time guarantees in §4 (e.g. `async
onUpdate` as a type error); JS users lose the compile-time check but get a
   dev-mode runtime warning instead (the engine checks whether `onUpdate`'s
   return value has a `.then` and logs a loud console warning naming the
   entity/scene) — degraded, not silent. A JS-authored library imported into
   a TS project (or vice versa) must work via standard `allowJs`/`checkJs`
   interop; this is a hard constraint on every public engine type, not an
   afterthought.
3. **Fixed-timestep physics + interpolated rendering, for both 2D and 3D.**
   Deterministic, no low-framerate tunneling, matches what Rapier expects.
   3D is not held to the same "hide everything" bar as 2D (3D game
   programming has an inherent floor of complexity no engine API removes),
   but it gets the same treatment as 2D otherwise: plain-language wrapper
   types over Rapier's own — verbose where verbose aids clarity, never
   verbose in a way that leaks Rapier handles/descriptors into game code.
4. **No single scaffold — the "new project" flow offers templates.** At
   minimum: empty scene, base 2D, base 3D, base VN (Story Graph module
   enabled), base RPG (BattleSystem + TilemapSystem + presumably ActorSystem
   enabled for NPC/dialogue message-passing — see below). "Cares for
   everything out of the box" is split cleanly: the _engine's_ defaults are
   good regardless of template (no template can turn off automatic
   lifecycle ownership), and the _template_ decides how much starter content
   a new project sees. This also means `emptysock-toolchain new` needs a
   `--template` flag / interactive picker, which is new toolchain scope, not
   just an engine-package concern.

   **What `ActorSystem` is, since it came up:** message-passing between
   entities that shouldn't hold direct references to each other —
   `actor.send(otherId, { type: "damage", amount: 10 })` instead of one
   entity reaching into another's fields directly. It's a scene-scoped event
   bus, most relevant to RPG/VN-shaped games (NPC dialogue triggers, quest
   state changes, turn-based battle messaging) and less obviously needed in
   a straight platformer/arcade template — a reasonable default is: on for
   the VN and RPG templates, off (but one import away) for 2D/3D/empty.

## 11. Open questions — round 2

1. **Top-level entry point naming.** §4 calls it `Game` (`Game.loadScene`,
   `game.services`). v1 doesn't have an equivalent — `SceneManager` is the
   closest thing but isn't the thing a beginner's `main.ts` touches first.
   Is `Game` right, or do you want something else (`App`, `EmptySock`,
   plain `createGame()` with no class at all)?
2. **Scene nesting / composition.** Godot's packed-scene instancing (drop one
   scene inside another) is genuinely useful for prefabs, but its "override
   an inherited scene" feature is one of its messier corners. Do we want
   nested/composable scenes in v2 at all, or is a flat scene + a plain
   "spawn a prefab (a plain data/function template, not a nested scene)"
   mechanism enough?
3. **Is the raw ECS query surface (§3's "power path") a good idea to expose
   at all, or does it undermine "foolproof by default"?** A beginner poking
   around autocomplete will find `scene.query(...)` sitting right next to
   `entity.get(...)` with no signal that one is the 95%-of-the-time path and
   the other is an optimization for thousands-of-entities cases. Do we want
   it visible by default, tucked under a separate import
   (`from "@emptysock/engine/advanced"`) so it doesn't show up until someone
   goes looking, or something else?
4. **Networking ambition.** v1's `NetworkActor`/`Transport` is a thin
   interface — the engine ships zero concrete transport and zero netcode
   (no state sync, no rollback, no reconciliation). Does "the engine cares
   for everything out of the box" extend to multiplayer at all in v2, or
   does networking stay explicitly "bring your own transport and your own
   sync strategy," same as v1, with the interface just cleaned up? Real
   netcode (rollback, interpolation, authority) is a massive scope increase
   if you want it — worth saying no to explicitly if the answer is no,
   rather than leaving it ambiguous.
