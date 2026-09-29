/* eslint-disable -- verification harness: throwaway browser-side driver, not engine source */
// Browser half of gpu-playthrough.mjs. Runs a real GMS2-imported project through
// GmsProjectRuntime + RenderPipeline in headless Chromium (swiftshader WebGL).
import {
  Game,
  GmsProjectRuntime,
  RenderPipeline,
  CameraSystem,
  registerGmlBehavior,
  parsePrefabFile,
  Transform,
  Meta,
  Sprite,
  PhysicsBody,
  GmlBehaviorState,
  LayerElement,
  GmlSequenceState,
} from "../dist/index.js";
import { TilemapSystem } from "../../tilemap/src/index.ts";
// @ts-ignore generated per run by gpu-playthrough.mjs
import { behaviors, tilemaps, fonts } from "playthrough-gen";

type Any = any;
const lookupMap: Record<string, Any> = {
  Transform,
  Meta,
  Sprite,
  PhysicsBody,
  GmlBehaviorState,
  LayerElement,
  GmlSequenceState,
};

let game: Any, runtime: Any, pipeline: Any, camera: Any, manifest: Any;
let data: Any;
const mounted: Any[] = [];
const audioLog: { fn: string; id: string }[] = [];
let W = 1024,
  H = 768;

async function getJson(p: string): Promise<Any> {
  const r = await fetch(p);
  if (!r.ok) throw new Error(`${p}: ${r.status}`);
  return r.json();
}

(window as Any).play = {
  async boot(cfg: { width: number; height: number; zoom?: boolean }) {
    W = cfg.width;
    H = cfg.height;
    manifest = await getJson("/project-manifest.json");
    const objNames: string[] = manifest.prefabs.map((f: string) =>
      f.replace(/\.prefab\.json$/, ""),
    );
    const prefabs: Record<string, Any> = {};
    for (const n of objNames) {
      try {
        prefabs[n] = parsePrefabFile(
          await getJson(`/${n}.prefab.json`),
          (x: string) => lookupMap[x],
        );
      } catch {
        /* skipped */
      }
      const b = (behaviors as Any)[n];
      if (b) registerGmlBehavior(n, b);
    }
    const rooms: Record<string, Any> = {};
    for (const f of manifest.scenes) {
      const name = f.replace(/^rooms\//, "").replace(/\.scene\.json$/, "");
      rooms[name] = await getJson(`/${f}`);
    }
    const roomOrder = Object.keys(rooms);
    // Optional: a project imported before the asset index existed has no file.
    let assetIndex: Any;
    try {
      assetIndex = await getJson("/asset-index.json");
    } catch {
      assetIndex = undefined;
    }
    data = {
      rooms,
      roomOrder,
      prefabs,
      lookup: (x: string) => lookupMap[x],
      assetIndex,
    };
    game = new Game();
    // record audio calls (this run has no real audio device)
    const audio = game.audio;
    for (const fn of ["play", "load", "setPitch", "stop"]) {
      const orig = audio[fn].bind(audio);
      audio[fn] = (id: string, ...a: Any[]) => {
        audioLog.push({ fn, id });
        try {
          return orig(id, ...a);
        } catch {
          return null;
        }
      };
    }
    for (const [id, mod] of fonts as [string, Any][]) {
      for (const [k, v] of Object.entries(mod)) {
        if (k.endsWith("FontBitmap")) game.fonts.registerBitmap(id, v);
        else if (k.endsWith("Font")) game.fonts.register(id, v);
      }
    }
    for (const f of manifest.included ?? []) {
      /* datafiles preloaded below */
    }
    try {
      const inc = await fetch("/included/lang.txt");
      if (inc.ok) game.files.preload("lang.txt", await inc.text());
    } catch {
      /* none */
    }
    pipeline = new RenderPipeline();
    await pipeline.init({
      width: W,
      height: H,
      antialias: false,
      resolution: 1,
      backgroundColor: 0x000000,
    });
    document.body.style.margin = "0";
    document.body.appendChild(pipeline.canvas);
    game.attachRenderer(pipeline);
    camera = new CameraSystem();
    camera.attach(pipeline.stage);
    camera.setViewSize(W, H);
    runtime = new GmsProjectRuntime(game, data, { camera, renderer: pipeline });
    return { rooms: roomOrder.length, prefabs: Object.keys(prefabs).length };
  },

  async loadRoom(name: string) {
    for (const t of mounted.splice(0)) pipeline.unmountTilemap(t);
    await runtime.loadRoom(name);
    const scene = runtime.scene;
    for (const [tname, tdata] of tilemaps as [string, Any][]) {
      if (tname !== name && !tname.startsWith(name + ".")) continue;
      TilemapSystem.register(tdata);
      const tm = TilemapSystem.loadInto(scene, tdata.name);
      pipeline.mountTilemap(tm, "background");
      mounted.push(tm);
    }
    return runtime.currentRoom;
  },

  async step(n: number, keys?: string[]) {
    for (const k of keys ?? []) game.input.simulateKeyDown(k);
    for (let i = 0; i < n; i++) {
      runtime.update(1 / 60);
      if (i % 50 === 49) await new Promise((r) => setTimeout(r, 1));
    }
    return this.info();
  },
  key(k: string, down: boolean) {
    down ? game.input.simulateKeyDown(k) : game.input.simulateKeyUp(k);
  },

  /** Advance one frame and capture in the same task (WebGL back-buffer is valid until the task ends). */
  stepSnap(keysDown?: string[]) {
    for (const k of keysDown ?? []) game.input.simulateKeyDown(k);
    runtime.update(1 / 60);
    return (pipeline.canvas as HTMLCanvasElement).toDataURL("image/png");
  },

  async settle(ms = 200) {
    await new Promise((r) => setTimeout(r, ms));
  },

  info() {
    const scene = runtime.scene;
    const ents: Record<string, number> = {};
    let player: Any = null;
    scene?.each(Meta, (m: Any, e: Any) => {
      ents[m.name] = (ents[m.name] ?? 0) + 1;
      if (m.name === "obj_player" && !player) {
        const t = e.get(Transform);
        player = { x: t.x, y: t.y };
      }
    });
    const cs = camera.state;
    return {
      room: runtime.currentRoom,
      entityCount: Object.values(ents).reduce((a: number, b: any) => a + b, 0),
      enemies: ents["obj_enemy"] ?? 0,
      player,
      camera: { x: cs.x, y: cs.y, zoom: cs.zoom },
      stage: {
        x: pipeline.stage.x,
        y: pipeline.stage.y,
        sx: pipeline.stage.scale.x,
      },
      audio: audioLog.length,
    };
  },

  audioLog() {
    return audioLog.slice();
  },

  /** Run a snippet against the live scene (test hook): fn(scene, {Meta, Transform, Sprite}). */
  eval(src: string) {
    return new Function("scene", "ctx", `return (${src})(scene, ctx)`)(
      runtime.scene,
      { Meta, Transform, Sprite, game, runtime, pipeline, camera },
    );
  },

  /** Load a room with modified view data (multi-view check). */
  async loadRoomWithViews(name: string, views: Any[]) {
    const orig = data.rooms[name];
    data.rooms[name] = { ...orig, views, viewsEnabled: true };
    runtime = new GmsProjectRuntime(game, data, { camera, renderer: pipeline });
    return this.loadRoom(name);
  },
};
