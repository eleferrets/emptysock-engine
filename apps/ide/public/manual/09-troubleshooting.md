# 9 — Troubleshooting

This section documents the most common mistakes and how to diagnose them. Each entry describes the symptom, the root cause, and the fix.

---

## 9.1 `TypeError: Cannot read properties of undefined` after scene transition

**Symptom:** A callback or timer fires after the scene has been destroyed, referencing `this.someProp` which is now undefined.

**Root cause:** A `Timer.every()` or `Timer.after()` handle was not cancelled in `onDestroy()`. The timer callback fires on the next frame tick after the scene is gone.

**Fix:** Cancel every timer handle in `onDestroy()`:

```typescript
private _spawnTimer: TimerHandle | null = null;

override onLoad(): void {
  this._spawnTimer = Timer.every(2.0, () => this.spawnEnemy());
}

override onDestroy(): void {
  this._spawnTimer?.cancel();
}
```

---

## 9.2 WASM memory grows on each scene load

**Symptom:** Memory usage climbs steadily as the player transitions between scenes. The browser eventually runs out of memory.

**Root cause:** `PhysicsSystem3D.destroy()` was not called in `onDestroy()`. Rapier3D allocates its world in WASM linear memory, which is invisible to the JavaScript garbage collector.

**Fix:** Always call `physics.destroy()` in the scene that created the PhysicsSystem3D:

```typescript
override onDestroy(): void {
  this._physics.destroy(); // frees WASM memory
}
```

---

## 9.3 `await` inside `onUpdate` causes silent errors

**Symptom:** Code after an `await` inside `onUpdate` sometimes doesn't run, or errors are swallowed and never appear in the Console panel.

**Root cause:** `onUpdate(dt)` is called as a plain synchronous function. An `async onUpdate` returns a Promise that the engine discards. Errors thrown after the first `await` are unhandled Promise rejections — they may appear in the browser console but not in the IDE's Console panel.

**Fix:** Remove `async` from `onUpdate`. Use a coroutine for sequenced async work:

```typescript
// Wrong:
async override onUpdate(dt: number): Promise<void> {
  await someAsyncThing(); // error: this Promise is discarded
}

// Right:
override onUpdate(dt: number): void {
  // start a coroutine if you need async sequencing
}

// In onLoad, start the coroutine:
entity.startCoroutine(function* () {
  yield waitSeconds(1.0);
  doThing();
});
```

---

## 9.4 `PhysicsSystem3D.addBody()` throws `Physics not initialized`

**Symptom:** Calling `physics.addBody()` throws an error about the physics world not being ready.

**Root cause:** `physics.init()` was not awaited before calling `addBody()`. The Rapier3D WASM module loads asynchronously.

**Fix:** `await physics.init()` before any other physics calls, always inside `onLoad`:

```typescript
override async onLoad(): Promise<void> {
  this._physics = new PhysicsSystem3D();
  await this._physics.init({ x: 0, y: -9.81, z: 0 }); // await is required
  this._physics.addBody({ /* ... */ }); // safe after await
}
```

---

## 9.5 Relative imports between project files fail to resolve

**Symptom:** The build fails with `Could not resolve './Player'` even though `Player.ts` is open in the editor.

**Root cause:** The `virtualFiles` map passed to `GameBuildService.buildNow()` does not include all open files. The esbuild virtual filesystem plugin resolves relative imports only from files in this map.

**Fix:** Always pass the full `openFiles` record from the IDE store:

```typescript
// In GameBuildService usage:
GameBuildService.buildNow({
  code: activeFileContent,
  virtualFiles: useIDEStore.getState().openFiles, // ALL open files, not just the active one
});
```

If you added a new file in the Files panel but did not open it in the editor, it will not appear in `openFiles`. Open it first.

---

## 9.6 Actor messages sent in frame N appear to be processed in frame N+1

**Symptom:** You send a message to an actor and read its state immediately after, but the state has not changed yet.

