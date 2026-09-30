/* eslint-disable -- verification harness: throwaway browser-side probe code, not engine source */
// Browser-side half of gpu-verify.mjs: bundled with esbuild, run in headless
// Chromium (swiftshader WebGL). Every check renders through the engine's real
// code paths and returns pixel statistics; the Node driver asserts on them.
import {
  Rectangle,
  Container,
  Graphics,
  Sprite as PixiSprite,
  Texture,
  RenderTexture,
  BufferImageSource,
} from "pixi.js";
import {
  RenderPipeline,
  Scene,
  Transform,
  Sprite,
  SpriteFlash,
  UISystem,
  WidgetTree,
  LayoutStyle,
  Label,
  withImageRegion,
  FontRegistry,
  RainGlassFilter,
  createCustomShaderFilter,
  registerGmlShader,
  draw_set_colour,
  draw_circle,
  draw_rectangle,
  surface_create,
  surface_set_target,
  surface_reset_target,
  draw_surface,
  draw_clear,
  gpu_set_blendmode,
  bm_subtract,
  bm_normal,
} from "../dist/index.js";
import type { GmlActionContext, BitmapFontDef } from "../dist/index.js";

type Pixels = { data: Uint8ClampedArray; width: number; height: number };
type Cfg = {
  shWhite?: {
    vertexSrc: string;
    fragmentSrc: string;
    wgslFragmentSrc?: string;
  };
  fntMenu?: BitmapFontDef;
};

// `?renderer=webgl|webgpu` on the harness URL forces one backend (default: the engine's own order).
const PREFERENCE = (() => {
  const r = new URLSearchParams(location.search).get("renderer");
  return r === "webgl" || r === "webgpu" ? [r] : undefined;
})();

async function mkPipeline(
  w: number,
  h: number,
  extra: Record<string, unknown> = {},
): Promise<RenderPipeline> {
  const p = new RenderPipeline({
    width: w,
    height: h,
    antialias: false,
    resolution: 1,
    backgroundColor: 0x000000,
    ...extra,
  });
  await p.init(PREFERENCE ? { preference: PREFERENCE } : {});
  return p;
}

/** The pixels as a PNG data URL, for saving or showing the render. */
function toPng(img: Pixels): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  canvas
    .getContext("2d")!
    .putImageData(
      new ImageData(new Uint8ClampedArray(img.data), img.width, img.height),
      0,
      0,
    );
  return canvas.toDataURL("image/png");
}

let W = 640,
  H = 360;
function px(p: RenderPipeline, target: Container | Texture): Pixels {
  const r = p.renderer.extract.pixels(
    target instanceof Container
      ? { target, frame: new Rectangle(0, 0, W, H) }
      : { target },
  );
  return {
    data: r.pixels as unknown as Uint8ClampedArray,
    width: r.width,
    height: r.height,
  };
}

function scene(): Container {
  // Night street: sky/road gradient, lit windows and bokeh head/tail lights —
  // gives refraction bright, high-contrast detail to bend (a windshield look).
  const c = new Container();
  const g = new Graphics();
  for (let y = 0; y < 360; y += 4) {
    const t = y / 360;
    const col =
      t < 0.5
        ? (Math.round(14 + 30 * t) << 16) |
          (Math.round(20 + 50 * t) << 8) |
          Math.round(48 + 60 * t)
        : (Math.round(30 - 20 * (t - 0.5)) << 16) |
          (Math.round(30 - 20 * (t - 0.5)) << 8) |
          Math.round(40 - 20 * (t - 0.5));
    g.rect(0, y, 640, 4).fill(col);
  }
  for (let i = 0; i < 12; i++) {
    const x = i * 56 + 4,
      h = 90 + ((i * 37) % 70);
    g.rect(x, 180 - h, 48, h).fill(0x0c0e18);
    for (let wy = 0; wy < h - 10; wy += 14)
      for (let wx = 6; wx < 44; wx += 14)
        if (((i * 7 + wy + wx) >> 2) % 3 === 0)
          g.rect(x + wx, 180 - h + wy + 6, 6, 8).fill(0xffd070);
  }
  const lights = [
    [80, 230, 0xff3030],
    [150, 240, 0xffffff],
    [260, 226, 0xff3030],
    [340, 244, 0xffe8a0],
    [430, 232, 0xffffff],
    [520, 238, 0xff4040],
    [590, 228, 0xffc060],
  ];
  for (const [x, y, col] of lights) {
    g.circle(x!, y!, 14).fill({ color: col!, alpha: 0.35 });
    g.circle(x!, y!, 6).fill(col!);
  }
  g.rect(0, 250, 640, 110).fill({ color: 0x15151c, alpha: 0.9 });
  for (let i = 0; i < 8; i++) g.rect(20 + i * 84, 300, 40, 5).fill(0xd0d0d0);
  c.addChild(g);
  return c;
}

