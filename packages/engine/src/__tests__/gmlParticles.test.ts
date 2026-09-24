import { describe, it, expect, beforeEach, vi } from "vitest";
import { Scene } from "../Scene.js";
import { ParticleEmitter } from "../systems/ParticleSystem.js";
import type { GmlActionContext } from "../compat/gmlActions.js";
import type {
  GmlParticleContext,
  ParticleMountTarget,
} from "../compat/gmlParticles.js";
import {
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
  part_type_colour3,
  part_type_alpha1,
  part_type_alpha2,
  part_type_alpha3,
  part_type_speed,
  part_type_direction,
  part_type_gravity,
  part_type_life,
  part_type_blend,
  part_system_create,
  part_system_exists,
  part_system_destroy,
  part_system_position,
  part_system_depth,
  part_particles_create,
  part_particles_create_colour,
  part_particles_create_color,
  part_particles_clear,
  _getParticleTypeConfig,
  _getParticleSystemEmitters,
} from "../compat/gmlParticles.js";

function makeCtx(particles?: ParticleMountTarget): GmlParticleContext {
  const scene = new Scene();
  const base: GmlActionContext = { scene };
  return particles === undefined ? { ...base } : { ...base, particles };
}

function fakeMountTarget(): ParticleMountTarget & {
  mounted: ParticleEmitter[];
  unmounted: ParticleEmitter[];
} {
  const mounted: ParticleEmitter[] = [];
  const unmounted: ParticleEmitter[] = [];
  return {
    mounted,
    unmounted,
    mountParticles: vi.fn((emitter: ParticleEmitter) => {
      mounted.push(emitter);
      return Promise.resolve();
    }),
    unmountParticles: vi.fn((emitter: ParticleEmitter) => {
      unmounted.push(emitter);
    }),
  };
}