**Root cause:** Messages are queued in the actor's mailbox and processed during `ActorSystem.update(dt)`. If you send a message and read state before calling `system.update(dt)`, the inbox has not been flushed yet.

**Fix:** Reading state from an actor directly (by holding a reference) is the correct pattern for same-frame reads. The message system is for decoupled communication, not immediate synchronous state mutation:

```typescript
// Reading the actor's current state directly is fine:
const hp = enemyActor.currentHealth;

// The message system guarantees processing order, not immediate mutation:
system.send('enemy', { type: 'TAKE_DAMAGE', amount: 10 });
// hp is still the old value here — message not yet processed
system.update(dt);
// hp is now updated
```

---

## 9.7 IDE layout breaks when adding a panel

**Symptom:** Adding a new panel component to `App.tsx` causes the layout to overflow or a section of the IDE to disappear.

**Root cause:** A new component was added as a direct child of the root flex container alongside `<DockLayout>`. DockLayout calculates its own size from its bounding box; a sibling with fixed or auto height steals space and leaves DockLayout undersized.

**Fix:** Add new panels only as tabs inside `DEFAULT_LAYOUT` using `makeTab()`. Never add sibling elements to the DockLayout in the JSX:

```typescript
// Wrong:
<div className="flex flex-col h-screen">
  <MyNewPanel />      {/* steals height from DockLayout */}
  <DockLayout ... />
</div>

// Right: add MyNewPanel as a tab inside DEFAULT_LAYOUT
const DEFAULT_LAYOUT: LayoutData = {
  dockbox: {
    children: [
      // ... existing children ...
      { tabs: [makeTab('my-panel', 'My Panel', <MyNewPanel />)] },
    ],
  },
};
```

---

## 9.8 Conventional commit hook rejects the commit message

**Symptom:** `git commit` fails with a message like `subject may not be empty` or `type must be one of [feat, fix, ...]`.

**Root cause:** The commit message does not follow the Conventional Commits format enforced by commitlint.

**Fix:** Use the format `type(scope): subject`, where type is one of `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`:

```
feat(engine): add coroutine cancellation API
fix(ide): resolve Monaco tab close button overlap
docs: update prerequisite Node version to 20 LTS
chore(deps): bump vite from 5.1.0 to 5.2.0
```

The scope is optional but recommended. Do not bypass the hook with `--no-verify`; it also runs lint-staged (ESLint + Prettier).

---

## 9.9 `getComponent(BaseClass)` returns undefined for a subclass component

**Symptom:** `entity.getComponent(BaseHealth)` returns `undefined`, but the entity clearly has a component added with `entity.addComponent(SpecializedHealth)`.

**Root cause:** The component registry uses the constructor function as the key. `SpecializedHealth` and `BaseHealth` are different keys, even if `SpecializedHealth extends BaseHealth`.

**Fix:** Use the exact constructor you passed to `addComponent`:

```typescript
entity.addComponent(SpecializedHealth, 100);
const hp = entity.getComponent(SpecializedHealth); // correct key
```

If you need polymorphic lookup, store a reference to the component when you attach it.

---

## 9.10 Game runs at correct speed in browser but too fast or slow in Tauri

**Symptom:** Animations and physics behave differently between the browser dev server and the packaged Tauri desktop build.

**Root cause:** Game logic is multiplied by `dt` (delta time) correctly, but some values are hardcoded in pixels-per-frame instead of pixels-per-second.

**Fix:** All velocity and movement values must be in units-per-second and multiplied by `dt`:

```typescript
// Wrong (frame-rate dependent):
entity.x += 5; // 5 pixels per frame — differs at 30fps vs 60fps

// Right (frame-rate independent):
entity.x += 300 * dt; // 300 pixels per second, consistent at any frame rate
```

The engine internally caps `dt` to prevent spiral-of-death on tab suspend, but it does not manufacture frames — physics and movement code must use `dt`.
