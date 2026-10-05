import {
  addComponent,
  createRelation,
  entityExists,
  getRelationTargets,
  Hierarchy,
  query,
  removeComponent,
  withAutoRemoveSubject,
} from "bitecs";
import type { Relation } from "bitecs";
import {
  loadYoga,
  Edge,
  FlexDirection,
  Gutter,
  PositionType,
} from "yoga-layout/load";
import type { Node as YogaNode, Yoga } from "yoga-layout/load";
import type { Entity } from "../Entity.js";
import type { Scene } from "../Scene.js";
import { componentRegistry } from "../ComponentRegistry.js";
import { Layout, LayoutStyle } from "../components/Layout.js";

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
export const WidgetParent: Relation<unknown> = createRelation(
  withAutoRemoveSubject,
);

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
export class WidgetTree {
  private _yoga: Yoga | null = null;
  private readonly _entities = new Map<number, Entity>();
  private readonly _yogaNodes = new Map<number, YogaNode>();

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
  async init(): Promise<void> {
    this._yoga = await loadYoga();
  }

  /** Whether `init()` has completed — `layout()` throws if called before this is true. */
  get ready(): boolean {
    return this._yoga !== null;
  }

  /**
   * Spawns a new widget entity with `LayoutStyle`+`Layout` already
   * attached, optionally parented under `parent` via the `WidgetParent`
   * relation (ground rule 4a). `WidgetTree` keeps its own `eid -> Entity`
   * map rather than reconstructing an `Entity` handle from a bare eid
   * later (`Scene`'s own proxy cache is private) — every eid this class
   * ever operates on came from a `createWidget()` call, so this map is
   * always complete for the widgets it owns.
   */
  createWidget(scene: Scene, parent?: Entity): Entity {
    const entity = scene.spawn();
    entity.add(LayoutStyle);
    entity.add(Layout);
    if (parent !== undefined) {
      addComponent(scene.world, entity.eid, WidgetParent(parent.eid));
    }
    this._entities.set(entity.eid, entity);
    return entity;
  }

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
  destroyWidget(scene: Scene, entity: Entity): void {
    this._entities.delete(entity.eid);
    const node = this._yogaNodes.get(entity.eid);
    if (node !== undefined) {
      node.free();
      this._yogaNodes.delete(entity.eid);
    }
    scene.destroy(entity);
  }

  /** The `WidgetParent` relation's target for `entity`, or `undefined` for a root widget. */
  parentOf(scene: Scene, entity: Entity): Entity | undefined {
    const targets = getRelationTargets(scene.world, entity.eid, WidgetParent);
    const parentEid = targets[0];
    if (parentEid === undefined) return undefined;
    return this._entities.get(parentEid);
  }

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
  orderedWidgets(scene: Scene): Entity[] {
    const layoutStyleStore = componentRegistry.ensure(scene.world, LayoutStyle);
    const order = query(scene.world, [
      layoutStyleStore,
      Hierarchy(WidgetParent),
    ]);
    const widgets: Entity[] = [];
    for (const eid of order) {
      if (!entityExists(scene.world, eid)) continue;
      const entity = this._entities.get(eid);
      if (entity !== undefined) widgets.push(entity);
    }
    return widgets;
  }

