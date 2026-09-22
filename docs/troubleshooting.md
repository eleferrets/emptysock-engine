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
system.send("enemy", { type: "TAKE_DAMAGE", amount: 10 });
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

---

## 9.11 A hot-reloaded component wiped an entity's data for no obvious reason

**Symptom:** You edit a component file, save, and every entity using that component snaps back to default values. The console has a message naming the component and calling it a shape change.

**Root cause:** `ComponentRegistry` detects a shape change (a field added, removed, or changed type in the `ComponentDef`'s declared defaults) and resets just that component's data on every entity that has it, on the world it changed for. This is intentional, not a bug, it's what stops a hot-reloaded component from reading garbage out of arrays sized for the old shape.

**Fix:** There isn't one to "fix", but you can avoid surprise resets: keep field additions additive with sensible defaults where possible, and expect a shape change to cost you that component's current values on save. If you need a value to survive across reshapes deliberately, persist it through `SaveSystem` and reload it in `onLoad` instead of relying on hot reload to preserve in-memory state. Only the one component's data resets, and only on the scene whose world actually had that component registered, everything else keeps running.

---

## 9.12 `unloadScene()` didn't clean anything up

**Symptom:** You passed `manageLifecycle: false` to `loadScene()` expecting more control, and now physics worlds, actor systems, or overlays from the previous scene are still around.

**Root cause:** `manageLifecycle: false` means exactly what it says — you told `Game` you're taking over teardown yourself, so it doesn't call the scene's own `onDestroy` or step in to destroy physics/actors on your behalf. This is a deliberate escape hatch, not an oversight, for callers who want to keep some engine-owned system alive across a transition on purpose.

**Fix:** If you don't have a specific reason to manage the lifecycle yourself, leave `manageLifecycle` at its default (`true`) and let `Game` handle teardown. If you do need `false`, your own `onUnload`/transition code is responsible for everything the default path would have done: destroying `PhysicsSystem`/`PhysicsSystem3D` instances, tearing down the scene's `ActorSystem`, and unloading any overlays that belonged to that scene.

---

## 9.13 3D physics keeps running after the scene it belonged to is gone

**Symptom:** Memory grows steadily across scene transitions in a game using `PhysicsSystem3D`, similar in shape to 9.2, but the fix in 9.2 doesn't apply because `Game` never touches `PhysicsSystem3D` for you.

**Root cause:** `Game`'s built-in scene lifecycle only auto-wires the 2D `PhysicsSystem`. `PhysicsSystem3D` is not constructed or destroyed by `loadScene`/`unloadScene` at all, because not every game uses 3D physics and the engine isn't going to load a Rapier3D WASM build for games that never asked for one. If your scene creates a `PhysicsSystem3D`, your scene owns its whole lifecycle.

**Fix:** Construct it in `onLoad`, and call `.destroy()` on it in `onDestroy`, the same rule as the "PhysicsSystem3D must be destroyed" entry in `CLAUDE.md`, just with the added twist that nothing else is going to call `.destroy()` for you.

---

## 9.14 A networked field changes locally but other clients never see it

**Symptom:** You marked a field with `networked(componentDef, ["someField"])`, you mutate it every frame, and it never shows up on the other end even though `NetworkSystem.sync()` is running.

**Root cause:** `NetworkSystem.sync()` finds changed fields with a dirty check, and the dirty check is a strict-equality (`!==`) comparison against the last synced value. If `someField` holds an object or array and you mutate it in place (`entity.get(Inventory).items.push(x)`), the reference never changes, so `!==` never trips, so the field is never considered dirty, even though the data genuinely changed.

**Fix:** Replace the value instead of mutating it in place when the field is networked: `entity.get(Inventory).items = [...entity.get(Inventory).items, x]` rather than `.push(x)`. This is the same category of gotcha as React or Redux state, treat a networked field as immutable data you replace, not a mutable object you reach into.