function rainStats(a: Pixels, b: Pixels): Record<string, number> {
  const n = a.width * a.height;
  let changed = 0,
    sum = 0,
    opaque = 0;
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const d =
      Math.abs(a.data[i * 4]! - b.data[i * 4]!) +
      Math.abs(a.data[i * 4 + 1]! - b.data[i * 4 + 1]!) +
      Math.abs(a.data[i * 4 + 2]! - b.data[i * 4 + 2]!);
    sum += d;
    if (d > 12) {
      changed++;
      mask[i] = 1;
    }
    if (b.data[i * 4 + 3]! > 250) opaque++;
  }
  // Mean vertical vs horizontal run length of changed pixels: trails are tall.
  let vr = 0,
    vn = 0,
    hr = 0,
    hn = 0;
  for (let x = 0; x < a.width; x++) {
    let run = 0;
    for (let y = 0; y <= a.height; y++) {
      if (y < a.height && mask[y * a.width + x]) run++;
      else if (run) {
        vr += run;
        vn++;
        run = 0;
      }
    }
  }
  for (let y = 0; y < a.height; y++) {
    let run = 0;
    for (let x = 0; x <= a.width; x++) {
      if (x < a.width && mask[y * a.width + x]) run++;
      else if (run) {
        hr += run;
        hn++;
        run = 0;
      }
    }
  }
  return {
    changedFrac: changed / n,
    meanAbsDiff: sum / n / 3,
    opaqueFrac: opaque / n,
    meanVRun: vn ? vr / vn : 0,
    meanHRun: hn ? hr / hn : 0,
  };
}

export async function rain(
  opts: Record<string, number> = {},
): Promise<Record<string, unknown>> {
  const p = await mkPipeline(640, 360);
  const r = p.renderer;
  const rt = RenderTexture.create({ width: 640, height: 360 });
  const rtF = RenderTexture.create({ width: 640, height: 360 });
  const c = scene();
  const root = new Container();
  root.addChild(c); // a filter on the render root itself is ignored by pixi
  r.render({ container: root, target: rt });
  const base = px(p, rt);
  const f = new RainGlassFilter(opts);
  f.setResolution(640, 360);
  // The filter simulates drops on the CPU, so warm the sim up over many small steps.
  for (let i = 0; i < 360; i++) f.tick(1 / 30);
  c.filters = [f];
  c.filterArea = undefined as never;
  r.render({ container: root, target: rtF });
  const out = px(p, rtF);
  // frame cost: N renders of filtered vs unfiltered, GL-finished
  const gl = (r as unknown as { gl: WebGL2RenderingContext }).gl;
  if (!gl)
    throw new Error(
      `rain needs a WebGL renderer, got "${String((r as { name?: string }).name)}" (set GPU_RENDERER=webgl)`,
    );
  const glVersion = gl.getParameter(gl.VERSION) as string;
  // gl.finish() does not sync across Chromium's GPU process; a 1px readback does.
  const sync = (): void => {
    void r.extract.pixels({ target: rtF, frame: new Rectangle(0, 0, 1, 1) });
  };
  const time = (fn: () => void, n = 40): number => {
    fn();
    sync();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      fn();
    }
    sync();
    return (performance.now() - t0) / n;
  };
  const off = { ...c };
  const msBase = time(() => {
    c.filters = [];
    r.render({ container: root, target: rtF });
  });
  const pass = createCustomShaderFilter({
    fragmentSrc:
      "precision mediump float;\nin vec2 vUV;\nout vec4 finalColor;\nuniform sampler2D uTexture;\nvoid main(){ finalColor = texture(uTexture, vUV); }",
  });
  const msPass = time(() => {
    c.filters = [pass];
    r.render({ container: root, target: rtF });
  });
  const msRain = time(() => {
    c.filters = [f];
    f.tick(0.016);
    r.render({ container: root, target: rtF });
  });
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx2 = canvas.getContext("2d")!;
  ctx2.putImageData(
    new ImageData(new Uint8ClampedArray(out.data), 640, 360),
    0,
    0,
  );
  void off;
  return {
    ...rainStats(base, out),
    msBase,
    msPass,
    msRain,
    png: canvas.toDataURL("image/png"),
    renderer: glVersion,
  };
}

