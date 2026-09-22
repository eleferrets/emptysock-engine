/**
 * `@emptysock/network` — the official Colyseus companion package
 * (ENGINE_DESIGN.md §11.4/§23.2). A single-player game that never imports
 * this package pays nothing for it: it is a separate workspace package
 * from `@emptysock/engine`, not a subpath of it, so nothing here can ever
 * end up in an engine bundle that doesn't ask for it (mirrors the engine's
 * "Transport is an interface, not a class" bundle-size reasoning).
 *
 * This package never touches bitECS. Every read/write to game state goes
 * through `entity.get(Component)` — the same proxy every other part of the
 * engine uses (§23.2).
 */
export {
  networked,
  getNetworkedFields,
  isNetworkedComponent,
  clearNetworkedFields,
} from "./NetworkedFields.js";
export { NetworkEntityMap } from "./NetworkEntityMap.js";
export { NetworkSystem } from "./NetworkSystem.js";
export type {
  NetworkSystemOptions,
  NetworkSyncPayload,
} from "./NetworkSystem.js";
export type {
  RoomLike,
  SchemaProxyLike,
  SchemaCollectionLike,
  StateCallbacksProxy,
  CallbackProxyFn,
  GetStateCallbacksFn,
} from "./colyseusTypes.js";