describe("gmlParticles — part_type_* handle lifecycle", () => {
  it("create/exists/destroy round-trip", () => {
    const t = part_type_create();
    expect(part_type_exists(t)).toBe(true);
    part_type_destroy(t);
    expect(part_type_exists(t)).toBe(false);
  });

  it("unknown type id is an honest no-op with a warning, never a throw", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => part_type_shape(999999, 1)).not.toThrow();
    expect(() => part_type_clear(999999)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("part_type_clear resets to just-created defaults", () => {
    const t = part_type_create();
    part_type_size(t, 2, 3, 0.1);
    part_type_colour1(t, 0xff0000);
    part_type_clear(t);
    const cfg = _getParticleTypeConfig(t);
    expect(cfg?.sizeMin).toBe(1);
    expect(cfg?.colours).toEqual([0xffffff]);
  });

  it("color1 US alias is the same function as colour1", () => {
    expect(part_type_color1).toBe(part_type_colour1);
  });

  it("colour1/2/3 store the right number of gradient stops", () => {
    const t = part_type_create();
    part_type_colour1(t, 0x112233);
    expect(_getParticleTypeConfig(t)?.colours).toEqual([0x112233]);

    part_type_colour2(t, 0x111111, 0x222222);
    expect(_getParticleTypeConfig(t)?.colours).toEqual([0x111111, 0x222222]);

    part_type_colour3(t, 0xaa0000, 0x00aa00, 0x0000aa);
    expect(_getParticleTypeConfig(t)?.colours).toEqual([
      0xaa0000, 0x00aa00, 0x0000aa,
    ]);
  });

  it("alpha1 sets a fixed alpha for the whole life", () => {
    const t = part_type_create();
    part_type_alpha1(t, 0.5);
    expect(_getParticleTypeConfig(t)?.alphaStart).toBe(0.5);
    expect(_getParticleTypeConfig(t)?.alphaEnd).toBe(0.5);
  });

  it("alpha2 is an exact start/end translation", () => {
    const t = part_type_create();
    part_type_alpha2(t, 0.2, 0.8);
    expect(_getParticleTypeConfig(t)?.alphaStart).toBe(0.2);
    expect(_getParticleTypeConfig(t)?.alphaEnd).toBe(0.8);
  });

  it("alpha3's middle stop is dropped (documented approximation) — start/end come from alpha1/alpha3", () => {
    const t = part_type_create();
    part_type_alpha3(t, 0.1, 0.99, 0.9);
    expect(_getParticleTypeConfig(t)?.alphaStart).toBe(0.1);
    expect(_getParticleTypeConfig(t)?.alphaEnd).toBe(0.9);
  });

  it("gravity/speed/direction/life/sprite/shape all record onto the type config", () => {
    const t = part_type_create();
    part_type_sprite(t, "assets/spark.png");
    part_type_shape(t, 7);
    part_type_speed(t, 10, 20);
    part_type_direction(t, 0, 90);
    part_type_gravity(t, 5, 90);
    part_type_life(t, 30, 60);
    const cfg = _getParticleTypeConfig(t);
    expect(cfg?.texturePath).toBe("assets/spark.png");
    expect(cfg?.shapeConstant).toBe(7);
    expect(cfg?.speedMin).toBe(10);
    expect(cfg?.speedMax).toBe(20);
    expect(cfg?.dirMin).toBe(0);
    expect(cfg?.dirMax).toBe(90);
    expect(cfg?.gravityAmount).toBe(5);
    expect(cfg?.gravityDirection).toBe(90);
    expect(cfg?.lifeMinSteps).toBe(30);
    expect(cfg?.lifeMaxSteps).toBe(60);
  });

  it("size/speed/direction wiggle are recorded onto the type config", () => {
    const t = part_type_create();
    part_type_size(t, 2, 3, 0.1, 0.5);
    part_type_speed(t, 10, 20, 0, 4);
    part_type_direction(t, 0, 90, 0, 15);
    const cfg = _getParticleTypeConfig(t);
    expect(cfg?.sizeWiggle).toBe(0.5);
    expect(cfg?.speedWiggle).toBe(4);
    expect(cfg?.dirWiggle).toBe(15);
  });

  it("wiggle defaults to 0 when not given", () => {
    const t = part_type_create();
    part_type_size(t, 2, 3);
    part_type_speed(t, 10, 20);
    part_type_direction(t, 0, 90);
    const cfg = _getParticleTypeConfig(t);
    expect(cfg?.sizeWiggle).toBe(0);
    expect(cfg?.speedWiggle).toBe(0);
    expect(cfg?.dirWiggle).toBe(0);
  });

  it("part_type_blend records normal by default and additive when set", () => {
    const t = part_type_create();
    expect(_getParticleTypeConfig(t)?.blend).toBe("normal");
    part_type_blend(t, true);
    expect(_getParticleTypeConfig(t)?.blend).toBe("add");
    part_type_blend(t, false);
    expect(_getParticleTypeConfig(t)?.blend).toBe("normal");
  });
});

describe("gmlParticles — part_system_* handle lifecycle", () => {
  it("create/exists round-trip, and unknown ids are honest no-ops", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = part_system_create();
    expect(part_system_exists(s)).toBe(true);
    expect(() => part_system_position(999999, 0, 0)).not.toThrow();
    expect(() => part_particles_clear(999999)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("part_system_depth is accepted but has no observable effect (documented gap)", () => {
    expect(() => part_system_depth(1, 5)).not.toThrow();
  });
});

describe("gmlParticles — part_particles_create actually produces a live ParticleEmitter", () => {
  let typeId: number;
  let systemId: number;
  let ctx: GmlParticleContext;

  beforeEach(() => {
    typeId = part_type_create();
    part_type_size(typeId, 2, 2, 0, 0.3);
    part_type_colour2(typeId, 0xff0000, 0x0000ff);
    part_type_alpha2(typeId, 1, 0);
    part_type_speed(typeId, 100, 100, 0, 7);
    part_type_direction(typeId, 0, 0, 0, 12); // straight right in this codebase's convention
    part_type_gravity(typeId, 50, 90); // straight down
    part_type_life(typeId, 60, 60); // 1 second at the assumed 60 steps/sec
    part_type_blend(typeId, true);

    systemId = part_system_create();
    ctx = makeCtx();
  });

  it("spawns a real emitter and bursts particles into it", () => {
    part_particles_create(ctx, systemId, 10, 20, typeId, 5);
    const emitters = _getParticleSystemEmitters(systemId);
    const emitter = emitters?.get(typeId);
    expect(emitter).toBeInstanceOf(ParticleEmitter);
    expect(emitter?.x).toBe(10);
    expect(emitter?.y).toBe(20);
    expect(emitter?.activeCount).toBe(5);
  });

  it("translates size/colour/alpha/speed/gravity/life onto real ParticleEmitterOptions", () => {
    part_particles_create(ctx, systemId, 0, 0, typeId, 1);
    const emitter = _getParticleSystemEmitters(systemId)?.get(typeId);
    expect(emitter).toBeDefined();
    const opts = emitter?.options;
    expect(opts?.startScale).toBe(2);
    expect(opts?.colorGradient).toEqual([0xff0000, 0x0000ff]);
    expect(opts?.startAlpha).toBe(1);
    expect(opts?.endAlpha).toBe(0);
    expect(opts?.lifetime.min).toBeCloseTo(1);
    expect(opts?.lifetime.max).toBeCloseTo(1);
    // direction 0 (screen-right) at speed 100 -> vx bounds both include 100.
    expect(opts?.velocity.x?.max).toBeCloseTo(100, 5);
    // gravity 50 at direction 90 (screen-down) -> ay = 50.
    expect(opts?.acceleration.y).toBeCloseTo(50, 5);
    expect(opts?.sizeWiggle).toBe(0.3);
    expect(opts?.speedWiggle).toBe(7);
    expect(opts?.dirWiggle).toBe(12);
    expect(opts?.blendMode).toBe("add");
  });

  it("respects part_system_position's offset for subsequent spawns", () => {
    part_system_position(systemId, 100, 200);
    part_particles_create(ctx, systemId, 5, 5, typeId, 1);
    const emitter = _getParticleSystemEmitters(systemId)?.get(typeId);
    expect(emitter?.x).toBe(105);
    expect(emitter?.y).toBe(205);
  });

  it("mounts the emitter through ctx.particles when wired, and never throws when it isn't", () => {
    const mount = fakeMountTarget();
    const wiredCtx = makeCtx(mount);
    part_particles_create(wiredCtx, systemId, 0, 0, typeId, 1);
    const emitter = _getParticleSystemEmitters(systemId)?.get(typeId);
    expect(mount.mountParticles).toHaveBeenCalledWith(emitter);

    // Unwired ctx (no `particles`) still simulates real particles, just never mounts.
    const unwiredSystemId = part_system_create();
    expect(() =>
      part_particles_create(ctx, unwiredSystemId, 0, 0, typeId, 1),
    ).not.toThrow();
    expect(
      _getParticleSystemEmitters(unwiredSystemId)?.get(typeId)?.activeCount,
    ).toBe(1);
  });

  it("reuses the same emitter across repeated bursts of the same (system, type) pair", () => {
    part_particles_create(ctx, systemId, 0, 0, typeId, 1);
    const first = _getParticleSystemEmitters(systemId)?.get(typeId);
    part_particles_create(ctx, systemId, 0, 0, typeId, 1);
    const second = _getParticleSystemEmitters(systemId)?.get(typeId);
    expect(first).toBe(second);
    expect(second?.activeCount).toBe(2);
  });

  it("unknown system id or unknown type id is an honest no-op with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      part_particles_create(ctx, 999999, 0, 0, typeId, 1),
    ).not.toThrow();
    expect(() =>
      part_particles_create(ctx, systemId, 0, 0, 999999, 1),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe("gmlParticles — part_particles_create_colour", () => {
  it("overrides the burst's colour, then restores the type's own gradient", () => {
    const typeId = part_type_create();
    part_type_colour2(typeId, 0x111111, 0x222222);
    const systemId = part_system_create();
    const ctx = makeCtx();

    part_particles_create_colour(ctx, systemId, 0, 0, typeId, 0xabcdef, 3);
    const emitter = _getParticleSystemEmitters(systemId)?.get(typeId);
    expect(emitter?.activeCount).toBe(3);
    // The gradient is restored after the burst — a subsequent plain
    // part_particles_create call uses the type's own configured colours.
    expect(emitter?.options.colorGradient).toEqual([0x111111, 0x222222]);
  });

  it("US color alias is the same function", () => {
    expect(part_particles_create_color).toBe(part_particles_create_colour);
  });
});

describe("gmlParticles — part_particles_clear / part_system_destroy teardown", () => {
  it("part_particles_clear empties every emitter in the system without destroying it", () => {
    const typeId = part_type_create();
    const systemId = part_system_create();
    const ctx = makeCtx();
    part_particles_create(ctx, systemId, 0, 0, typeId, 4);
    const emitter = _getParticleSystemEmitters(systemId)?.get(typeId);
    expect(emitter?.activeCount).toBe(4);

    part_particles_clear(systemId);
    expect(emitter?.activeCount).toBe(0);
    expect(part_system_exists(systemId)).toBe(true);
  });

  it("part_system_destroy unmounts and frees the system, and the handle is gone after", () => {
    const typeId = part_type_create();
    const systemId = part_system_create();
    const mount = fakeMountTarget();
    const ctx = makeCtx(mount);
    part_particles_create(ctx, systemId, 0, 0, typeId, 2);
    const emitter = _getParticleSystemEmitters(systemId)?.get(typeId);

    part_system_destroy(systemId, ctx);
    expect(mount.unmountParticles).toHaveBeenCalledWith(emitter);
    expect(part_system_exists(systemId)).toBe(false);
    expect(_getParticleSystemEmitters(systemId)).toBeUndefined();
  });

  it("part_system_destroy on an unknown id is an honest no-op with a warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = makeCtx();
    expect(() => part_system_destroy(999999, ctx)).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