const solidTexture = (): Texture => {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 64;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#c81e1e";
  g.fillRect(0, 0, 32, 64); // right half stays transparent
  g.fillStyle = "#1e1ec8";
  g.fillRect(32, 0, 16, 64);
  return Texture.from(cv);
};

export async function shWhite(cfg: Cfg): Promise<Record<string, unknown>> {
  if (!cfg.shWhite) return { skipped: true };
  registerGmlShader("sh_white", cfg.shWhite);
  W = 128;
  H = 128;
  const p = await mkPipeline(128, 128, {
    textureLoader: () => Promise.resolve(solidTexture()),
  });
  const s = new Scene();
  const mk = (x: number, shader: string) => {
    const e = s.spawn();
    e.add(Transform, { x, y: 64 });
    e.add(Sprite, { texturePath: "t.png", shader });
  };
  mk(32, "sh_white"); // filtered
  mk(96, ""); // control
  p.syncEntities(s);
  await new Promise((r) => setTimeout(r, 50));
  p.renderFrame(s);
  const img = px(p, p.renderer.lastObjectRendered as Container);
  // The readback is in device pixels; sample in the 128x128 logical frame.
  const k = img.width / 128;
  const at = (x: number, y: number): number[] => {
    const i = (Math.floor(y * k) * img.width + Math.floor(x * k)) * 4;
    return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
  };
  // filtered sprite: centred x=32 -> covers 0..64; red half 0..32(+blue 32..48) ; control at 64..128
  let whiteCount = 0,
    nonWhiteOpaque = 0,
    minX = 1e9,
    maxX = -1,
    minY = 1e9,
    maxY = -1;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 64; x++) {
      const [r, g, b, a] = at(x, y) as [number, number, number, number];
      if (a > 200 && r > 245 && g > 245 && b > 245) {
        whiteCount++;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      } else if (a > 200 && (r > 20 || g > 20 || b > 20)) nonWhiteOpaque++;
    }
  return {
    whiteCount,
    nonWhiteOpaque,
    bbox: [minX, minY, maxX, maxY],
    expectedArea: 48 * 64,
    control: at(80, 64),
    controlBlue: at(112, 64),
    filteredEmpty: at(60, 64),
    png: toPng(img),
  };
}

export async function bitmapText(cfg: Cfg): Promise<Record<string, unknown>> {
  if (!cfg.fntMenu) return { skipped: true };
  const fonts = new FontRegistry();
  fonts.registerBitmap("fnt_menu", cfg.fntMenu);
  const p = await mkPipeline(320, 96, { fonts });
  await (
    p as unknown as { _textures: { load(path: string): Promise<unknown> } }
  )._textures.load(cfg.fntMenu.atlasPath);
  const ctx = { surfaces: p.surfaces } as unknown as GmlActionContext;
  const surf = surface_create(ctx, 320, 96);
  surface_set_target(ctx, surf);
  const t = ctx.drawTarget!;
  draw_set_colour(t, 0x000000);
  draw_rectangle(t, 0, 0, 320, 96, false);
  draw_set_colour(t, 0xffffff);
  t.setFont?.("fnt_menu");
  t.text(8, 8, "HELLO 123");
  surface_reset_target(ctx);
  const tex = p.surfaces.texture(surf)!;
  const img = px(p, tex);
  let lit = 0,
    minY = 1e9,
    maxY = -1,
    maxX = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      if (img.data[i]! > 128) {
        lit++;
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        maxX = Math.max(maxX, x);
      }
    }
  // Column occupancy gaps -> distinct glyph count.
  const cols: boolean[] = [];
  for (let x = 0; x < img.width; x++) {
    let on = false;
    for (let y = 0; y < img.height; y++)
      if (img.data[(y * img.width + x) * 4]! > 128) {
        on = true;
        break;
      }
    cols.push(on);
  }
  let groups = 0;
  for (let x = 0; x < cols.length; x++) if (cols[x] && !cols[x - 1]) groups++;
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  cv.getContext("2d")!.putImageData(
    new ImageData(new Uint8ClampedArray(img.data), img.width, img.height),
    0,
    0,
  );
  return {
    lit,
    bboxY: [minY, maxY],
    maxX,
    glyphGroups: groups,
    png: cv.toDataURL("image/png"),
  };
}

