import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UISystem } from '../systems/UISystem.js';

beforeEach(() => { UISystem.clear(); });

describe('UISystem', () => {
  it('creates a component and adds to roots', () => {
    const btn = UISystem.create('button', { x: 10, y: 20, width: 100, height: 40, text: 'OK' });
    expect(UISystem.roots).toContain(btn);
    expect(btn.text).toBe('OK');
  });

  it('click handler fires on triggerClick', () => {
    const fn = vi.fn();
    const btn = UISystem.create('button', { width: 100, height: 40 });
    btn.onClick(fn);
    btn.triggerClick();
    expect(fn).toHaveBeenCalledOnce();
  });

  it('toggle flips checked state on click', () => {
    const tog = UISystem.create('toggle', { width: 50, height: 30 });
    const onChange = vi.fn();
    tog.onChange(onChange);
    expect(tog.checked).toBe(false);
    tog.triggerClick();
    expect(tog.checked).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('handleClick dispatches to topmost component', () => {
    const fn = vi.fn();
    const btn = UISystem.create('button', { x: 0, y: 0, width: 200, height: 50 });
    btn.onClick(fn);
    UISystem.handleClick(100, 25, 1280, 720);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('child components can be added and retrieved', () => {
    const panel = UISystem.create('panel', { width: 300, height: 200 });
    const child = panel.createChild('text', { text: 'Hello' });
    expect(panel.children).toContain(child);
    expect(child.parent).toBe(panel);
  });

  it('remove deletes from roots', () => {
    const comp = UISystem.create('panel');
    UISystem.remove(comp);
    expect(UISystem.roots).not.toContain(comp);
  });
});
