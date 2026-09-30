#!/usr/bin/env node
// Real-GPU playthrough of a GMS2-imported project: renders real rooms through
// Fixture env vars: GMS_FIXTURE_OUT here and GMS_FIXTURE_ASSETS in gpu-verify.mjs each name a GMS2 importer output dir; tests use GMS_FIXTURE_DIR (dir holding a .yyp).
// Fixture env vars (generic, no project names): GMS_FIXTURE_OUT here and GMS_FIXTURE_ASSETS in gpu-verify.mjs both name a GMS2 importer output dir; tests use GMS_FIXTURE_DIR (dir holding a .yyp).
// GmsProjectRuntime + RenderPipeline in headless Chromium (swiftshader) and saves PNGs.
//   GMS_FIXTURE_OUT=<importer output dir> node packages/engine/scripts/gpu-playthrough.mjs [--out <dir>]
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
    : path.join(here, "..", "..", "..", "docs", "gpu-verify", "playthrough"),
);
fs.mkdirSync(outDir, { recursive: true });
const project = path.resolve(process.env.GMS_FIXTURE_OUT ?? "");
if (
  !process.env.GMS_FIXTURE_OUT ||
  !fs.existsSync(path.join(project, "project-manifest.json"))
) {
  console.log("SKIP: set GMS_FIXTURE_OUT to an importer output dir");
  process.exit(0);
}
const req = createRequire(
  path.join(
    process.env.PLAYWRIGHT_MODULE_DIR ?? "/opt/node22/lib/node_modules",
    "x.js",
  ),
);
const { chromium } = req("playwright");
const { rolldown } = createRequire(
  path.join(here, "..", "..", "toolchain", "x.js"),
)("rolldown");

// Generated entry: every behavior module, room tilemap module and font module of the project.
const manifest = JSON.parse(
  fs.readFileSync(path.join(project, "project-manifest.json"), "utf8"),
);
const objs = manifest.prefabs
  .map((f) => f.replace(/\.prefab\.json$/, ""))
  .filter((n) => fs.existsSync(path.join(project, `${n}.behavior.ts`)));
const tmDir = path.join(project, "rooms");
const tmFiles = fs.existsSync(tmDir)
  ? fs.readdirSync(tmDir).filter((f) => f.endsWith(".tilemap.ts"))
  : [];
const fontFiles = fs.existsSync(path.join(project, "assets"))
  ? fs
      .readdirSync(path.join(project, "assets"))
      .filter((f) => f.endsWith(".font.ts"))
  : [];
const shaderFiles = fs.existsSync(path.join(project, "assets"))
  ? fs
      .readdirSync(path.join(project, "assets"))
      .filter((f) => f.endsWith(".shader.ts"))
  : [];
const gen = [];
objs.forEach((n, i) =>
  gen.push(
    `import * as b${i} from ${JSON.stringify(path.join(project, `${n}.behavior.ts`))};`,
  ),
);
tmFiles.forEach((f, i) =>
  gen.push(`import * as t${i} from ${JSON.stringify(path.join(tmDir, f))};`),
);
fontFiles.forEach((f, i) =>
  gen.push(
    `import * as f${i} from ${JSON.stringify(path.join(project, "assets", f))};`,
  ),
);
shaderFiles.forEach((f) =>
  gen.push(`import ${JSON.stringify(path.join(project, "assets", f))};`),
);
gen.push(
  `export const behaviors = { ${objs.map((n, i) => `${JSON.stringify(n)}: b${i}`).join(", ")} };`,
);
// room tilemap modules: every export with a `layers` array is a TilemapData; room name = data.name
gen.push(
  `export const tilemaps = [${tmFiles.map((f, i) => `...Object.values(t${i}).filter((v) => v && v.layers).map((v) => [v.name, v])`).join(", ")}];`,
);
gen.push(
  `export const fonts = [${fontFiles.map((f, i) => `[${JSON.stringify(f.replace(/\.font\.ts$/, ""))}, f${i}]`).join(", ")}];`,
);
const tmp = path.join(outDir, ".gen");
fs.mkdirSync(tmp, { recursive: true });
const genFile = path.join(tmp, "playthrough-gen.ts");
fs.writeFileSync(genFile, gen.join("\n"));
const bundle = path.join(tmp, "bundle.js");
const b0 = await rolldown({
  input: path.join(here, "gpu-playthrough.harness.ts"),
  platform: "browser",
  logLevel: "warn",
  resolve: {
    alias: {
      "@emptysock/engine": path.join(here, "..", "dist", "index.js"),
      "playthrough-gen": genFile,
    },
  },
});
await b0.write({ file: bundle, format: "iife" });

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
  const f = path.join(project, u);
  if (f.startsWith(project) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    const ext = path.extname(f);
    rs.setHeader(
      "content-type",
      ext === ".png"
        ? "image/png"
        : ext === ".json"
          ? "application/json"
          : "application/octet-stream",
    );
    return rs.end(fs.readFileSync(f));
  }
  missing.push(u);
  rs.statusCode = 404;
  rs.end();
});
const missing = [];
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
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
await page.goto(url);
await page.addScriptTag({ url: "/bundle.js" });

