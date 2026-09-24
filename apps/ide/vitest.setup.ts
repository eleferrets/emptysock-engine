// Vitest setup: mock <canvas> 2D contexts so panels that render real Konva
// (react-konva) — currently ImageEditor.tsx and NavMeshEditor.tsx — can
// construct a real Stage/Layer under jsdom without throwing. This does not
// give Konva real pixel-based hit-testing (see NavMeshEditor.test.tsx for
// how shape-level interaction is verified instead, via Konva node ids and
// `.fire()` rather than raw pointer coordinates).
import "vitest-canvas-mock";
