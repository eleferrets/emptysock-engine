import type RAPIER_TYPE from '@dimforge/rapier2d-compat';

type RapierModule = typeof RAPIER_TYPE;

export interface PhysicsWorldOptions {
  gravity?: { x: number; y: number };
  timestep?: number;
}

export class PhysicsSystem {
  private _RAPIER: RapierModule | null = null;
  private _world: InstanceType<RapierModule['World']> | null = null;
  private _timestep: number = 1 / 60;
  private _accumulator: number = 0;

  async init(options: PhysicsWorldOptions = {}): Promise<void> {
    // Dynamic import to handle WASM loading
    const RAPIER = await import('@dimforge/rapier2d-compat');
    await RAPIER.init();
    this._RAPIER = RAPIER;

    this._timestep = options.timestep ?? 1 / 60;
    const gravity = options.gravity ?? { x: 0, y: -9.81 };

    this._world = new RAPIER.World(gravity);
  }

  get world(): InstanceType<RapierModule['World']> {
    if (this._world === null) throw new Error('PhysicsSystem not initialized');
    return this._world;
  }

  get RAPIER(): RapierModule {
    if (this._RAPIER === null) throw new Error('PhysicsSystem not initialized');
    return this._RAPIER;
  }

  step(deltaTime: number): void {
    if (this._world === null) return;

    this._accumulator += deltaTime;
    while (this._accumulator >= this._timestep) {
      this._world.step();
      this._accumulator -= this._timestep;
    }
  }

  destroy(): void {
    this._world?.free();
    this._world = null;
    this._RAPIER = null;
  }
}
