# AudioSystem

`Audio` is a static utility that plays sound effects, controls background music, and manages volume groups. No instantiation is required.

Import: `import { Audio } from '@emptysock/engine';`

---

## Sound effects

### `Audio.play(sound: string, options?): void`

Play a sound effect by asset name.

| Option     | Type                       | Default | Description                               |
| ---------- | -------------------------- | ------- | ----------------------------------------- |
| `volume`   | `number`                   | `1.0`   | Playback volume (0–1)                     |
| `spatial`  | `boolean`                  | `false` | Enable positional audio                   |
| `position` | `{ x: number; y: number }` | —       | World position (requires `spatial: true`) |

```typescript
// One-shot sound:
Audio.play("jump_sfx");

// Quieter sound:
Audio.play("footstep", { volume: 0.6 });

// Spatial sound (volume falls off with distance from camera):
Audio.play("explosion", { spatial: true, position: entity.position });
```

---

## Background music

### `Audio.music(track: string, options?): void`

Start a music track. The track loops by default.

| Option | Type      | Default | Description                 |
| ------ | --------- | ------- | --------------------------- |
| `loop` | `boolean` | `true`  | Whether the track loops     |
| `fade` | `number`  | `0`     | Fade-in duration in seconds |

```typescript
Audio.music("level_theme", { loop: true, fade: 0.5 });
```

### `Audio.stopMusic(options?): void`

Stop the current music track.

| Option | Type     | Default | Description                  |
| ------ | -------- | ------- | ---------------------------- |
| `fade` | `number` | `0`     | Fade-out duration in seconds |

```typescript
Audio.stopMusic({ fade: 0.5 });
```

---

## Volume groups

### `Audio.setGroupVolume(group: string, volume: number): void`

Set the master volume for a named group. Built-in groups are `'sfx'` and `'music'`. These are wired to the sliders in the Audio Mixer panel.

```typescript
Audio.setGroupVolume("sfx", 0.8);
Audio.setGroupVolume("music", 0.5);
```

---

---

## Mixer: ducking and snapshots

These live on the `AudioSystem` class directly (`import { AudioSystem } from '@emptysock/engine'`) rather than the `Audio` facade, since they operate on buses, not individual sounds.

### `duck(bus: string, amount: number, fadeTime?: number): void` / `endDuck(bus, fadeTime?): void`

Temporarily lowers a bus's volume — e.g. duck music while dialogue plays — fading over `fadeTime` seconds (default `0.15`). `amount` is `0..1`, the fraction to cut (`1` mutes the bus). `endDuck` fades back to the bus's volume from before the duck. `isDucked(bus)` reports whether a duck is currently active.

```typescript
audio.duck("music", 0.6, 0.2); // drop music to 40% over 0.2s
// ...dialogue line plays...
audio.endDuck("music", 0.3);
```

### `defineSnapshot(name, busVolumes)` / `transitionToSnapshot(name, duration?)`

A snapshot is a named volume preset across buses. Transitioning to one fades every named bus toward its stored volume over `duration` seconds (default `0.5`). This is volume-based mixing only — it does not apply DSP filtering (no low-pass "underwater" muffling), which would require a filter chain Howler does not expose without more invasive changes.

```typescript
audio.defineSnapshot("underwater", { music: 0.2, sfx: 0.3, voice: 0.4 });
audio.transitionToSnapshot("underwater", 1.5);
```

Both ducking and snapshot transitions advance in `AudioSystem.update(dt)`, which the engine already calls once per frame.

---

## Tips

- Sound assets are referenced by name (the filename without extension, relative to `assets/audio/`). Place audio files there so the IDE can find them.
- Spatial audio attenuates based on distance between `position` and the camera's current position.
- The Audio Mixer panel in the IDE lets you set group volumes at design time; `Audio.setGroupVolume()` lets you change them at runtime (for example, from a settings screen).
- Call `Audio.stopMusic({ fade: 0.4 })` before a scene transition so music doesn't cut abruptly.
