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
} from "pixi.js";
import {
  RenderPipeline,
  Scene,
  Transform,
  Sprite,
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
  shWhite?: { vertexSrc: string; fragmentSrc: string };
  fntMenu?: BitmapFontDef;
};

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
  await p.init();
  return p;
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
  f.tick(3.7);
  c.filters = [f];
  c.filterArea = undefined as never;
  r.render({ container: root, target: rtF });
  const out = px(p, rtF);
  // frame cost: N renders of filtered vs unfiltered, GL-finished
  const gl = (r as unknown as { gl: WebGL2RenderingContext }).gl;
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
  const at = (x: number, y: number): number[] => {
    const i = (y * img.width + x) * 4;
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
};
void PixiSprite;
