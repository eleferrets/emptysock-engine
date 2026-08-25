import {
  Scene,
  VNSystem,
  LocalisationSystem,
  InputSystem,
} from '@emptysock/engine';
import type { DialogueTree } from '@emptysock/engine';

const DIALOGUE_TREE: DialogueTree = {
  startNode: 'intro',
  nodes: {
    intro: {
      type: 'dialogue',
      speaker: 'Narrator',
      text: 'You stand at a crossroads in a mysterious forest.',
      next: 'ask',
    },
    ask: {
      type: 'choice',
      text: 'Which path do you take?',
      options: [
        { label: 'The dark path', next: 'dark' },
        { label: 'The bright path', next: 'bright' },
      ],
    },
    dark: {
      type: 'event',
      eventName: 'takePath',
      data: { path: 'dark' },
      next: 'dark_result',
    },
    dark_result: {
      type: 'dialogue',
      speaker: 'Narrator',
      text: 'You venture into the shadows...',
      next: 'end',
    },
    bright: {
      type: 'dialogue',
      speaker: 'Narrator',
      text: 'Sunlight guides your way.',
      next: 'end',
    },
    end: {
      type: 'dialogue',
      speaker: 'Narrator',
      text: 'The adventure continues...',
    },
  },
};

export class GameScene extends Scene {
  private readonly _vn: VNSystem = new VNSystem();
  private readonly _loc: LocalisationSystem = new LocalisationSystem();
  private readonly _input: InputSystem = new InputSystem();

  constructor() {
    super('GameScene');
  }

  override start(): void {
    super.start();

    this._input.attach(window);

    // Set up localisation
    this._loc.addTranslations('en', {
      'ui.advance': 'Press SPACE to continue',
      'ui.choose': 'Click a choice',
    });
    this._loc.setLocale('en');

    // Set up VN callbacks
    this._vn.onEvent = (eventName, data) => {
      console.log(`VN Event: ${eventName}`, data);
    };

    this._vn.onChoice = (options) => {
      console.log('Player must choose:', options.map(o => o.label).join(' | '));
      // In a real game, show UI buttons and call _vn.selectOption(next)
    };

    this._vn.load(DIALOGUE_TREE);

    // Advance dialogue on SPACE
    this.addSystem('vn-input', (_scene, _dt) => {
      if (this._input.isKeyPressed('Space')) {
        this._vn.advance();
        const node = this._vn.currentNode;
        if (node !== null) {
          if (node.type === 'dialogue') {
            console.log(`[${node.speaker}]: ${node.text}`);
          }
        }
      }
      this._input.flush();
    });

    console.log('Visual Novel GameScene started');
    const first = this._vn.currentNode;
    if (first?.type === 'dialogue') console.log(`[${first.speaker}]: ${first.text}`);
  }

  override stop(): void {
    this._input.detach();
    super.stop();
  }
}
