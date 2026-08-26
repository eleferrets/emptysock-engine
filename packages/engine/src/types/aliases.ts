// Public type aliases — game developers use these instead of internal library types.
// This file is the only place that imports from pixi.js directly for aliasing purposes.
import type { Container } from 'pixi.js';

/** The root display container for a scene. Pass to CameraSystem.attach() and LightingSystem.attachFilter(). */
export type GameStage = Container;
