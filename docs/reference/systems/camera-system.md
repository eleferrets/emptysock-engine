# CameraSystem

`Camera` is a static utility — no instantiation required. It controls what is visible in the game view: following, shaking, zooming, and fading.

Full API reference: [Camera](../camera.md)

Import: `import { Camera } from '@emptysock/engine';`

---

## Quick reference

```typescript
// Follow an entity:
Camera.follow(player, { lerp: 0.08, deadzone: { x: 60, y: 30 } });
Camera.stopFollowing();

// Shake:
Camera.shake({ intensity: 8, duration: 0.4 });

// Zoom:
Camera.zoom(2.0, { duration: 0.5, ease: "sineOut" });
Camera.zoom(1.0, { duration: 0.3 });

// Fade:
Camera.fade({ to: 0x000000, duration: 0.6 }); // fade to black
Camera.fade({ from: 0x000000, duration: 0.6 }); // fade in from black

// Position:
Camera.position = { x: 0, y: 0 };
const pos = Camera.position;
```

For full method signatures, options, and examples see the [Camera reference page](../camera.md).