export async function darkness(): Promise<Record<string, unknown>> {
  const p = await mkPipeline(128, 128);
  const ctx = { surfaces: p.surfaces } as unknown as GmlActionContext;
  const dark = surface_create(ctx, 128, 128);
  const view = surface_create(ctx, 128, 128);
  // darkness surface: fill mid-grey, cut a light hole with bm_subtract
  surface_set_target(ctx, dark);
  draw_clear(ctx, 0x606060);
  const t = ctx.drawTarget!;
  gpu_set_blendmode(ctx, bm_subtract);
  draw_set_colour(t, 0xffffff);
  draw_circle(t, 64, 64, 24, false);
  gpu_set_blendmode(ctx, bm_normal);
  surface_reset_target(ctx);
  // "view": white, then darkness subtracted over it
  surface_set_target(ctx, view);
  draw_clear(ctx, 0xffffff);
  gpu_set_blendmode(ctx, bm_subtract);
  draw_surface(ctx, dark, 0, 0);
  gpu_set_blendmode(ctx, bm_normal);
  surface_reset_target(ctx);
  const img = px(p, p.surfaces.texture(view)!);
  const at = (x: number, y: number): number[] => {
    const i = (y * img.width + x) * 4;
    return [img.data[i]!, img.data[i + 1]!, img.data[i + 2]!, img.data[i + 3]!];
  };
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  cv.getContext("2d")!.putImageData(
    new ImageData(new Uint8ClampedArray(img.data), 128, 128),
    0,
    0,
  );
  return {
    centre: at(64, 64),
    edgeIn: at(64 + 20, 64),
    outside: at(6, 6),
    corner: at(120, 120),
    png: cv.toDataURL("image/png"),
  };
}

export async function probe(): Promise<unknown> {
  const p = await mkPipeline(64, 64);
  const r = p.renderer;
  const out: Record<string, unknown> = {
    gl: typeof (r as never as { gl?: unknown }).gl,
  };
  for (const mode of ["normal", "subtract", "erase", "max", "add"] as const) {
    const rt = RenderTexture.create({ width: 64, height: 64 });
    const root = new Container();
    const s = new PixiSprite(Texture.WHITE);
    s.width = 64;
    s.height = 64;
    s.tint = 0x606060;
    s.blendMode = mode;
    root.addChild(s);
    r.render({
      container: root,
      target: rt,
      clear: true,
      clearColor: [1, 1, 1, 1],
    });
    const px2 = r.extract.pixels({ target: rt });
    out[mode] = Array.from(
      (px2.pixels as unknown as Uint8ClampedArray).slice(0, 4),
    );
  }
  return out;
}
(window as unknown as Record<string, unknown>).gpu = {
  probe,
  rain,
  shWhite,
  bitmapText,
  darkness,
  rendererFilterProbe,
  mapUploadProbe,
  flashBench,
  uiBitmap,
};
void PixiSprite;

// Round-trips a known RGBA gradient through a BufferImageSource texture under the
// active renderer and reports where the readback first differs (upload stride bugs).
export async function mapUploadProbe(): Promise<Record<string, unknown>> {
  const p = await mkPipeline(64, 64);
  const out: Record<string, unknown> = {
    renderer: (p.renderer as unknown as { gl?: unknown }).gl
      ? "webgl"
      : "webgpu",
  };
  for (const [w, h] of [
    [320, 180],
    [250, 141],
    [256, 128],
  ] as const) {
    const buf = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        buf[i] = x & 255;
        buf[i + 1] = y & 255;
        buf[i + 2] = 7;
        buf[i + 3] = 255;
      }
    const source = new BufferImageSource({
      resource: buf,
      width: w,
      height: h,
      format: "rgba8unorm",
      scaleMode: "linear",
    });
    const tex = new Texture({ source });
    const sp = new PixiSprite(tex);
    const rt = RenderTexture.create({ width: w, height: h });
    p.renderer.render({ container: sp, target: rt });
    const px2 = p.renderer.extract.pixels({
      target: rt,
      frame: new Rectangle(0, 0, w, h),
    });
    const got = px2.pixels as unknown as Uint8ClampedArray;
    let bad = 0;
    let firstBad = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (got[i] !== buf[i] || got[i + 1] !== buf[i + 1]) {
          bad++;
          if (firstBad < 0) firstBad = y * w + x;
        }
      }
    out[`${w}x${h}`] = {
      bad,
      firstBadXY:
        firstBad < 0 ? null : [firstBad % w, Math.floor(firstBad / w)],
      sampleTL: [got[0], got[1], got[2], got[3]],
      sampleBR: Array.from(got.slice((w * h - 1) * 4, (w * h - 1) * 4 + 4)),
    };
  }
  return out;
}