  /**
   * Runs one full layout pass over every widget in `scene` and writes each
   * one's absolute on-screen box to its `Layout` component. `rootWidth`/
   * `rootHeight` size every root widget's available space (a root widget
   * with `LayoutStyle.width === -1` still fills the given root size, same
   * as a top-level `Scene`/viewport would).
   */
  layout(scene: Scene, rootWidth: number, rootHeight: number): void {
    if (this._yoga === null) {
      throw new Error(
        "WidgetTree.layout() called before init() resolved — await widgetTree.init() once before the first layout pass.",
      );
    }
    const yoga = this._yoga;

    const order = this.orderedWidgets(scene);
    const live = new Set<number>();
    for (const entity of order) live.add(entity.eid);

    // Detach all children first so stale nodes can be freed safely and the
    // structure re-linked in current order.
    for (const node of this._yogaNodes.values()) {
      while (node.getChildCount() > 0) node.removeChild(node.getChild(0));
    }
    for (const [eid, node] of this._yogaNodes) {
      if (live.has(eid)) continue;
      node.free();
      this._yogaNodes.delete(eid);
    }

    const childCounts = new Map<number, number>();

    for (const entity of order) {
      const style = entity.get(LayoutStyle);
      if (style === undefined) continue;

      let node = this._yogaNodes.get(entity.eid);
      if (node === undefined) {
        node = yoga.Node.create();
        this._yogaNodes.set(entity.eid, node);
      }
      node.setFlexDirection(
        style.flexDirection === 1 ? FlexDirection.Row : FlexDirection.Column,
      );
      if (style.width === -1) node.setWidthAuto();
      else node.setWidth(style.width);
      if (style.height === -1) node.setHeightAuto();
      else node.setHeight(style.height);
      node.setFlexGrow(style.flexGrow);
      node.setFlexShrink(style.flexShrink);
      node.setPadding(Edge.All, style.padding);
      node.setGap(Gutter.All, style.gap);
      if (style.positionType === 1) {
        node.setPositionType(PositionType.Absolute);
        node.setPosition(Edge.Left, style.left);
        node.setPosition(Edge.Top, style.top);
      } else {
        node.setPositionType(PositionType.Relative);
        node.setPosition(Edge.Left, undefined);
        node.setPosition(Edge.Top, undefined);
      }

      const targets = getRelationTargets(scene.world, entity.eid, WidgetParent);
      const parentEid = targets[0];
      if (parentEid !== undefined) {
        const parentNode = this._yogaNodes.get(parentEid);
        if (parentNode !== undefined) {
          const index = childCounts.get(parentEid) ?? 0;
          parentNode.insertChild(node, index);
          childCounts.set(parentEid, index + 1);
        }
      }
    }

    // Root widgets are every entity in `order` with no WidgetParent target.
    for (const entity of order) {
      const targets = getRelationTargets(scene.world, entity.eid, WidgetParent);
      if (targets.length > 0) continue;
      const node = this._yogaNodes.get(entity.eid);
      node?.calculateLayout(rootWidth, rootHeight);
    }

    // Second pass, same root-first order: accumulate absolute position from
    // each entity's already-written-this-pass parent Layout.
    for (const entity of order) {
      const node = this._yogaNodes.get(entity.eid);
      if (node === undefined) continue;
      const box = node.getComputedLayout();
      const targets = getRelationTargets(scene.world, entity.eid, WidgetParent);
      const parentEid = targets[0];
      const parentLayout =
        parentEid !== undefined
          ? this._entities.get(parentEid)?.get(Layout)
          : undefined;
      const layout = entity.get(Layout);
      if (layout === undefined) continue;
      let offX = 0;
      let offY = 0;
      const parentEntity =
        parentEid !== undefined ? this._entities.get(parentEid) : undefined;
      const parentStyle = parentEntity?.get(LayoutStyle);
      const parentNode =
        parentEid !== undefined ? this._yogaNodes.get(parentEid) : undefined;
      if (parentStyle?.overflow === 2 && parentNode !== undefined) {
        const [maxX, maxY] = scrollExtent(parentNode, parentStyle.padding);
        offX = Math.min(Math.max(0, parentStyle.scrollX), maxX);
        offY = Math.min(Math.max(0, parentStyle.scrollY), maxY);
      }
      layout.x = (parentLayout?.x ?? 0) + box.left - offX;
      layout.y = (parentLayout?.y ?? 0) + box.top - offY;
      layout.width = box.width;
      layout.height = box.height;
    }
  }

  /** Number of live yoga nodes this tree owns (for leak checks). */
  get yogaNodeCount(): number {
    return this._yogaNodes.size;
  }

  /** Frees every yoga node this tree currently owns. Call from `Scene.onUnload`/`Game`'s scene teardown. */
  destroy(): void {
    for (const node of this._yogaNodes.values()) node.free();
    this._yogaNodes.clear();
    this._entities.clear();
    this._yoga = null;
  }
}

/** Max scroll offsets for a container: content extent minus its own box. */
function scrollExtent(node: YogaNode, padding: number): [number, number] {
  const own = node.getComputedLayout();
  let right = 0;
  let bottom = 0;
  for (let i = 0; i < node.getChildCount(); i++) {
    const c = node.getChild(i).getComputedLayout();
    right = Math.max(right, c.left + c.width);
    bottom = Math.max(bottom, c.top + c.height);
  }
  return [
    Math.max(0, right + padding - own.width),
    Math.max(0, bottom + padding - own.height),
  ];
}

// Kept for the (rare) caller that needs to detach a widget from its parent
// without destroying it outright — e.g. re-parenting into a different list.
// Relations are per-target pair components, so the actual current target
// has to be looked up first; there is nothing to remove for an
// already-rootless widget.
export function detachWidgetParent(scene: Scene, entity: Entity): void {
  const targets = getRelationTargets(scene.world, entity.eid, WidgetParent);
  for (const target of targets) {
    removeComponent(scene.world, entity.eid, WidgetParent(target));
  }
}
