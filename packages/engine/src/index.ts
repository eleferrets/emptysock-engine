/**
 * `@emptysock/engine` — the bitECS-backed ECS core (see ENGINE_DESIGN.md and
 * CLAUDE.md). This is the engine's one and only game-authoring surface:
 * `apps/ide` bundles it as `window.EmptySockEngine` for the preview iframe
 * and types Monaco's Code editor against it, and it's the surface every
 * project template and the live Inspector bridge (`bridge/QueryChannel.ts`)
 * target. There is exactly one export surface — no subpath split, and no
 * second, parallel object model anywhere in this package.
 */
export { defineComponent } from "./Component.js";
export type {
  ComponentDef,
  ComponentSchema,
  ComponentFieldSchema,
  DefineComponentOptions,
} from "./Component.js";
export { componentRegistry } from "./ComponentRegistry.js";
export { Entity } from "./Entity.js";
export { Scene } from "./Scene.js";
export type { SpawnOptions } from "./Scene.js";
export { definePrefab, flattenPrefab, prefabComponentDefs } from "./Prefab.js";
export type { PrefabDef, PrefabComponentEntry } from "./Prefab.js";
export {
  parsePrefabFile,
  parsePrefabFiles,
  loadSceneFile,
} from "./SceneFile.js";
export type {
  PrefabFile,
  PrefabFileComponentEntry,
  SceneFile,
  SceneFileEntity,
  SceneFilePrefabInstance,
  ComponentLookup,
  LoadSceneFileOptions,
} from "./SceneFile.js";
export {
  startCoroutine,
  stopCoroutine,
  updateCoroutines,
  clearCoroutines,
  waitFrames,
  waitSeconds,
  waitUntil,
} from "./Coroutines.js";
export type {
  CoroutineHandle,
  CoroutineFactory,
  CoroutineGen,
  CoroutineYield,
} from "./Coroutines.js";
export { Game, defineScene } from "./Game.js";
// ActorSystem (§ CLAUDE.md "ActorSystem mailbox ordering") — `Game.loadScene()`/
// `loadOverlay()` construct one per scene and hand it to game code as
// `SceneLifecycle.actors`. `Actor`/`Message`/`ActorId` are exported here so
// game code can define its own `Actor` subclasses.
export { Actor } from "./Actor.js";
export type { Message, ActorId } from "./Actor.js";
export { ActorSystem } from "./ActorSystem.js";
export { CameraSystem } from "./systems/CameraSystem.js";
export type { CameraState, CameraBounds } from "./systems/CameraSystem.js";
export { TweenManager } from "./systems/TweenSystem.js";
export type {
  TweenOptions,
  TweenHandle,
  EasingName,
} from "./systems/TweenSystem.js";
export { SequenceSystem, evaluateTrackAt } from "./systems/SequenceSystem.js";
export type {
  SequenceDefinition,
  SequenceTrackDef,
} from "./systems/SequenceSystem.js";
export { ParticleEmitter } from "./systems/ParticleSystem.js";
export type {
  ParticleEmitterOptions,
  EmitterShape,
} from "./systems/ParticleSystem.js";
export { createCustomShaderFilter } from "./systems/CustomShaderFilter.js";
export type { CustomShaderFilter } from "./systems/CustomShaderFilter.js";
// `Game`'s five constructor-registered services (CLAUDE.md's "PluginSystem,
// VariableStore, LocalisationSystem, ViewportSystem, and WindowSystem are
// Game services" entry) — game code needs the class itself as a type-safe
// key for `game.services.get(VariableStore)`/`ctx.plugins` etc.
export { PluginSystem } from "./PluginSystem.js";
export type { Plugin, PluginContext } from "./PluginSystem.js";
export { VariableStore, evaluateCondition } from "./systems/VariableStore.js";
export type {
  VariableStoreData,
  VariableCondition,
} from "./systems/VariableStore.js";
export { LocalisationSystem } from "./systems/LocalisationSystem.js";
export type { Locale, TranslationMap } from "./systems/LocalisationSystem.js";
export {
  ViewportSystem,
  computeViewportSize,
  gpuTierRenderDefaults,
} from "./systems/ViewportSystem.js";
export type {
  ScaleMode,
  ResizableRenderTarget,
  ViewportConfig,
  ViewportSize,
  SafeAreaInsets,
} from "./systems/ViewportSystem.js";
export { WindowSystem } from "./systems/WindowSystem.js";
export type { WindowMode, WindowConfig } from "./systems/WindowSystem.js";
// Pure, dependency-free utilities — `AStarSearch` has no imports at all, and
// `Vec2` is a plain `{x, y}` shape re-exported from `Entity.ts`.
export { AStarSearch } from "./AStarSearch.js";
export type { AStarSearchOptions, AStarSearchResult } from "./AStarSearch.js";
export type { Vec2 } from "./Entity.js";
export type {
  UpdateFn,
  SceneDefinition,
  SceneLifecycle,
  LoadSceneOptions,
  LoadOverlayOptions,
  SceneRenderer,
} from "./Game.js";
export { Diagnostics } from "./Diagnostics.js";
export { InputManager } from "./Input.js";
export type {
  Binding,
  ActionMap,
  KeyboardSnapshot,
  GamepadSnapshot,
} from "./Input.js";
export type {
  PointerState,
  Gesture,
  TapGesture,
  LongPressGesture,
  SwipeGesture,
  PinchGesture,
  WheelEventInfo,
} from "./systems/PointerSystem.js";
export type { Serializable, SerializableRecord } from "./Serializable.js";
export { Transform } from "./components/Transform.js";
export { Meta } from "./components/Meta.js";
export type { MetaShape } from "./components/Meta.js";
export { Sprite } from "./components/Sprite.js";
export { Layout, LayoutStyle } from "./components/Layout.js";
export {
  WidgetAppearance,
  Label,
  PanelStyle,
  ButtonState,
  Checkbox,
  Slider,
  Progress,
  ImageWidget,
} from "./components/Widgets.js";
export {
  WidgetParent,
  WidgetTree,
  detachWidgetParent,
} from "./ui/WidgetTree.js";
export { UISystem } from "./ui/UISystem.js";
export { resolveAnchoredPosition } from "./ui/Anchor.js";
export type { WidgetAnchor, AnchoredPosition } from "./ui/Anchor.js";
export { RenderPipeline } from "./systems/RenderPipeline.js";
export type {
  RenderPipelineOptions,
  TextureLoader,
  TileLayerSource,
  AutoTileResolver,
} from "./systems/RenderPipeline.js";
export { ServiceRegistry } from "./Services.js";
export type { ServiceConstructor } from "./Services.js";
export { SaveSystem } from "./systems/SaveSystem.js";
export type { MigrateFn, SaveSystemOptions } from "./systems/SaveSystem.js";
export { MemoryStorageAdapter } from "./systems/StorageAdapter.js";
export type { StorageAdapter } from "./systems/StorageAdapter.js";
export { CGGallery } from "./systems/CGGallery.js";
export type { CGEntry, CGGalleryOptions } from "./systems/CGGallery.js";
export { SceneTransitionManager } from "./systems/SceneTransition.js";
export type {
  TransitionEffect,
  TransitionOptions,
  TransitionEffectSink,
} from "./systems/SceneTransition.js";
export { DebugOverlaySystem } from "./systems/DebugOverlaySystem.js";
export type {
  LogLevel,
  DebugLogEntry,
  DebugCommandHandler,
} from "./systems/DebugOverlaySystem.js";
export {
  PhysicsSystem,
  PhysicsNotInitializedError,
} from "./systems/PhysicsSystem.js";
export type {
  PhysicsSystemOptions,
  RaycastHit2D,
  BodyState2D,
} from "./systems/PhysicsSystem.js";
export { PhysicsSystem3D } from "./systems/PhysicsSystem3D.js";
export type {
  PhysicsSystem3DOptions,
  PhysicsBody3DOptions,
  Physics3DHandle,
  BodyType3D,
  Shape3D,
  Vec3,
  Quat,
  RaycastHit,
  CollisionEvent,
} from "./systems/PhysicsSystem3D.js";
export { PhysicsBody, getPhysicsBody } from "./components/PhysicsBody.js";
export {
  VisualScriptState,
  registerVisualScriptGraph,
  getVisualScriptGraph,
  unregisterVisualScriptGraph,
  VisualScriptGraphBuilder,
} from "./components/VisualScript.js";
export type {
  VisualScriptGraph,
  VSNode,
  VSNodeKind,
  VSConnection,
  OnUpdateNode,
  OnEventNode,
  SequenceNode,
  BranchNode,
  GetVariableNode,
  SetVariableNode,
  GetSwitchNode,
  SetSwitchNode,
  SendMessageNode,
} from "./components/VisualScript.js";
export {
  VisualScriptSystem,
  compileVisualScriptGraph,
} from "./systems/VisualScriptSystem.js";
export type { VSCompiledContext } from "./systems/VisualScriptSystem.js";
export { QueryChannel } from "./bridge/QueryChannel.js";
export type {
  EngineQuery,
  EngineQueryRequest,
  EngineQueryResponse,
  EngineQueryResult,
  EngineQueryError,
  EngineQueryErrorCode,
  EntitySummary,
  RaycastResultData,
  BodyStateData,
  ListEntitiesQuery,
  EntityInfoQuery,
  GetComponentQuery,
  SetComponentQuery,
  Raycast2DQuery,
  OverlapCircle2DQuery,
  BodyState2DQuery,
  CreateEntityQuery,
  ActorSendMessageQuery,
  ActorBroadcastQuery,
  ActorInboxSizeQuery,
  ActorListQuery,
  NavMeshFindPathQuery,
  NavMeshNearestNodeQuery,
  CreateEntityData,
  ActorSendResultData,
  ActorBroadcastResultData,
  NavMeshQuerySource,
  QueryChannelAttachOptions,
} from "./bridge/QueryChannel.js";
export type {
  PhysicsBodyHandle,
  PhysicsBodyType,
  PhysicsBodyShape,
  ContactInfo,
  CollisionCallback,
  SensorCallback,
} from "./components/PhysicsBody.js";

