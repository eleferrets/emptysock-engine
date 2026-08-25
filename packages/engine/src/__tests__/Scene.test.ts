import { describe, it, expect, beforeEach } from 'vitest';
import { Scene } from '../core/Scene.js';

describe('Scene', () => {
  let scene: Scene;

  beforeEach(() => {
    scene = new Scene('TestScene');
  });

  it('createEntity adds entity to scene', () => {
    const e = scene.createEntity('Player');
    expect(e.name).toBe('Player');
    expect(scene.getEntities().size).toBe(1);
  });

  it('removeEntity removes entity', () => {
    const e = scene.createEntity('Temp');
    expect(scene.getEntities().size).toBe(1);
    scene.removeEntity(e);
    expect(scene.getEntities().size).toBe(0);
  });

  it('getEntityByTag returns correct entities', () => {
    const e1 = scene.createEntity('A');
    e1.addTag('player');
    const e2 = scene.createEntity('B');
    e2.addTag('enemy');
    const players = scene.getEntitiesByTag('player');
    expect(players.length).toBe(1);
    expect(players[0]?.name).toBe('A');
  });

  it('entity count after multiple operations', () => {
    const a = scene.createEntity('A');
    scene.createEntity('B');
    scene.createEntity('C');
    expect(scene.getEntities().size).toBe(3);
    scene.removeEntity(a);
    expect(scene.getEntities().size).toBe(2);
  });

  it('update does not run when not started', () => {
    let ran = false;
    scene.addSystem('test', (_s, _dt) => { ran = true; });
    scene.update(0.016);
    expect(ran).toBe(false);
  });

  it('update runs systems when started', () => {
    let ran = false;
    scene.addSystem('test', (_s, _dt) => { ran = true; });
    scene.start();
    scene.update(0.016);
    expect(ran).toBe(true);
  });
});
