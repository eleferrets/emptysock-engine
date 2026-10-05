import type { Relation } from "bitecs";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
/**
 * the release notes Track 3 / ground rule 4a's real relation. Every widget
 * entity that has a parent carries one `WidgetParent(parentEid)` pair
 * component pointing at it. `withAutoRemoveSubject()` means destroying a
 * parent widget's underlying entity cascades: bitECS removes the relation
 * pair from every child automatically, and `WidgetTree` reacts to that the
 * same way it reacts to an explicit `destroyWidget()` — via the next
 * `layout()` pass no longer finding that child's ancestor chain, and the
 * caller's own `Scene.destroy()` on the parent (which is what actually
 * triggers this) is expected to destroy the child entities itself, same as
 * any other parent/child game-object relationship. This relation carries no
 * store — it's a pure structural edge — so `createRelation()` is called with
 * no `withStore()` modifier, only `withAutoRemoveSubject()`.
 */
export declare const WidgetParent: Relation<unknown>;
/**
 * Ground rule 4a's ECS-native widget tree: each widget is its own entity
 * (`LayoutStyle` + `Layout` components), parent/child is the `WidgetParent`
 * bitECS relation above, and a layout pass orders entities parent-before-
 * child via `query(world, [LayoutStyle, Hierarchy(WidgetParent)])` — bitECS
 * sorts that query's results by hierarchy depth ascending, so every root
 * widget (depth 0, no `WidgetParent` component) comes before its children,
 * and every child comes before its own children in turn. This is the real
 * mechanism the release notes "queryHierarchy/Cascade" note was pointing
 * at: `queryHierarchy` itself is an internal bitECS function, not part of
 * the public API surface bitecs@0.4.0 actually exports — the *documented*
 * and exported way to get the same depth-ordered traversal is `query()`
 * plus the `Hierarchy()`/`Cascade()` query-term modifier (the two are
 * literally the same function under an alias in this version).
 *
 * `yoga-layout@3.2.1` does the actual measure/arrange math (the release notes
 * Track 3's library-first decision) — this class never reimplements flexbox
 * itself. It mirrors the bitECS relation tree into yoga `Node`s, one per widget
 * id, reused across `layout()` calls (styles updated, children re-linked,
 * nodes freed when a widget leaves the tree).
 * Scroll containers (`LayoutStyle.overflow === 2`) shift their children's
 * absolute positions by the clamped `scrollX`/`scrollY`.
 */
export declare class WidgetTree {
  private _yoga;
  private readonly _entities;
  private readonly _yogaNodes;
  /**
   * Loads yoga's WASM module. Must be awaited before the first `layout()`
   * call. Deliberately separate from the constructor (which stays
   * synchronous) — the release notes flagged confirming yoga's async
   * `loadYoga()` composes with the engine's synchronous boot path as the
   * one real integration risk here; keeping `init()` as an explicit,
   * separately-awaited step (the same shape `RenderPipeline.init()` and
   * `PhysicsSystem.init()` already use) is how that risk is resolved: a
   * `WidgetTree` can be constructed synchronously alongside everything
   * else in a scene's `onLoad`, with only the actual layout math gated on
   * the awaited WASM load, not object construction itself.
   */
  init(): Promise<void>;
  /** Whether `init()` has completed — `layout()` throws if called before this is true. */
  get ready(): boolean;
  /**
   * Spawns a new widget entity with `LayoutStyle`+`Layout` already
   * attached, optionally parented under `parent` via the `WidgetParent`
   * relation (ground rule 4a). `WidgetTree` keeps its own `eid -> Entity`
   * map rather than reconstructing an `Entity` handle from a bare eid
   * later (`Scene`'s own proxy cache is private) — every eid this class
   * ever operates on came from a `createWidget()` call, so this map is
   * always complete for the widgets it owns.
   */
  createWidget(scene: Scene, parent?: Entity): Entity;
  /**
   * Destroys a widget entity and its own bookkeeping. Does **not** walk
   * `WidgetParent` children itself — `Scene.destroy()`'s normal semantics
   * (ground rule 4a's `withAutoRemoveSubject()` only detaches the relation
   * pair, it doesn't cascade-destroy the child entity's other components)
   * mean the caller is responsible for destroying a widget's children the
   * same way any other parent/child game object would be, typically by
   * walking `getRelationTargets`'s inverse (this class's own tree) before
   * calling this.
   */
  destroyWidget(scene: Scene, entity: Entity): void;
  /** The `WidgetParent` relation's target for `entity`, or `undefined` for a root widget. */
  parentOf(scene: Scene, entity: Entity): Entity | undefined;
  /**
   * Every widget entity in `scene`, root-first then each subtree
   * depth-first (bitECS sorts a `Hierarchy()`-modified query by ascending
   * depth, breaking ties by ascending eid — see the class doc comment).
   * `query()`/`Hierarchy()` need the actual bitECS-registered store object
   * `ComponentRegistry` created for `LayoutStyle` (name-keyed, per-World —
   * see CLAUDE.md's "Component shape-change detection" entry), not the
   * plain `ComponentDef` object `entity.add()`/`.get()` take: those two are
   * deliberately different objects so hot-reloading a component's module
   * doesn't break bitECS's own identity tracking.
   *
   * Filters out any eid `entityExists()` no longer recognizes before
   * mapping to this tree's own `Entity` handles — a real gotcha found
   * while prototyping this: bitECS's `Hierarchy`/`Cascade` query result is
   * cached per-relation and is only invalidated by a `WidgetParent`
   * pair being added/removed, *not* by a plain `Scene.destroy()`
   * (`removeEntity`) on a widget that has no children of its own. Without
   * this filter, destroying a childless widget and then calling
   * `layout()`/`orderedWidgets()` again could still hand back its stale
   * eid, and `getRelationTargets` throws on a destroyed eid.
   */
  orderedWidgets(scene: Scene): Entity[];
  /**
   * Runs one full layout pass over every widget in `scene` and writes each
   * one's absolute on-screen box to its `Layout` component. `rootWidth`/
   * `rootHeight` size every root widget's available space (a root widget
   * with `LayoutStyle.width === -1` still fills the given root size, same
   * as a top-level `Scene`/viewport would).
   */
  layout(scene: Scene, rootWidth: number, rootHeight: number): void;
  /** Number of live yoga nodes this tree owns (for leak checks). */
  get yogaNodeCount(): number;
  /** Frees every yoga node this tree currently owns. Call from `Scene.onUnload`/`Game`'s scene teardown. */
  destroy(): void;
}
export declare function detachWidgetParent(scene: Scene, entity: Entity): void;
