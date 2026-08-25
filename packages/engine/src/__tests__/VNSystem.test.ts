import { describe, it, expect, vi } from 'vitest';
import { VNSystem } from '../systems/VNSystem.js';
import type { DialogueTree } from '../systems/VNSystem.js';

const tree: DialogueTree = {
  startNode: 'start',
  nodes: {
    start: { type: 'dialogue', speaker: 'Alice', text: 'Hello!', next: 'question' },
    question: { type: 'choice', text: 'What next?', options: [
      { label: 'Go left', next: 'left' },
      { label: 'Go right', next: 'right' },
    ]},
    left: { type: 'event', eventName: 'enterLeft', data: { door: 'left' }, next: 'end' },
    right: { type: 'dialogue', speaker: 'Bob', text: 'Right path!', next: 'end' },
    end: { type: 'dialogue', speaker: 'Narrator', text: 'The end.' },
  },
};

describe('VNSystem', () => {
  it('loads tree and starts at startNode', () => {
    const vn = new VNSystem();
    vn.load(tree);
    const node = vn.currentNode;
    expect(node?.type).toBe('dialogue');
    if (node?.type === 'dialogue') expect(node.speaker).toBe('Alice');
  });

  it('advance() moves to next dialogue node', () => {
    const vn = new VNSystem();
    vn.load(tree);
    vn.advance();
    const node = vn.currentNode;
    expect(node?.type).toBe('choice');
  });

  it('choice node has options', () => {
    const vn = new VNSystem();
    vn.load(tree);
    vn.advance(); // now at 'question' choice node
    const node = vn.currentNode;
    if (node?.type === 'choice') {
      expect(node.options.length).toBe(2);
      expect(node.options[0].label).toBe('Go left');
    }
  });

  it('onEvent callback fires on event nodes', () => {
    const vn = new VNSystem();
    const onEvent = vi.fn();
    vn.onEvent = onEvent;
    vn.load(tree);
    vn.advance(); // → question
    vn.selectOption('left'); // → left (event node, fires immediately)
    expect(onEvent).toHaveBeenCalledWith('enterLeft', { door: 'left' });
  });

  it('selectOption navigates to chosen branch', () => {
    const vn = new VNSystem();
    vn.load(tree);
    vn.advance(); // → question
    vn.selectOption('right'); // → right
    const node = vn.currentNode;
    if (node?.type === 'dialogue') expect(node.speaker).toBe('Bob');
  });
});