// Real-browser only: reports which renderer pixi picked and whether the GL-only
// rain filter changes the frame under it (it cannot under WebGPU).
export async function rendererFilterProbe(
  poke: Record<string, number> = {},
): Promise<Record<string, unknown>> {
  const p = await mkPipeline(640, 360);
  const r = p.renderer as unknown as {
    gl?: unknown;
    type?: number;
    name?: string;
  };
  const rt = RenderTexture.create({ width: 640, height: 360 });
  const c = scene();
  const root = new Container();
  root.addChild(c);
  p.renderer.render({ container: root, target: rt });
  const base = px(p, rt);
  const f = new RainGlassFilter({});
  f.setResolution(640, 360);
  for (let i = 0; i < 360; i++) f.tick(1 / 30);
  for (const [k, v] of Object.entries(poke))
    (f as unknown as { _set(k: string, v: number): void })._set(k, v);
  c.filters = [f];
  const errors: string[] = [];
  let out: Pixels | undefined;
  try {
    p.renderer.render({ container: root, target: rt });
    out = px(p, rt);
  } catch (e) {
    errors.push(String(e));
  }
  let png: string | undefined;
  if (out) {
    const canvas = document.createElement("canvas");
    canvas.width = out.width;
    canvas.height = out.height;
    canvas
      .getContext("2d")!
      .putImageData(
        new ImageData(new Uint8ClampedArray(out.data), out.width, out.height),
        0,
        0,
      );
    png = canvas.toDataURL("image/png");
  }
  const bands = (axis: "row" | "col"): number[] => {
    if (!out) return [];
    const n = 8;
    const changed = new Array<number>(n).fill(0);
    const total = new Array<number>(n).fill(0);
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const i = (y * out.width + x) * 4;
        const d =
          Math.abs(out.data[i]! - base.data[i]!) +
          Math.abs(out.data[i + 1]! - base.data[i + 1]!) +
          Math.abs(out.data[i + 2]! - base.data[i + 2]!);
        const b = Math.min(
          n - 1,
          Math.floor(
            ((axis === "row" ? y : x) /
              (axis === "row" ? out.height : out.width)) *
              n,
          ),
        );
        total[b]!++;
        if (d > 12) changed[b]!++;
      }
    }
    return changed.map((c, k) => +(c / total[k]!).toFixed(3));
  };
  return {
    renderer: r.gl ? "webgl" : (r.name ?? "not-webgl"),
    errors,
    png,
    rowBands: bands("row"),
    colBands: bands("col"),
    ...(out ? rainStats(base, out) : {}),
  };
}

// Waits for the GPU to finish the submitted work (WebGL finish / WebGPU queue drain).
async function gpuDone(p: RenderPipeline): Promise<void> {
  const r = p.renderer as unknown as {
    gl?: WebGL2RenderingContext;
    gpu?: { device: { queue: { onSubmittedWorkDone(): Promise<void> } } };
  };
  if (r.gl) r.gl.finish();
  else if (r.gpu) await r.gpu.device.queue.onSubmittedWorkDone();
}

