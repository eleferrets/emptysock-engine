#!/usr/bin/env node
// Real-GPU (swiftshader WebGL by default; GPU_ANGLE=metal for the real GPU) verification of engine rendering paths.
//   node packages/engine/scripts/gpu-verify.mjs [--out <dir>]
// Env: GMS_FIXTURE_ASSETS = dir of a GMS2 importer output (for sh_white + fnt_menu
//      checks); those two checks are reported "skipped" without it.
//      GPU_ANGLE (swiftshader | metal), GPU_EXTRA_ARGS (space separated Chrome flags).
//      PLAYWRIGHT_MODULE_DIR (default /opt/node22/lib/node_modules),
//      CHROMIUM_PATH (default /opt/pw-browsers/chromium).
// Requires `pnpm --filter @emptysock/engine build` first (imports dist/).
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const outIdx = process.argv.indexOf("--out");
const outDir = path.resolve(
  outIdx > 0
    ? process.argv[outIdx + 1]
    : path.join(here, "..", "..", "..", "docs", "gpu-verify"),
);
fs.mkdirSync(outDir, { recursive: true });
const req = createRequire(
  path.join(
    process.env.PLAYWRIGHT_MODULE_DIR ?? "/opt/node22/lib/node_modules",
    "x.js",
  ),
);
const { chromium } = req("playwright");

const bundle = path.join(outDir, ".harness.bundle.js");
// rolldown (the repo's bundler, see packages/toolchain) resolved from the toolchain package.
const { rolldown } = createRequire(
  path.join(here, "..", "..", "toolchain", "x.js"),
)("rolldown");
const b0 = await rolldown({
  input: path.join(here, "gpu-verify.harness.ts"),
  platform: "browser",
  logLevel: "warn",
});
await b0.write({ file: bundle, format: "iife" });
if (process.env.KEEP) fs.copyFileSync(bundle, "/tmp/bundle.dbg.js");

const assets = process.env.GMS_FIXTURE_ASSETS
  ? path.resolve(process.env.GMS_FIXTURE_ASSETS)
  : undefined;
const cfg = {};
if (assets) {
  const sh = fs.readFileSync(
    path.join(assets, "assets", "sh_white.shader.ts"),
    "utf8",
  );
  cfg.shWhite = {
    vertexSrc: JSON.parse(/vertexSrc: ("(?:[^"\\]|\\.)*")/.exec(sh)[1]),
    fragmentSrc: JSON.parse(/fragmentSrc: ("(?:[^"\\]|\\.)*")/.exec(sh)[1]),
  };
  const wgsl = /wgslFragmentSrc: ("(?:[^"\\]|\\.)*")/.exec(sh);
  if (wgsl) cfg.shWhite.wgslFragmentSrc = JSON.parse(wgsl[1]);
  const fnt = fs.readFileSync(
    path.join(assets, "assets", "fnt_menu.font.ts"),
    "utf8",
  );
  const body = /FntMenuFontBitmap: BitmapFontDef = (\{[\s\S]*?\n\});/.exec(
    fnt,
  )[1];
  cfg.fntMenu = new Function(`return (${body})`)();
  cfg.fntMenu.atlasPath = "/assets/fonts/fnt_menu.png";
}
const server = http.createServer((rq, rs) => {
  const u = decodeURIComponent(rq.url.split("?")[0]);
  if (u === "/") {
    rs.setHeader("content-type", "text/html");
    return rs.end("<!doctype html><body></body>");
  }
  if (u === "/bundle.js") {
    rs.setHeader("content-type", "text/javascript");
    return rs.end(fs.readFileSync(bundle));
  }
  const f =
    assets && u.startsWith("/assets/") ? path.join(assets, u) : undefined;
  if (f && fs.existsSync(f)) {
    rs.setHeader("content-type", "image/png");
    return rs.end(fs.readFileSync(f));
  }
  rs.statusCode = 404;
  rs.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium",
  headless: true,
  args: [
    "--use-gl=angle",
    `--use-angle=${process.env.GPU_ANGLE ?? "swiftshader"}`,
    ...((process.env.GPU_ANGLE ?? "swiftshader") === "swiftshader"
      ? ["--enable-unsafe-swiftshader"]
      : []),
    ...(process.env.GPU_EXTRA_ARGS?.split(" ").filter(Boolean) ?? []),
    "--ignore-gpu-blocklist",
    "--no-sandbox",
  ],
});
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto(
  process.env.GPU_RENDERER
    ? `${url}?renderer=${process.env.GPU_RENDERER}`
    : url,
);
await page.addScriptTag({ url: "/bundle.js" });

