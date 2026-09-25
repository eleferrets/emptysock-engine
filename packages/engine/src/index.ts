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
  SceneFileView,
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
export {
  createRainGlassFilter,
  RainGlassFilter,
} from "./systems/RainGlassFilter.js";
export type { RainGlassFilterOptions } from "./systems/RainGlassFilter.js";
// `Game`'s five constructor-registered services (CLAUDE.md's "PluginSystem,
// VariableStore, LocalisationSystem, ViewportSystem, and WindowSystem are
// Game services" entry) — game code needs the class itself as a type-safe
// key for `game.services.get(VariableStore)`/`ctx.plugins` etc.
export { PluginSystem } from "./PluginSystem.js";
export type { Plugin, PluginContext } from "./PluginSystem.js";
export { VariableStore, evaluateCondition } from "./systems/VariableStore.js";
export { GlobalStore } from "./systems/GlobalStore.js";
export { GmlFileSystem } from "./systems/GmlFileSystem.js";
export { FontRegistry } from "./systems/FontRegistry.js";
export type { FontDescriptor } from "./systems/FontRegistry.js";
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
export { LightSource } from "./components/LightSource.js";
export { LightOccluder } from "./components/LightOccluder.js";
export {
  LightingSystem,
  type AmbientLight,
  type LightSample,
  type LightingSystemOptions,
} from "./systems/LightingSystem.js";
export {
  computeVisibilityPolygon,
  pointInPolygon,
  boxOccluderSegments,
  boxWithinReach,
  type Point,
  type Segment,
} from "./systems/LightOcclusion.js";
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
export type { CameraViewport } from "./systems/RenderSystem.js";
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
  room_goto,
  action_create_object,
  instance_create,
  instance_create_layer,
  with_each,
  action_kill_object,
  instance_destroy,
  action_set_alarm,
  action_sound,
  audio_play_sound,
  action_if_collision,
  action_if_aligned,
  action_if_empty,
  action_if_mouse,
  action_if_question,
  gmlActionsStep,
  clearGmlActionState,
} from "./compat/gmlActions.js";
/**
 * GMS2.3+ `layer_sequence_create()` compat (see CLAUDE.md's "GmsProjectRuntime"
 * entry's `sequence_index` research and `compat/gmlSequences.ts`'s own doc
 * comment) — the one real GML source shape a Sequence-driven entity is
 * spawned from.
 */
export { layer_sequence_create } from "./compat/gmlSequences.js";
export type { GmlDrawTarget } from "./compat/gml.js";
export {
  getGmlVar,
  setGmlVar,
  hasGmlVar,
  clearGmlInstanceVars,
} from "./compat/gmlInstanceVars.js";

/**
 * GameMaker's "hypothetical position" collision-query family
 * (`place_meeting`/`place_free`/`position_meeting`/`instance_place`/
 * `collision_*`, see CLAUDE.md's "GMS2 DnD action-library compat" section)
 * — real GameMaker solid-wall collision code calls these directly from
 * transpiled GML; none of them move the calling instance.
 */
export type { GmlObjectRef } from "./compat/gmlCollisionQueries.js";
export {
  place_meeting,
  place_free,
  place_snapped,
  position_meeting,
  position_free,
  instance_place,
  instance_position,
  collision_rectangle,
  collision_circle,
  collision_line,
  collision_point,
  instance_exists,
  instance_number,
} from "./compat/gmlCollisionQueries.js";

export {
  file_exists,
  file_text_open_read,
  file_text_open_write,
  file_text_open_append,
  file_text_read_string,
  file_text_read_real,
  file_text_readln,
  file_text_eof,
  file_text_write_string,
  file_text_write_real,
  file_text_writeln,
  file_text_close,
  file_delete,
} from "./compat/gmlFileText.js";

/**
 * Compat layer for a real, custom GameMaker lighting system
 * (`lightrender`-style controller + per-instance light objects) onto this
 * engine's own `LightingSystem`/`LightSource`/`LightOccluder` — see
 * `compat/gmlLighting.ts`'s module doc comment for why GameMaker itself has
 * no fixed API here to transpile from, and what a Create-event call site
 * looks like once this exists.
 */
