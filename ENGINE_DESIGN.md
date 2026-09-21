# EmptySock v2 — Engine Design

Status: **draft, for review**. This is a from-scratch redesign of `packages/engine`
(and what it implies for the IDE, MCP tools, and docs/skills). Nothing is shipping
yet — this file is the spec to argue with before anything gets rewritten. Nobody
uses the current engine, so there is no migration constraint: every idea here is
free to break the current shape of `Scene`/`Entity`/`Component`.

Sections 1–2 are the argument. Sections 3–8 are the actual design. Section 9 is
what's explicitly _not_ in this pass. Sections 10–12 are the review log: each
is a round of open questions followed by the decisions locked from the round
before it — read them in order to see how the design got here, or jump to the
end for the current open questions.

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
// Same components, no per-entity handles — this is the path for when
// you're updating thousands of entities and player.get(PhysicsBody)
// per-entity dispatch is the wrong tool. Same object as spawn/get, no
// separate import — see §12 (round 3) for why it's called `each`, not
// `query`.
scene.each(Transform, PhysicsBody, (transform, body, entity) => {
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
class reference (`entity.get(PhysicsBody)`, `scene.each(Transform, Sprite, ...)`).
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
Once the design here is approved and the core is rewritten, a **separate**
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

## 11. Decisions locked from review round 2

1. **Naming stays plain: `Game`, `Scene`, `Entity`, `Component`.** These
   aren't actually Unity-specific — Godot (Node/Scene), Bevy (Entity/
   Component/System), and Unity (GameObject/Component/Scene) all converge on
   the same vocabulary, because it's what transfers from tutorials, Stack
   Overflow, and every other engine a beginner might have touched. Renaming
   the nouns for personality would cost real searchability for a stylistic
   win. Personality goes where `CLAUDE.md`'s existing IDE-personality section
   already puts it: runtime warnings, error messages, CLI output — e.g. the
   JS `onUpdate`-returns-a-Promise warning reads `"onUpdate returned a
Promise. That's not a thing here — use entity.startCoroutine() instead."`,
   not dry compiler-speak. Same dry, self-aware voice as the IDE, extended
   into the engine's own console output.
2. **Flat scenes, composable prefabs (prefabs can contain prefabs).** No live
   nested scene graph, so nothing to override-resolve. A prefab is a named
   template — components plus optionally other prefabs — spawned as a unit
   (`scene.spawn(EnemyPrefab, { x, y })`). This is the same pattern Bevy
   calls "Bundles": Godot's composition benefit, without a runtime
   parent/child scene tree to get tangled.
3. **`scene.query(...)` becomes `scene.each(...)`, same object, no separate
   import.** The friction was never the module boundary, it was the name —
   "query" reads like a specialized/scary database operation; "each" reads
   like `Array.forEach`, which every JS/TS developer already knows isn't
   scary. `scene.each(Transform, PhysicsBody, (t, b) => {...})` sits right
   next to `entity.get(...)` on the same object; the doc comment does the
   only "this is for many-at-once" signaling needed — no advanced-only
   import path, per your call.
4. **Networking: an official `@emptysock/network` companion package
   wrapping Colyseus, not bundled into core.** Writing real rollback/
   reconciliation netcode ourselves would be a multi-month project outside
   this redesign's scope, and directly against §1's "don't reinvent solved
   problems." Colyseus is TypeScript-native, actively maintained, and its
   schema-based sync model maps cleanly onto marking specific component
   fields as networked. Staying a separate package (not merged into
   `@emptysock/engine`) preserves the original bundle-size reasoning behind
   "Transport is an interface" — a single-player game imports zero
   networking code, but multiplayer is an official, zero-glue-code `npm
install` away, not a from-scratch integration.

## 12. Decisions locked from review round 3

All four recommendations accepted as stated in round 3's questions:

1. **Save/serialization: plain-data constraint, zero effort by default.**
   Components are constrained to JSON-serializable fields via a
   `Serializable` type constraint, plus a dev-mode runtime warning if a
   function sneaks into one anyway. `SaveSystem` serializes any component
   generically — no per-component save/load code required for the common
   case. Custom `serialize`/`deserialize` hooks remain available for the
   genuine edge case (e.g. a reference that must be re-linked after load),
   but they're the exception a component reaches for, not a chore every
   component owes by default.
2. **Visual scripting compiles to the same public API code-first devs use.**
   A "spawn enemy" node generates a literal `scene.spawn(...)` call, not a
   call into a separate visual-scripting-only runtime. `§1.2`'s "one clean
   path to power" now holds for no-code users too — popping open the
   generated code from a Story Graph or `VisualScriptComponent` graph reads
   like the same code a tutorial would teach, and graduating from nodes to
   code isn't learning a second API.
3. **Overlay scenes: `Game.loadOverlay()` alongside `Game.loadScene()`.**
   `loadScene(x)` still replaces the main scene exclusively.
   `loadOverlay(y)` stacks an additional, independently-lifecycled scene on
   top (own `ActorSystem`; no `PhysicsSystem` by default, since a HUD
   doesn't need one) that survives the main scene reloading underneath it.
   Solves HUD/pause-menu/minimap without coupling UI chrome to gameplay
   scene lifecycle.
4. **Pooling folds into `spawn`/`destroy`, not a separate utility.**
   `scene.spawn(BulletPrefab, props, { pool: true })`; `scene.destroy(entity)`
   is the same call whether or not the entity was pooled — the engine
   decides internally whether that call tears the entity down or returns it
   to a pool. `§4`'s "the engine owns destruction" guarantee holds even for
   pooled objects, since the engine still makes the real decision; game code
   never branches on which happened. This absorbs what v1's `ObjectPool.ts`
   did into the spawn/destroy API itself rather than a parallel class to
   learn.

## 13. Decisions locked from review round 4

Three of four went with the recommendation; one (item 2) explicitly didn't —
noted below, not silently overridden.

1. **Package boundary: core + optional module packages.** ECS core, render,
   physics, audio, and input stay in `@emptysock/engine`. VN/Story Graph,
   battle system, tilemap/navmesh, and visual scripting each become their
   own `@emptysock/<module>` package. Project templates (§10.4) declare
   whichever ones they need in the scaffolded `package.json` — a beginner
   never runs an install command by hand — but a 2D platformer's bundle
   never carries a dialogue-box renderer it doesn't use. Direct consequence
   for §9's later-pass ordering: the toolchain's template scaffolding needs
   to know, per template, which module packages to declare.
2. **First run: blank canvas with wiring, not a pre-built running game —
   your call, against my recommendation.** Templates scaffold structure and
   systems (the right modules enabled, `Game`/`Scene` wired per §10.4's
   template list) but leave the screen empty until the developer places
   their first entity. I'd flagged the risk: the very first `npm run dev`
   shows nothing, which is a rougher first five minutes for a total
   beginner than seeing something move immediately. Your call stands as
   written — if this creates a "why is my screen blank" support/docs burden
   once real beginners hit it, the getting-started docs (§9, later pass)
   need to open with "your screen is blank, here's why, here's your first
   entity" as the very first page, not an afterthought.
3. **Hot reload: code hot-swaps, entity/component data survives by
   default.** Editing a behavior or system swaps the code without resetting
   the running scene; positions, health, inventory, etc. persist across the
   edit. A component _shape_ change (field added/removed) forces a full
   reload of just the affected entities, with a console message naming
   which component and why — no silent partial-state corruption. Tweaking
   a jump-height constant doesn't cost you your position in the level.
4. **Scene/prefab files: JSON with generated `.d.ts` types alongside.**
   `scene.spawn(EnemyPrefab, ...)` autocompletes that prefab's actual
   component props, regenerated on every IDE save and by the toolchain's
   own build step (so a code-only, IDE-free workflow gets identical types).
   This is also what makes the IDE's visual Scene/Tilemap/UI editors
   possible at all — they need a file format to read and write, which plain
   TS objects wouldn't give them.

## 14. Decisions locked from review round 5

1. **Asset loading: two tiers, not one — build-time assets auto-preload
   from the scene file, runtime-external assets are explicit and
   explicitly not batched.** My original framing conflated two different
   things; splitting them is the actual answer:
   - **Build-time assets** (the beginner/common case — everything your game
     ships with) are referenced by plain project-relative path
     (`sprite: "hero.png"`). Because scene/prefab files are JSON (§13.4),
     the engine can read a scene's full asset list _before_ activating it
     and preload everything that scene references automatically — no
     manifest to hand-maintain, no pop-in, no explicit preload call for the
     common case, because the "manifest" is just whatever the scene file
     already says it uses. These assets get packed into build-time texture
     atlases by the toolchain (real batching, like Pixi's spritesheet
     packing) — this is also where multi-frame sprites' PNGs get packed
     together, same idea as v1's GMS2-importer sprite handling.
   - **Runtime-external assets** — content not known at build time: mods,
     user uploads, a downloaded skin pack — load through an explicit
     `assets.loadExternal(pathOrUrl)` call, same shape as GameMaker's
     `sprite_add()`. This is the honest, named escape hatch for exactly the
     case you flagged: an externally-loaded sprite cannot be packed into
     the build-time atlas (it didn't exist at build time), so it gets its
     own texture page and its own draw call — real batching cost, same
     tradeoff GameMaker's own docs warn about for `sprite_add`. We don't
     pretend this is free; the API name (`loadExternal`, not just `load`)
     and its docs say plainly "this can't be batched with your bundled
     assets" rather than hiding the cost.
   - Net effect: the zero-effort default has no pop-in (it's preloaded
     because the engine already knows what a scene needs), and the
     "GameMaker `sprite_add`"-shaped need is still there, named
     accurately, with its real performance cost documented instead of
     silently eaten or silently hidden.

2. **Runtime errors: engine-aware overlay, accepted as recommended.** An
   in-preview/in-game error overlay shows the message, the game-code frame
   that threw (engine-internal frames filtered out, not just top-of-stack),
   and which entity/scene it happened in, with a raw "show full stack
   trace" toggle underneath for when the filtered view isn't enough. Built
   on the IDE's existing `ConsolePanel`/`DebugOverlaySystem` surface.
3. **Third-party plugins: named extension points, accepted as
   recommended.** Plugins register against explicit hooks the engine
   exposes (a new component type, a new system, a lifecycle hook like
   "before physics step" or "on scene load") — never a raw reference to
   internal engine state. This is the same mechanism official modules
   (`@emptysock/vn`, `@emptysock/battle`, §13.1) use to plug into core, so
   there's exactly one extension mechanism total, not a separate "official"
   path and "community" path.

## 15. Decisions locked from review round 6

Round 6 covered three areas that separate a hobby engine from one
professionals would actually ship with: how a game gets tested without a
real renderer, whether "same inputs, same outputs" is a promise or an
accident, and how unified input handling is across keyboard/gamepad/touch.

1. **Testing: headless harness, accepted as recommended.**
   `@emptysock/engine/testing` exports a headless `Game`/`Scene` with
   `RenderSystem` swapped for a no-op — `spawn`/`each`/physics/actor
   messaging all behave identically to a real running game, nothing draws.
2. **Determinism: real, revised after research — not the pessimistic take
   originally proposed.** The question "is this a plugin or an additional
   piece to Rapier" was worth actually checking rather than guessing at.
   It's neither a plugin nor something we'd build: Rapier ships pre-built,
   official npm packages — `@dimforge/rapier2d-deterministic-compat` and
   `rapier3d-deterministic-compat` — that are a drop-in swap for the
   default `rapier2d-compat`/`rapier3d-compat` packages already in use,
   giving genuine cross-platform bit-for-bit determinism on any IEEE
   754-2008-compliant platform. Cost: it's a less-optimized build (no
   SIMD), so it's measurably slower than the default. **Decision:** default
   stays the fast, non-deterministic build (matches §1.3 — most games never
   need this and shouldn't pay for it), with an opt-in
   `Game.create({ deterministic: true })` (or equivalent project setting)
   that swaps in the deterministic package instead — same `PhysicsBody`
   API either way, only the underlying WASM build changes. This is §1.4
   ("don't reinvent solved problems") working exactly as intended: the
   right answer was already a library away, not a feature we needed to
   design or maintain ourselves. Determinism still requires the
   developer's own code to behave (seeded RNG via `scene.random`, no
   `Math.random()`/`Date.now()` in simulation-affecting code) — the engine
   makes the physics layer capable of determinism, it can't make a
   deterministic build out of nondeterministic game logic on top of it.
3. **Input: action-mapping layer with raw APIs available, accepted as
   recommended.** `input.isDown("jump")` is the default and the only thing
   most games touch; `input.keyboard`/`input.gamepad(0)`/`input.touches`
   stay available for games that need exact device-level state.

## 16. Decisions locked from review round 7

Researched before asking (sources in the commit history for this section);
all three accepted as recommended.

1. **ECS storage: built on [bitECS](https://github.com/NateTheGreatt/bitECS),
   not hand-written.** bitECS becomes the actual storage engine underneath
   `entity.get`/`add`/`scene.each` — TypeScript-native, structure-of-arrays,
   solving exactly the cache-friendly-iteration problem §7 argues for. The
   OOP-shaped facade is a thin layer over bitECS's real query/component
   API; beginners never see bitECS directly. We are not maintaining our
   own component-storage engine's correctness and performance
   characteristics from scratch — §1.4 applied one level deeper than
   rounds 1–6 took it.
2. **Modding: two separate features, only one in scope for v2.** §14.3's
   named extension points remain for _developer-installed_ plugins —
   trusted the same way any npm dependency is trusted. Letting a shipped
   game's own _players_ load untrusted mod content at runtime is a
   different, harder problem, explicitly named rather than silently
   ignored: if/when it's wanted, [WASM sandboxing is the modern, correct
   answer](https://dev.to/mohameddiallo/4-ways-to-sandbox-untrusted-code-in-2026-1ffb)
   (memory-isolated by construction, no filesystem/network access unless
   explicitly granted) — not a hand-rolled JS-subset interpreter or `eval`
   with a blocklist — and it ships later as its own module
   (`@emptysock/modding`?), not folded into this pass.
3. **Toolchain build pipeline: the CLI's export/build moves to
   [Rolldown](https://www.alexcloudstar.com/blog/vite-8-rolldown-oxc-2026/).**
   ~~This only affects `packages/toolchain`'s real Node-side project
   export — the IDE's in-browser `esbuild-wasm` live-preview path
   (`GameBuildService`) is untouched, since Rolldown's native Rust binary
   can't run inside a browser tab.~~ **Corrected in §17 — that claim was
   wrong, checked and fixed rather than left standing.** Rolldown is Vite
   8's now-stable (1.0, May 2026) default bundler, and `apps/ide` is
   already on Vite 8.

## 17. Decision locked from review round 8: one bundler for everything

You asked specifically to check whether one tool can cover all three build
contexts, because round 7 assumed it couldn't. It was wrong to assume — a
real browser-WASM Rolldown build exists and changes the answer.

**What actually exists, checked, not assumed:**
[`@rolldown/browser`](https://github.com/rolldown/rolldown/discussions/6218)
is an official browser-compatible WASM distribution of Rolldown. Per its
own maintainer (Evan You/VoidZero), [recent optimization work made it "the
fastest possible bundler you can run in the
browser"](https://x.com/evanyou/status/1869608132386922720) — a 2.5k-module
benchmark bundled in 613ms, versus esbuild's 22.19s and Rollup/Vite's
4.52s in the same in-browser test. Its plugin API supports the exact
`resolveId`/`load` virtual-module pattern
`GameBuildService`'s current esbuild-wasm virtual filesystem plugin
already uses (CLAUDE.md's "virtualFiles must include all open files"
decision) — this is a straight port of hook names, not a redesign of how
the IDE feeds open files into a build.

**One bundler for all three build contexts, accepted as recommended (you
deferred to the recommendation, given it directly serves the "one thing
used for everything" goal you stated).** The IDE's own dev/build, the
toolchain CLI's export (§16.3), and `GameBuildService`'s in-browser
live-preview build (currently `esbuild-wasm`) all move to Rolldown/Oxc —
the last one via `@rolldown/browser`, whose plugin API supports the same
`resolveId`/`load` virtual-module shape the current esbuild plugin already
uses, so the port is a hook-name change, not a redesign. **Sequencing
caveat carried forward, not dropped because the recommendation won:**
`@rolldown/browser` is newer and less proven specifically for in-browser
use than Rolldown's Node-side path. When this reaches the implementation
pass (§9), migrate the toolchain CLI first (lower risk, same environment
Rolldown is already proven in), and treat the `GameBuildService` migration
as its own spike — validate the virtual-fs plugin port and real bundle
times against actual project files before cutting the IDE over, rather
than assuming the benchmark holds for this specific integration.

## 18. Audit: are the library picks still current?

You asked for a full sweep, not just the bundler. Checked each load-bearing
external-library decision against current state rather than assuming
rounds 1–7 are still right six-plus rounds later.

**Confirmed unchanged, no action needed:**

- **bitECS** (§16.1) — still the actively-maintained, general-purpose pick.
  [Koota](https://npmtrends.com/@javelin/ecs-vs-bitecs-vs-miniplex-vs-piecs-vs-wolf-ecs)
  exists as a newer alternative but is purpose-built for React Three Fiber
  (maintained by Poimandres) — irrelevant here, we're not on R3F. bitECS
  remains the larger, more established, general-purpose library.
- **Howler** (§1.4, §6) — still current (v2.2.3), still the right tool for
  asset-based sound effect/music playback specifically; the ecosystem's own
  guidance is Howler for game audio, [Tone.js only if you need synthesis/
  generative audio](https://www.pkgpulse.com/guides/howler-vs-tone-js-vs-wavesurfer-web-audio-javascript-2026)
  on top, which nothing in this design calls for.
- **Rapier2D/3D** — no credible displacement found; remains the dominant
  WASM 2D+3D physics choice for JS/TS, which is why §17's deterministic-
  build finding (round 6) was worth having in the first place.

**One gap this audit closed, locked without needing a question — low-stakes,
obvious answer:**

- **Pixi.js renderer default: WebGL, not WebGPU, for now.** Never
  explicitly decided anywhere above. Pixi 8's WebGPU renderer is feature-
  complete, but [Pixi's own guidance is still to prefer WebGL for
  production](https://appscale.blog/en/blog/pixijs-vs-threejs-web-graphics-engine-comparison-2026)
  due to cross-browser WebGPU implementation inconsistencies. `RenderPipeline`
  should default to WebGL (Pixi already auto-detects/falls back), with
  WebGPU available as an explicit opt-in for anyone who wants to test
  against it — revisit the default once browser support matures.

**One real new option, worth an actual question — not a re-confirmation:**

- **Networking (§11.4 locked Colyseus): [PartyKit](https://www.partykit.io/)
  didn't exist as a comparison point when that round ran, and it's a
  legitimately different tradeoff, not a worse Colyseus.** Colyseus needs a
  Node process you run/host yourself (or pay for Colyseus Cloud); PartyKit
  deploys your server logic to Cloudflare's edge with, per its own
  positioning, no separate server to run at all. For "starter friendly,"
  never having to think about hosting a server is a real argument in
  PartyKit's favor that wasn't on the table in round 2. Counter-argument:
  Colyseus ships game-specific primitives (rooms, matchmaking, schema-based
  state sync) out of the box; PartyKit is a more general realtime/collab
  primitive you'd build those same game concepts on top of yourself —
  which is exactly the "don't reinvent" tradeoff §1.4 cares about, just
  pointing the other way this time.

**Decision, accepted as recommended: Colyseus stays the sole
`@emptysock/network` backend for now.** Designing the package's API to
abstract over two genuinely different backend models (Colyseus's
persistent Node room-server vs. PartyKit's edge-deployed Worker) before
either has been built once would be real design risk of an abstraction
that fits neither well. Ship Colyseus first — it remains the more
game-purpose-built of the two (rooms, matchmaking, schema sync out of the
box, per §1.4) — and treat a PartyKit backend as a candidate _second_
`@emptysock/network` transport once the first is real and the abstraction
boundary is known from experience rather than guessed at up front.

## 19. Decisions locked from review round 10

All three accepted as recommended.

1. **API reference docs generate from TSDoc, replacing CLAUDE.md's
   five-location manual ritual.** [TypeDoc +
   typedoc-plugin-markdown](https://typedoc-plugin-markdown.org/) produces
   `docs/reference/` pages directly from TSDoc comments on the actual
   exported classes/methods — matching the Reference section's own stated
   purpose ("Ctrl+F destination, not sequential reading"). `docs/manual/`,
   `docs/guides/`, and `docs/tutorials/` stay hand-written; only the
   mechanical reference pages generate. Writing good TSDoc comments is now
   part of writing the code, not a separate followup step across three
   files.
2. **Localisation and accessibility are first-class on the UI component
   base, not opt-in systems.** Any text-bearing UI component takes a
   translation-key string by default, resolved through `LocalisationSystem`
   automatically; accessibility (font scaling, high-contrast, reduced
   motion) hooks into the same UI component base. `§1`'s foolproof-by-
   default bar now covers UI specifically, closing a gap rounds 1–9 left
   open.
3. **`SaveSystem` picks its storage backend automatically per runtime
   target, with a per-component `migrate()` hook for schema drift.**
   IndexedDB in the browser preview, real filesystem via Tauri's fs plugin
   on desktop — one save/load API, a beginner never chooses a backend.
   Every save carries each component's schema version; on load, a
   mismatched component either runs an optional `migrate(oldData,
oldVersion)` hook or logs a warning and drops just that component's
   data, never corrupting the whole save or crashing. A developer never
   thinks about save compatibility until they actually ship an update that
   needs it.

## 20. Round 11: auditing the existing IDE, not just the engine

Round 11 turned to `apps/ide`'s actual current code instead of more
greenfield brainstorming, prompted directly by "look at the existing
features to rearchitect." Findings and decisions below are grounded in
what the code does today, not assumed.

**Confirmed already correct — carry forward into v2, no change needed:**

- **Asset import already copies into the project.** `AssetBrowser.tsx`'s
  drop/select handlers call `store.write(file.name, file)`, writing bytes
  into the project's own asset store (a real directory the browser's File
  System Access API granted permission to, or Tauri's filesystem on
  desktop) — not a reference to wherever the source file lives on the
  user's OS. Nothing in rounds 1–10 changes this; it needs to be stated
  explicitly in v2's spec rather than left as an unstated existing
  behavior, since a redesign this large could otherwise regress it by
  omission.
- **GMS2 import is real, tested, and already correctly scoped.** Confirmed
  end-to-end against a real exported project (`CLAUDE.md`'s documented
  quirks, synthetic regression tests in `gms2-import.test.ts`), targeting
  2.3+ `.yyp`/`.yy` only — matches §9's already-locked scope exactly.
- **The IDE's own Netlify deployment is a pure static SPA and stays that
  way.** `apps/ide/netlify.toml` confirms no backend — the COOP/COEP
  headers exist solely for `esbuild-wasm`'s `SharedArrayBuffer`
  requirement (moot once §17 lands and that path moves to
  `@rolldown/browser`, which needs checking against the same header
  requirement when that migration happens). **Boundary worth stating
  plainly in the eventual docs pass (§9):** Colyseus (§11.4) and the MCP
  live-bridge (§8) are never part of this deployment. Colyseus is
  infrastructure a _shipped game's own developer_ hosts separately
  (Colyseus Cloud, a VPS, Railway); MCP is a separate local/self-hosted
  process. Neither needs the free Netlify site to do anything different.

**Confirmed real but not yet usability-audited — separate task, not
guessed at here:** `ImageEditor` (797 lines), `VNEditor` (952),
`TilemapEditor` (582), `UIPlacementPanel` (934), `SequenceEditor` (953),
and `ShaderEditor` (647) are all substantial, real implementations, not
stubs. Whether each one actually satisfies `CLAUDE.md`'s own IDE UI
checklist (empty states, action-hint copy, conditional UI, etc.) is a
real, separate screenshot-driven audit — worth doing before v2 ships, not
worth guessing at in a design doc.

**Decisions, both accepted as recommended:**

1. **VS Code integration: add "open in VS Code," don't build real theme/
   extension import.** A button opens the current project folder in the
   user's own installed VS Code (`vscode://` URI scheme, or `code .` on
   desktop/Tauri) — anyone who wants their real extensions, themes, and
   keybindings just uses their real VS Code, no conversion layer needed.
   The IDE's own Monaco stays simple: a handful of built-in themes plus
   the existing settings-subset import. Rejected: parsing real VS Code
   theme JSON into Monaco theme definitions and loading VS Code
   extensions directly — Monaco doesn't support the full VS Code
   extension API at all (many extensions simply couldn't run even if
   imported), making this a partial, maintenance-heavy feature no matter
   how well built.
2. **Adopt changesets for the monorepo now, before the v2 rewrite lands.**
   Every package (`apps/ide`, `packages/engine`, `packages/types`,
   `packages/toolchain`, and the future `@emptysock/vn`/`battle`/
   `network`/etc. module packages from §16.1) is currently hand-pinned at
   `0.1.0` with no changelog/bump automation. Setting up
   [changesets](https://github.com/changesets/changesets) now means the
   first real v2 release already has a real process, instead of
   retrofitting one onto several already-shipped 0.1.0 tags once the
   module-package split makes there be more packages to keep straight.

## 21. Closing a real implementation gap: how the facade actually wraps bitECS

Checked bitECS's real API before calling §16.1 done — it wasn't. bitECS
components are plain objects of parallel typed arrays keyed by a numeric
entity ID, read/written directly:

```ts
const Position = { x: [] as number[], y: [] as number[] };
const eid = addEntity(world);
addComponent(world, eid, Position);
Position.x[eid] = 0; // bitECS's real access pattern — no object, no getter
```

That is not `player.get(PhysicsBody).velocity.x` — §3's promised facade
doesn't fall out of bitECS for free, and assuming it did would have been
discovered mid-implementation instead of now. **Resolution:** `entity.get(Component)`
returns a lazily-created, cached `Proxy` per `(entity, componentType)` pair
whose property getters/setters read and write directly into that
component's underlying bitECS arrays at that entity's index — created
once per (entity, component) the first time it's requested, reused on
every subsequent `.get()` for that pair, never reallocated per call. This
keeps `§1.3`'s performance stance intact (no per-access allocation in the
hot path) while making `.get()` read like a plain object from game code.
`scene.each(...)` bypasses the proxy layer entirely and iterates the raw
arrays directly via bitECS's own `query()` — the actual reason §3 called
out that the power path exists: `each` isn't just "the same thing without
a handle," it's measurably faster because it skips proxy overhead
altogether.

## 22. Implementation readiness — where every prior section stands

You asked to lock the whole engine down before implementation starts. This
is that lock: every major area, its status, and where its decision lives.

| Area                                                                  | Status                                                                                                                                                                                                                                | Where                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Object model / ECS storage                                            | **Locked**                                                                                                                                                                                                                            | §3, §7, §16.1, §21                                                              |
| Entity ID versioning (stale-handle safety)                            | **Locked**                                                                                                                                                                                                                            | §23                                                                             |
| Component identity across hot-reload                                  | **Locked**                                                                                                                                                                                                                            | §23                                                                             |
| Network/ECS bridge (how @emptysock/network touches components)        | **Locked**                                                                                                                                                                                                                            | §23                                                                             |
| Lifecycle (scene/physics/actor ownership)                             | **Locked**                                                                                                                                                                                                                            | §4                                                                              |
| Shared state (services)                                               | **Locked**                                                                                                                                                                                                                            | §5                                                                              |
| Physics & collision ergonomics                                        | **Locked**                                                                                                                                                                                                                            | §6                                                                              |
| Determinism                                                           | **Locked** (opt-in via Rapier's deterministic build)                                                                                                                                                                                  | §15.2                                                                           |
| MCP live bridge                                                       | **Locked** (design only — implementation is §9's pass 3)                                                                                                                                                                              | §8                                                                              |
| Naming (`Game`/`Scene`/`Entity`/`Component`)                          | **Locked**                                                                                                                                                                                                                            | §11.1                                                                           |
| JS/TS support                                                         | **Locked**                                                                                                                                                                                                                            | §10.2                                                                           |
| Scene composition (flat + prefabs)                                    | **Locked**                                                                                                                                                                                                                            | §11.2                                                                           |
| Bulk-iteration API naming (`each`, not `query`)                       | **Locked**                                                                                                                                                                                                                            | §11.3                                                                           |
| Networking (Colyseus only, for now)                                   | **Locked**                                                                                                                                                                                                                            | §11.4, §18                                                                      |
| Save/serialization shape                                              | **Locked**                                                                                                                                                                                                                            | §12.1                                                                           |
| Save durability & schema migration                                    | **Locked**                                                                                                                                                                                                                            | §19.3                                                                           |
| Visual scripting → same public API                                    | **Locked**                                                                                                                                                                                                                            | §12.2                                                                           |
| Overlay scenes                                                        | **Locked**                                                                                                                                                                                                                            | §12.3                                                                           |
| Pooling folded into spawn/destroy                                     | **Locked**                                                                                                                                                                                                                            | §12.4                                                                           |
| Package boundary (core + optional modules)                            | **Locked**                                                                                                                                                                                                                            | §13.1                                                                           |
| First-run scaffold behavior (blank canvas)                            | **Locked**                                                                                                                                                                                                                            | §13.2                                                                           |
| Hot reload guarantees                                                 | **Locked**                                                                                                                                                                                                                            | §13.3                                                                           |
| Scene/prefab file format                                              | **Locked**                                                                                                                                                                                                                            | §13.4                                                                           |
| Asset loading (build-time vs. external)                               | **Locked**                                                                                                                                                                                                                            | §14, §20 (asset-copy behavior confirmed already correct in v1, carries forward) |
| Error UX                                                              | **Locked**                                                                                                                                                                                                                            | §15                                                                             |
| Plugin extension points vs. player modding                            | **Locked**                                                                                                                                                                                                                            | §15, §16.2                                                                      |
| Testing harness                                                       | **Locked**                                                                                                                                                                                                                            | §15.1                                                                           |
| Input model                                                           | **Locked**                                                                                                                                                                                                                            | §15.3                                                                           |
| Bundler (Rolldown/Oxc everywhere)                                     | **Locked**                                                                                                                                                                                                                            | §16.3, §17                                                                      |
| Library picks (bitECS, Howler, Rapier, Pixi renderer default)         | **Locked, audited**                                                                                                                                                                                                                   | §18                                                                             |
| Docs generation (TypeDoc)                                             | **Locked**                                                                                                                                                                                                                            | §19.1                                                                           |
| Localisation/accessibility                                            | **Locked**                                                                                                                                                                                                                            | §19.2                                                                           |
| VS Code integration scope                                             | **Locked**                                                                                                                                                                                                                            | §20                                                                             |
| Release/versioning (changesets)                                       | **Locked**                                                                                                                                                                                                                            | §20                                                                             |
| GMS2 import scope                                                     | **Locked, unchanged from v1**                                                                                                                                                                                                         | §9                                                                              |
| Editor panel usability (Image/VN/Tilemap/UIPlacement/Sequence/Shader) | **Not fully audited** — confirmed real and substantial, not stubs; a full pass against `CLAUDE.md`'s IDE UI checklist is real, separate work                                                                                          | §20                                                                             |
| Module-enable floating-panel bug                                      | **Open, real, reproduced** — logged in `RELEASE_PASS.md` as a v1 bug, not a v2 design question, but must be fixed before v2's module-package split (§13.1) ships, since that split means _more_ modules a developer routinely enables | `RELEASE_PASS.md`                                                               |

**What "locked" means here:** every row above has a stated decision with
reasoning, checked against real code or real research where a check was
possible, and revised at least once when checking surfaced something
better (bitECS's real shape just now, Rolldown's browser build in §17,
the determinism build in §15.2). It does not mean zero remaining
judgment calls during implementation — exact method signatures, file
layout, and the two open items above are real work still ahead. Those are
implementation details to resolve by writing code, not open architectural
forks that would send the design back to the drawing board.

**Two things stand between this and "start writing `packages/engine`":**

1. The module-enable floating-panel bug (v1, `RELEASE_PASS.md`) — not
   blocking, since it's a v1 IDE bug, not a v2 engine decision, but worth
   fixing in the same window since §13.1's module split makes it worse.
2. Your go-ahead. Every open architectural question across 11 rounds has
   a stated, reasoned answer. Say the word and pass 1 of §9 (core engine
   implementation) starts.

## 23. Round 12: one more real gap, both follow-on questions locked

**Found and locked without needing a vote — the same "don't reinvent, the
library already solved it" pattern as Rapier's deterministic build:**
bitECS recycles entity IDs immediately on `removeEntity()` by default —
[a removed entity's ID is handed to the next `addEntity()` call, and
component arrays are never cleared on removal, only the entity's
membership mask](https://ajmmertens.medium.com/doing-a-lot-with-a-little-ecs-identifiers-25a72bd2647).
Held naively, this is a direct contradiction of §2's core pitch ("every
cross-reference in v2 is a typed handle... refactors that break a
reference are compile errors, not runtime `null` surprises" — a stale
`Entity` handle silently aliasing onto a _different, newly-spawned_
entity is worse than Godot's `NodePath` problem, not better, since it
doesn't even fail loudly). bitECS already ships the fix:
[versioned/generational entity IDs, an opt-in number of version bits
(default 8) that make a recycled ID compare unequal to the handle that
used to point at the old entity](https://github.com/NateTheGreatt/bitECS/blob/main/docs/API.md).
**Decision: enabled by default, not configurable off.** A held `Entity`
handle to a destroyed entity must never silently resolve to whatever
entity happens to reuse that slot — `entity.get(...)` on a stale handle
throws or returns `undefined` explicitly, matching §2's actual promise
instead of almost matching it.

**Two forks this surfaced, both locked, accepted as recommended:**

1. **Component identity survives hot-reload via a name-keyed registry, not
   bitECS's raw object identity.** bitECS component definitions are plain
   JS object references (`const Position = {x: [], y: []}`) — component
   _identity_ for its storage purposes is that object's own reference, not
   a string name, which would otherwise mean a hot-swapped module's
   re-evaluated `Position` object silently becomes an unrelated second
   component instead of replacing the old one. Every component is
   registered once under a stable string name (already needed for schema
   files anyway, §13.4); the engine's component registry is keyed by that
   name, and a hot-swap _replaces_ the registry's entry for `"Position"`.
   bitECS still sees one stable definition from the registry's point of
   view; the engine layer is what makes §13.3's "the code changed, the
   data didn't" promise actually true underneath a library that
   identifies components by reference.
2. **`@emptysock/network` reads/writes through the same `.get()` Proxy
   layer (§21), not a separate bitECS-array fast path.** Networked state
   is replicated a handful of times a second to a handful of clients, not
   the thousands-of-entities-at-60fps case `scene.each()` exists for —
   proxy overhead there isn't the thing worth optimizing against.
   `@emptysock/network` never needs to know bitECS exists; it only ever
   sees the same `Component` classes and `.get()` shape every other part
   of the engine sees. One bridge implementation, not two, and no
   bitECS-internals dependency leaking into what's supposed to be an
   optional add-on package.