const save = (name, dataUrl) =>
  fs.writeFileSync(
    path.join(outDir, name),
    Buffer.from(dataUrl.split(",")[1], "base64"),
  );
const P = (fn, ...args) =>
  page.evaluate(([f, a]) => window.play[f](...a), [fn, args]);
const shots = [];
const snap = async (name, keys) => {
  const d = await P("stepSnap", keys);
  save(name, d);
  shots.push(name);
};
const log = (...a) => console.log(...a);

const W = Number(process.env.PT_W ?? 1024),
  H = Number(process.env.PT_H ?? 768);
log("boot", JSON.stringify(await P("boot", { width: W, height: H })));

// Boot flow: rm_init -> rm_init2 (controllers, persistent) -> gameplay rooms.
await P("loadRoom", "rm_init");
log("init", JSON.stringify(await P("step", 30)));
await P("settle", 300);
log("after init", JSON.stringify(await P("step", 30)));

const scenario = JSON.parse(process.env.PT_SCENARIO ?? "null") ?? [
  {
    room: "rm_menuf",
    shots: [
      [5, "menu-frame5"],
      [60, "menu-frame65"],
    ],
  },
  {
    room: "rm_1",
    shots: [[3, "rm1-frame3"]],
    run: [
      ["ArrowRight", 90, "rm1-moving-frame93"],
      ["ArrowRight", 90, "rm1-moving-frame183"],
      ["ArrowRight", 120, "rm1-moving-frame303"],
    ],
  },
  {
    room: "rm_0",
    shots: [
      [3, "rm0-frame3"],
      [90, "rm0-frame93"],
    ],
  },
  { room: "rm_2", shots: [[3, "rm2-frame3"]] },
  { room: "rm_ending", shots: [[30, "ending-frame30"]] },
];
for (const s of scenario) {
  log("room", s.room, JSON.stringify(await P("loadRoom", s.room)));
  await P("settle", 300);
  let f = 0;
  for (const [target, name] of s.shots ?? []) {
    if (target - 1 > 0) await P("step", target - 1 - f);
    f = target - 1;
    await snap(`${name}.png`);
    f += 1;
    log(" ", name, JSON.stringify(await P("info")));
  }
  for (const [key, frames, name] of s.run ?? []) {
    await P("step", frames - 1, [key]);
    await snap(`${name}.png`, [key]);
    log(" ", name, JSON.stringify(await P("info")));
  }
  await P("key", "ArrowRight", false);
}
if (process.env.PT_EXTRA) {
  const r = await page.evaluate(process.env.PT_EXTRA);
  log("extra", JSON.stringify(r));
}
fs.writeFileSync(
  path.join(outDir, "playthrough-report.json"),
  JSON.stringify(
    {
      shots,
      missingAssets: [...new Set(missing)],
      consoleErrors: errors.slice(0, 40),
      audio: await P("audioLog"),
    },
    null,
    2,
  ),
);
log("missing assets:", [...new Set(missing)].slice(0, 20));
log("console errors:", errors.slice(0, 10));
fs.rmSync(tmp, { recursive: true, force: true });
await browser.close();
server.close();