/**
 * Curated list of built-in `componentName`s an editor's "Add Component"
 * picker can offer for an entity that isn't live yet — there is no running
 * `Scene`/`World` to ask `componentRegistry.registeredComponents()` about
 * in that editing-time context, so some static list is unavoidable. It
 * deliberately does not try to be exhaustive (widget/UI components,
 * `Meta`, and anything a game defines itself via `defineComponent` are real
 * components that just aren't offered from this generic picker) — extend it
 * as new built-in components earn a place in that dropdown.
 */
export const COMPONENT_REGISTRY: readonly string[] = [
  "Transform",
  "Sprite",
  "PhysicsBody",
  "Meta",
] as const;

/**
 * GameMaker 8.1 drag-and-drop action-library compat (see CLAUDE.md's
 * "GMS2 DnD action-library compat" entry) — a GMS2-imported `.behavior.ts`
 * module calls these directly, threaded a `GmlActionContext` by
 * `gms2-codegen.ts`.
 */
export type { GmlActionContext } from "./compat/gmlActions.js";
export {
  action_move,
  action_move_to,
  action_snap,
  action_set_friction,
  action_set_relative,
  consumeRelativeFlag,
  action_sprite_set,
  action_sprite_color,
  action_next_room,
  action_another_room,
  action_create_object,
  instance_create,
  action_kill_object,
  action_set_alarm,
  action_sound,
  action_if_collision,
  action_if_aligned,
  action_if_empty,
  action_if_mouse,
  action_if_question,
  gmlActionsStep,
  clearGmlActionState,
} from "./compat/gmlActions.js";
export type { GmlDrawTarget } from "./compat/gml.js";

