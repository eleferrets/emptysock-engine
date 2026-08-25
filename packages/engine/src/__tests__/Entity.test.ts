import { describe, it, expect, beforeEach } from 'vitest';
import { Entity } from '../core/Entity.js';
import { Component } from '../core/Component.js';

class TestComp extends Component {
  public value: number;
  constructor(v: number = 0) {
    super('TestComp');
    this.value = v;
  }
}

describe('Entity', () => {
  let entity: Entity;

  beforeEach(() => {
    entity = new Entity('TestEntity');
  });

  it('has an id and name', () => {
    expect(typeof entity.id).toBe('number');
    expect(entity.name).toBe('TestEntity');
  });

  it('addComponent / getComponent / hasComponent', () => {
    const comp = new TestComp(42);
    entity.addComponent(comp);
    expect(entity.hasComponent('TestComp')).toBe(true);
    expect(entity.getComponent<TestComp>('TestComp')?.value).toBe(42);
  });

  it('throws if same component type added twice', () => {
    entity.addComponent(new TestComp());
    expect(() => entity.addComponent(new TestComp())).toThrow();
  });

  it('removeComponent', () => {
    entity.addComponent(new TestComp());
    const removed = entity.removeComponent('TestComp');
    expect(removed).toBe(true);
    expect(entity.hasComponent('TestComp')).toBe(false);
  });

  it('removeComponent returns false if not found', () => {
    expect(entity.removeComponent('Missing')).toBe(false);
  });

  it('tags: add, check, remove via Set', () => {
    entity.addTag('player');
    entity.addTag('hero');
    expect(entity.hasTag('player')).toBe(true);
    expect(entity.hasTag('hero')).toBe(true);
    entity.tags.delete('hero');
    expect(entity.hasTag('hero')).toBe(false);
  });

  it('active defaults to true', () => {
    expect(entity.active).toBe(true);
  });

  it('getComponents returns all components', () => {
    entity.addComponent(new TestComp());
    expect(entity.getComponents().size).toBe(1);
  });
});