// SpriteFlash cost and correctness: N sprites, all flashing vs none, GPU-finished
// frame time, plus a pixel check (white silhouette at amount 1, original at 0).
export async function flashBench(
  counts: number[] = [50, 200, 1000],
): Promise<Record<string, unknown>> {
  W = 640;
  H = 360;
  const runs: Record<string, unknown>[] = [];
  let renderer = "";
  for (const n of counts) {
    for (const flashing of [false, true]) {
      const p = await mkPipeline(640, 360, {
        textureLoader: () => Promise.resolve(solidTexture()),
      });
      renderer = (p.renderer as unknown as { gl?: unknown }).gl
        ? "webgl"
        : "webgpu";
      const s = new Scene();
      for (let i = 0; i < n; i++) {
        const e = s.spawn();
        e.add(Transform, {
          x: 20 + ((i * 37) % 600),
          y: 20 + ((i * 53) % 320),
        });
        e.add(Sprite, { texturePath: "t.png" });
        if (flashing)
          e.add(SpriteFlash, {
            color: 0xffffff,
            amount: 1,
            peak: 1,
            active: true,
          });
      }
      p.syncEntities(s);
      await new Promise((r) => setTimeout(r, 100));
      for (let i = 0; i < 10; i++) p.renderFrame(s);
      await gpuDone(p);
      const frames = 60;
      const t0 = performance.now();
      for (let i = 0; i < frames; i++) {
        p.syncEntities(s);
        p.renderFrame(s);
      }
      await gpuDone(p);
      runs.push({
        n,
        flashing,
        msPerFrame: +((performance.now() - t0) / frames).toFixed(3),
      });
    }
  }
  // Pixel check: one sprite, amount 1 vs 0.
  const probe = async (amount: number): Promise<number[]> => {
    W = 128;
    H = 128;
    const p = await mkPipeline(128, 128, {
      textureLoader: () => Promise.resolve(solidTexture()),
    });
    const s = new Scene();
    const e = s.spawn();
    e.add(Transform, { x: 64, y: 64 });
    e.add(Sprite, { texturePath: "t.png" });
    e.add(SpriteFlash, {
      color: 0xffffff,
      amount,
      peak: 1,
      active: amount > 0,
    });
    p.syncEntities(s);
    await new Promise((r) => setTimeout(r, 100));
    p.renderFrame(s);
    const img = px(p, p.renderer.lastObjectRendered as Container);
    const k = img.width / 128;
    const at = (x: number, y: number): number[] => {
      const i = (Math.floor(y * k) * img.width + Math.floor(x * k)) * 4;
      return [
        img.data[i]!,
        img.data[i + 1]!,
        img.data[i + 2]!,
        img.data[i + 3]!,
      ];
    };
    // Sprite 64x64 centred: red half left of x=64, transparent right of the blue strip.
    return [...at(50, 64), ...at(72, 64), ...at(120, 64)];
  };
  return {
    renderer,
    runs,
    flashed: await probe(1),
    half: await probe(0.5),
    plain: await probe(0),
  };
}

// UISystem bitmap-font text on a real Canvas2D surface: glyph blits through
// withImageRegion, at device pixel ratio 1 and 2, against the fillText fallback.
export async function uiBitmap(cfg: Cfg): Promise<Record<string, unknown>> {
  if (!cfg.fntMenu) return { skipped: true };
  const fonts = new FontRegistry();
  fonts.registerBitmap("fnt_menu", cfg.fntMenu);
  const tree = new WidgetTree();
  await tree.init();
  const scene = new Scene();
  const label = tree.createWidget(scene);
  label.add(Label, { text: "HELLO 123", fontId: "fnt_menu", align: 0 });
  const style = label.get(LayoutStyle)!;
  style.width = 200;
  style.height = 40;
  tree.layout(scene, 200, 40);
  const ui = new UISystem(tree, { fonts });
  const out: Record<string, unknown> = {};
  const paint = async (scale: number, bitmap: boolean) => {
    const canvas = document.createElement("canvas");
    canvas.width = 200 * scale;
    canvas.height = 40 * scale;
    const g = canvas.getContext("2d", { willReadFrequently: true })!;
    g.scale(scale, scale);
    const ctx = bitmap ? withImageRegion(g as never) : (g as never);
    (ctx as { fillStyle: string }).fillStyle = "#000";
    g.fillStyle = "#000";
    g.fillRect(0, 0, 200, 40);
    // The atlas loads on first use: draw once to start it, wait, then draw the frame to measure.
    ui.render(scene, ctx);
    await new Promise((r) => setTimeout(r, bitmap ? 400 : 50));
    g.save();
    g.fillStyle = "#000";
    g.fillRect(0, 0, 200, 40);
    ui.render(scene, ctx);
    g.restore();
    const d = g.getImageData(0, 0, canvas.width, canvas.height).data;
    let lit = 0,
      partial = 0,
      minX = 1e9,
      maxX = -1,
      minY = 1e9,
      maxY = -1;
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const v = d[(y * canvas.width + x) * 4]!;
        if (v > 40) {
          lit++;
          if (v < 215) partial++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    return {
      lit,
      partialFrac: lit ? +(partial / lit).toFixed(3) : 0,
      bboxCss: lit
        ? [minX / scale, minY / scale, maxX / scale, maxY / scale]
        : null,
      png: canvas.toDataURL("image/png"),
    };
  };
  out.bitmap1 = await paint(1, true);
  out.bitmap2 = await paint(2, true);
  out.fallback1 = await paint(1, false);
  return out;
}