export type { GmlLightingContext } from "./compat/gmlLighting.js";
export {
  light_attach,
  light_set_enabled,
  light_set_colour,
  light_set_radius,
  light_set_intensity,
  light_remove,
  light_occluder_attach,
  light_occluder_set_enabled,
  light_occluder_remove,
  lighting_set_ambient,
  lighting_get_ambient,
} from "./compat/gmlLighting.js";

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
  part_type_blend,
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
 * GameMaker Studio 2 camera/view-function compat (`camera_*`/`view_*`) —
 * see `compat/gmlCamera.ts`'s module doc comment for the real relationship
 * between GameMaker's legacy 8-slot `view_*` array system and its modern
 * handle-based `camera_*` API, and for why these take
 * `(ctx: GmlCameraContext, ...)` rather than `gmlActions.ts`'s
 * `(entity, ctx, ...)` shape — none of GameMaker's own camera/view functions
 * take an instance argument either.
 */
export type { GmlCameraContext } from "./compat/gmlCamera.js";
export {
  camera_create,
  camera_create_view,
  camera_destroy,
  camera_get_active,
  camera_get_view_x,
  camera_get_view_y,
  camera_get_view_width,
  camera_get_view_height,
  camera_get_view_angle,
  camera_get_view_speed_x,
  camera_get_view_speed_y,
  camera_set_view_pos,
  camera_set_view_size,
  camera_set_view_angle,
  camera_set_view_speed,
  view_get_camera,
  view_set_camera,
  view_get_visible,
  view_set_visible,
  view_get_enabled,
  view_set_enabled,
  clearGmlCameraState,
} from "./compat/gmlCamera.js";
export type { GmlCameraViewport } from "./compat/gmlCamera.js";
export {
  buildActiveGmlCameraViewports,
  configureGmlViewsFromRoom,
  stepGmlCameraFollow,
  stepAllGmlCameraFollows,
} from "./compat/gmlCamera.js";

/**
 * GameMaker's legacy `d3d_*` pseudo-3D projection compat — see
 * `compat/gmlProjection.ts`'s module doc comment and CLAUDE.md's "Pseudo-3D
 * projection" entry for the full mechanism (four corners written onto
 * `Projection3D`, consumed by `RenderPipeline`'s sprite-sync pass via a
 * real pixi `PerspectiveMesh`).
 */
export {
  d3d_set_projection_ortho,
  d3d_set_projection_perspective,
  d3d_transform_clear,
  d3d_transform_set_identity,
  d3d_transform_set_rotation_x,
  d3d_transform_set_rotation_y,
  d3d_transform_set_rotation_z,
  d3d_transform_set_scaling,
  d3d_transform_set_translation,
  clearGmlProjectionState,
} from "./compat/gmlProjection.js";
export { Projection3D } from "./components/Projection3D.js";

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
  c_aqua,
  c_black,
  c_blue,
  c_dkgray,
  c_fuchsia,
  c_gray,
  c_green,
  c_lime,
  c_ltgray,
  c_maroon,
  c_navy,
  c_olive,
  c_orange,
  c_purple,
  c_red,
  c_silver,
  c_teal,
  c_white,
  c_yellow,
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
  draw_sprite,
  draw_line,
  show_message,
  game_end,
  object_exists,
  asset_get_index,
  array_length_1d,
  array_length,
  array_create,
  array_resize,
  array_push,
  array_pop,
  array_insert,
  array_delete,
  array_sort,
  array_contains,
  array_map,
  array_filter,
  array_reduce,
  string_char_at,
  keyboard_wait,
  mouse_button_down,
  mouse_button_released,
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

export {
  TimelineState,
  registerGmlTimeline,
  getGmlTimeline,
  unregisterGmlTimeline,
} from "./components/GmlTimeline.js";
export type {
  TimelineModule,
  TimelineMoment,
} from "./components/GmlTimeline.js";
export { TimelineSystem } from "./systems/TimelineSystem.js";

export {
  GmlSequenceState,
  registerGmlSequence,
  getGmlSequence,
  unregisterGmlSequence,
} from "./components/GmlSequence.js";
export type {
  GmlSequenceData,
  GmlSequenceTrack,
  GmlSequenceTrackTarget,
  GmlSequenceKeyframe,
  GmlSequenceInterpolation,
} from "./components/GmlSequence.js";
export { GmlSequenceSystem } from "./systems/GmlSequenceSystem.js";

export { GmsProjectRuntime } from "./GmsRuntime.js";
export type {
  GmsProjectManifest,
  GmsProjectData,
  GmsProjectRuntimeOptions,
  GmsRuntimeContext,
} from "./GmsRuntime.js";