/**
 * GameMaker Studio 2 particle-function compat (`part_type_*`/`part_system_*`)
 * — see `compat/gmlParticles.ts`'s module doc comment for why these take
 * `(ctx: GmlParticleContext, ...)` rather than `gmlActions.ts`'s
 * `(entity, ctx, ...)` shape: GameMaker's own particle API is handle-based,
 * not tied to a specific instance.
 */
export type {
  GmlParticleContext,
  ParticleMountTarget,
} from "./compat/gmlParticles.js";
export {
  part_type_create,
  part_type_destroy,
  part_type_exists,
  part_type_clear,
  part_type_shape,
  part_type_sprite,
  part_type_size,
  part_type_colour1,
  part_type_color1,
  part_type_colour2,
  part_type_color2,
  part_type_colour3,
  part_type_color3,
  part_type_alpha1,
  part_type_alpha2,
  part_type_alpha3,
  part_type_speed,
  part_type_direction,
  part_type_gravity,
  part_type_life,
  part_system_create,
  part_system_exists,
  part_system_destroy,
  part_system_position,
  part_system_depth,
  part_particles_create,
  part_particles_create_colour,
  part_particles_create_color,
  part_particles_clear,
} from "./compat/gmlParticles.js";

/**
 * Pure/global GML scripting-function compat (~50 of GameMaker's most-used
 * built-ins — `ds_map_*`/`ds_list_*`, `string_*`, `draw_*`, math/random
 * helpers) — the sibling to the entity-affecting DnD action library above.
 * A GMS2-imported `.behavior.ts` module or hand-written game code calls
 * these directly off this one export surface; there is no
 * `@emptysock/engine/compat` subpath (per this package's "one export
 * surface" rule) despite an older `gms2-codegen.ts` comment template once
 * suggesting one.
 */