const results = [];
let failed = 0;
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  ${detail ?? ""}`);
};
const save = (name, dataUrl) =>
  dataUrl &&
  fs.writeFileSync(
    path.join(outDir, name),
    Buffer.from(dataUrl.split(",")[1], "base64"),
  );
const run = (fn, arg) => page.evaluate(([f, a]) => window.gpu[f](a), [fn, arg]);

if (process.env.PROBE) {
  console.log(JSON.stringify(await run("probe")));
}
const r = await run("rain", {});
save("rain-glass.png", r.png);
delete r.png;
console.log("  GL:", r.renderer);
check(
  "rain: not blank / droplets visible",
  r.changedFrac > 0.04 && r.changedFrac < 0.8 && r.meanAbsDiff > 1,
  JSON.stringify({
    changedFrac: +r.changedFrac.toFixed(3),
    meanAbsDiff: +r.meanAbsDiff.toFixed(2),
  }),
);
check(
  "rain: background preserved (opaque, shows scene)",
  r.opaqueFrac > 0.99,
  `opaqueFrac=${r.opaqueFrac.toFixed(3)}`,
);
const r0 = await run("rain", { streakAmount: 0 });
const rs = await run("rain", { streakAmount: 1 });
save("rain-glass-static.png", r0.png);
save("rain-glass-streaks.png", rs.png);
const ratio0 = r0.meanVRun / Math.max(r0.meanHRun, 1e-6),
  ratio1 = rs.meanVRun / Math.max(rs.meanHRun, 1e-6);
// Same seed, so the streak setting is the only difference between the frames.
// Whether trails read as vertical streaks is a visual call (the wet-mark run
// lengths stay near 1 at both settings), so the v/h ratios are informational.
check(
  "rain: streak amount changes the frame",
  r0.png !== rs.png,
  `v/h ratio streak0=${ratio0.toFixed(2)} streak1=${ratio1.toFixed(2)} (informational)`,
);
console.log(
  `  frame cost 640x360 (swiftshader, CPU raster): scene only ${r.msBase.toFixed(2)}ms, +passthrough filter ${r.msPass.toFixed(2)}ms, +rain ${r.msRain.toFixed(2)}ms (rain over passthrough: ${(r.msRain - r.msPass).toFixed(2)}ms)`,
);
results.push({
  name: "rain frame cost",
  msBase: r.msBase,
  msPass: r.msPass,
  msRain: r.msRain,
});

const w = await run("shWhite", cfg);
if (w.skipped) console.log("SKIP  sh_white (set GMS_FIXTURE_ASSETS)");
else {
  check(
    "sh_white: filtered sprite is white",
    w.whiteCount > w.expectedArea * 0.95 && w.nonWhiteOpaque < 20,
    `white=${w.whiteCount}/${w.expectedArea} nonWhite=${w.nonWhiteOpaque}`,
  );
  check(
    "sh_white: quad not collapsed (bbox = sprite rect)",
    w.bbox[0] <= 1 &&
      w.bbox[2] >= 46 &&
      w.bbox[2] <= 50 &&
      w.bbox[1] >= 30 &&
      w.bbox[1] <= 34 &&
      w.bbox[3] >= 93 &&
      w.bbox[3] <= 97,
    JSON.stringify(w.bbox),
  );
  check(
    "sh_white: transparent area stays transparent, control sprite untouched",
    w.filteredEmpty[3] < 10 && w.control[0] > 150 && w.control[1] < 80,
    `control=${w.control} empty=${w.filteredEmpty}`,
  );
}
const b = await run("bitmapText", cfg);
if (b.skipped) console.log("SKIP  bitmap text (set GMS_FIXTURE_ASSETS)");
else {
  save("bitmap-fnt_menu.png", b.png);
  check(
    "bitmap text: glyphs drawn from real fnt_menu atlas",
    b.lit > 300 && b.glyphGroups >= 6,
    `lit=${b.lit} glyphGroups=${b.glyphGroups} bboxY=${b.bboxY}`,
  );
}
const ls = await run("layerShader", cfg);
if (ls.skipped) console.log("SKIP  layer shader (set GMS_FIXTURE_ASSETS)");
else
  check(
    "layer shader: importer shader on a layer whitens its sprite, other layers untouched",
    ls.attached &&
      ls.layered.slice(0, 3).every((v) => v > 245) &&
      ls.layeredEmpty[3] < 10 &&
      ls.plain[0] > 150 &&
      ls.plain[1] < 80,
    `layered=${ls.layered} empty=${ls.layeredEmpty} plain=${ls.plain}`,
  );
const ub = await run("uiBitmap", cfg);
if (ub.skipped) console.log("SKIP  ui bitmap text (set GMS_FIXTURE_ASSETS)");
else {
  const same = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 1);
  check(
    "ui bitmap text: atlas glyph blits on a real canvas, same box at 1x and 2x",
    ub.bitmap1.lit > ub.fallback1.lit * 2 &&
      same(ub.bitmap1.bboxCss, ub.bitmap2.bboxCss),
    `lit=${ub.bitmap1.lit} (fillText ${ub.fallback1.lit}) bbox1x=${ub.bitmap1.bboxCss} bbox2x=${ub.bitmap2.bboxCss}`,
  );
  save("ui-bitmap.png", ub.bitmap1.png);
}
const fl = await run("flashBench", [50, 1000]);
const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 2);
check(
  "sprite flash: white silhouette at 1, exact blend at 0.5, original at 0, alpha kept",
  near(fl.flashed.slice(0, 4), [255, 255, 255, 255]) &&
    near(fl.half.slice(0, 4), [227, 142, 142, 255]) &&
    near(fl.plain.slice(0, 4), [200, 30, 30, 255]) &&
    fl.flashed[11] === 0 &&
    fl.half[11] === 0,
  `flashed=${fl.flashed.slice(0, 4)} half=${fl.half.slice(0, 4)} plain=${fl.plain.slice(0, 4)}`,
);
const cost = (n, f) =>
  fl.runs.find((x) => x.n === n && x.flashing === f).msPerFrame;
check(
  "sprite flash: 1000 flashing sprites cost under 5 ms per frame over a plain frame",
  cost(1000, true) - cost(1000, false) < 5,
  `plain ${cost(1000, false)} ms, flashing ${cost(1000, true)} ms (50 sprites: ${cost(50, false)} vs ${cost(50, true)} ms)`,
);
results.push({ name: "sprite flash cost", runs: fl.runs });
const d = await run("darkness");
save("surface-darkness.png", d.png);
check(
  "surface/bm_subtract: light cutout centre stays bright",
  d.centre[0] > 240,
  `centre=${d.centre}`,
);
check(
  "surface/bm_subtract: outside light is darkened",
  d.outside[0] < 200 && d.outside[0] > 100,
  `outside=${d.outside} corner=${d.corner}`,
);
fs.rmSync(bundle, { force: true });
if (process.env.PROBE) console.log("CONSOLE:", JSON.stringify(errors));
const glErrs = errors.filter((e) => /shader|glsl|compile|link|webgl/i.test(e));
if (glErrs.length) {
  console.log("GL console messages:\n" + glErrs.slice(0, 8).join("\n"));
}
check(
  "no shader compile/link errors",
  glErrs.filter((e) => /error|fail/i.test(e)).length === 0,
  `${glErrs.length} gl messages`,
);
fs.writeFileSync(
  path.join(outDir, "results.json"),
  JSON.stringify({ results, console: errors.slice(0, 50) }, null, 2),
);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);
