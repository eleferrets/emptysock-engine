import type { Entity } from "@emptysock/engine";

/**
 * Bidirectional map between a Colyseus network id (a room state schema
 * instance's key in its parent `MapSchema` — typically the owning client's
 * `sessionId` for a per-player entity, or a synthetic id such as
 * `"npc:<n>"` the server assigns for non-player networked entities) and the
 * local bitECS-backed `Entity` handle that mirrors it in *this* process's
 * scene.
 *
 * Network room state has no notion of a local entity id — bitECS hands out
 * ids per-`World`, and client/server (and every other connected client)
 * each run their own `World` with their own numbering. This map is the
 * seam: everything that talks to Colyseus deals in network ids, everything
 * that talks to the ECS deals in `Entity` handles, and this class is the
 * only place that knows both.
 */
export class NetworkEntityMap {
  private readonly _byNetworkId = new Map<string, Entity>();
  private readonly _byEid = new Map<number, string>();

  /** Register `entity` as the local mirror of `networkId`. Replaces any prior mapping for either side. */
  set(networkId: string, entity: Entity): void {
    const previousNetworkId = this._byEid.get(entity.rawId);
    if (previousNetworkId !== undefined) {
      this._byNetworkId.delete(previousNetworkId);
    }
    const previousEntity = this._byNetworkId.get(networkId);
    if (previousEntity !== undefined) {
      this._byEid.delete(previousEntity.rawId);
    }
    this._byNetworkId.set(networkId, entity);
    this._byEid.set(entity.rawId, networkId);
  }

  /** The local `Entity` mirroring `networkId`, if one has been registered. */
  getEntity(networkId: string): Entity | undefined {
    return this._byNetworkId.get(networkId);
  }

  /** The network id `entity` was registered under, if any. */
  getNetworkId(entity: Entity): string | undefined {
    return this._byEid.get(entity.rawId);
  }

  /** Drop the mapping for `networkId` (the remote entity left/despawned). No-op if unmapped. */
  deleteByNetworkId(networkId: string): void {
    const entity = this._byNetworkId.get(networkId);
    if (entity === undefined) return;
    this._byNetworkId.delete(networkId);
    this._byEid.delete(entity.rawId);
  }

  /** Drop the mapping for `entity` (it was destroyed locally). No-op if unmapped. */
  deleteByEntity(entity: Entity): void {
    const networkId = this._byEid.get(entity.rawId);
    if (networkId === undefined) return;
    this._byEid.delete(entity.rawId);
    this._byNetworkId.delete(networkId);
  }

  /** All currently-mapped `[networkId, Entity]` pairs. */
  entries(): IterableIterator<[string, Entity]> {
    return this._byNetworkId.entries();
  }

  get size(): number {
    return this._byNetworkId.size;
  }
}