export {
  setRoomSize,
  room_width,
  room_height,
  lerp,
  clamp,
  sign,
  frac,
  lengthdir_x,
  lengthdir_y,
  point_distance,
  point_direction,
  degtorad,
  radtodeg,
  irandom,
  irandom_range,
  random,
  random_range,
  choose,
  string,
  string_length,
  string_copy,
  string_pos,
  string_lower,
  string_upper,
  string_repeat,
  string_delete,
  ds_map_create,
  ds_map_destroy,
  ds_map_set,
  ds_map_find_value,
  ds_map_exists,
  ds_map_delete,
  ds_list_create,
  ds_list_destroy,
  ds_list_add,
  ds_list_find_value,
  ds_list_size,
  ds_list_delete,
  draw_set_colour,
  draw_rectangle,
  draw_circle,
  draw_text,
  draw_line,
  show_message,
  game_end,
  object_exists,
  asset_get_index,
  array_length_1d,
  string_char_at,
  keyboard_wait,
  mouse_button_down,
  mouse_button_released,
  place_free,
  place_empty,
} from "./compat/gml.js";

/**
 * Real, automatic dispatch for GMS2-imported `.behavior.ts` modules — see
 * CLAUDE.md's "GML behavior dispatch: three Step passes, a separate Draw GUI
 * pass" entry.
 */
export {
  GmlBehaviorState,
  registerGmlBehavior,
  getGmlBehavior,
  unregisterGmlBehavior,
  getGmlBehaviorHandler,
} from "./components/GmlBehavior.js";
export type { GmlBehaviorModule } from "./components/GmlBehavior.js";
export { GmlBehaviorSystem } from "./systems/GmlBehaviorSystem.js";
export {
  resolveGmlObjectType,
  checkGmlAabbOverlap,
  dispatchGmlCollision,
} from "./systems/GmlCollision.js";
