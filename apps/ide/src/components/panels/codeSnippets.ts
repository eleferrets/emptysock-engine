interface Snippet {
  label: string;
  body: string;
}

export const SNIPPETS: Snippet[] = [
  {
    label: "Scene skeleton",
    body: `import { defineScene } from '@emptysock/engine'\n\nconst gameScene = defineScene({\n  async onLoad(scene, ctx) {\n    // load assets and build entities here\n  },\n\n  onUpdate(dt) {\n    // called every frame; dt = seconds since last frame\n  },\n\n  onUnload(scene, ctx) {\n    // clean up timers, remove listeners\n  },\n})`,
  },
  {
    label: "Entity + Sprite",
    body: `const player = scene.spawn('Player')\nplayer.add(Transform, { x: 0, y: 0 })\nplayer.add(Sprite, { texturePath: 'assets/hero.png', anchorX: 0.5, anchorY: 1.0 })\nplayer.add(PhysicsBody, { shape: 'capsule', type: 'dynamic' })`,
  },
  {
    label: "Camera follow",
    body: `const camera = new CameraSystem()\n\n// in onLoad, once a renderer is attached:\ncamera.attach(renderer.stage)\ncamera.setFollow(() => player.get(Transform))\ncamera.setLerpFactor(0.08)\ncamera.setBounds({ minX: 0, minY: 0, maxX: 3200, maxY: 900 })\n\n// in onUpdate:\ncamera.update(dt)\n\n// in onUnload:\ncamera.destroy()`,
  },
  {
    label: "Timer once",
    body: `const tweens = new TweenManager()\n\n// in onLoad:\ntweens.after(2.0, () => { /* runs once after 2 s */ })\n\n// in onUpdate:\ntweens.update(dt)\n\n// in onUnload:\ntweens.destroy()`,
  },
  {
    label: "Coroutine",
    body: `entity.startCoroutine(function* () {\n  yield waitSeconds(1.5)\n  yield waitUntil(() => player.get(Transform).y >= groundY)\n  // continues here after both conditions\n})`,
  },
  {
    label: "Save / load",
    body: `import type { StorageAdapter } from '@emptysock/engine'\n\ninterface Progress {\n  score: number\n  level: number\n}\n\nasync function saveProgress(adapter: StorageAdapter, data: Progress): Promise<void> {\n  await adapter.set('slot-1', JSON.stringify(data))\n}\n\nasync function loadProgress(adapter: StorageAdapter): Promise<Progress | null> {\n  const raw = await adapter.get('slot-1')\n  return raw === null ? null : (JSON.parse(raw) as Progress)\n}`,
  },
  {
    label: "Actor receive",
    body: `import { Actor, type Message } from '@emptysock/engine'\n\nclass EnemyActor extends Actor {\n  receive(msg: Message): void {\n    if (msg.type === 'take_damage') {\n      const dmg = (msg.payload as { amount: number }).amount\n      // handle damage\n    }\n  }\n}\n\n// registered via ctx.actors.register(new EnemyActor()) in onLoad`,
  },
  {
    label: "Physics collision",
    body: `getPhysicsBody(entity).onCollisionEnter = (other, contact) => {\n  if (other.get(Meta)?.tags.includes('hazard')) {\n    // handle collision\n  }\n}\n\ngetPhysicsBody(entity).onSensorEnter = (other) => {\n  if (other.get(Meta)?.tags.includes('player')) {\n    // handle sensor overlap\n  }\n}`,
  },
];
