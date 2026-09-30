#!/usr/bin/env node
// Real-GPU (swiftshader WebGL) verification of engine rendering paths.
//   node packages/engine/scripts/gpu-verify.mjs [--out <dir>]
// Env: GMS_FIXTURE_ASSETS = dir of a GMS2 importer output (for sh_white + fnt_menu
//      checks); those two checks are reported "skipped" without it.
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
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
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
await page.goto(url);
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
check(
  "rain: trails elongate wet marks vertically (streak 1 vs 0)",
  ratio1 > ratio0 * 1.1,
  `v/h ratio streak0=${ratio0.toFixed(2)} streak1=${ratio1.toFixed(2)}`,
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
