import { describe, expect, it, vi } from "vitest";
import { createHeadlessGame } from "../testing/index.js";
import { defineScene } from "../Game.js";
import { defineComponent } from "../Component.js";
import { Meta } from "../components/Meta.js";
import { NO_REF, type EntityRef } from "../EntityRef.js";
import {
  captureEntities,
  findCrossReferences,
  persistentTransferPolicy,
} from "../SceneTransfer.js";
import { Scene } from "../Scene.js";

// The engine tsconfig carries no Node typings, so the builtins load untyped.
interface NodeFs {
  readFileSync(path: string, encoding: "utf8"): string;
}
const fs = (await import(/* @vite-ignore */ "node" + ":fs")) as NodeFs;
const cwd = (
  globalThis as unknown as { process: { cwd(): string } }
).process.cwd();
const src = (rel: string): string =>
  fs.readFileSync(`${cwd}/src/${rel}`, "utf8");

/**
 * Every per-entity side table `Scene.destroy` clears must be accounted for
 * when entities move between scenes: either carried by a registered
 * `EntityExtra` whose `clear` calls the same helper, or declared engine
 * managed (recreated or meaningless after a transfer). A new `clear*` call in
 * `Scene.destroy` fails this test until it is classified here.
 */
const COVERED_BY_EXTRA: Record<string, string> = {};
const ENGINE_MANAGED: Record<string, string> = {
  clearEntitySignals: "subscriptions belong to the old scene's bus wiring",
  clearPhysicsBody:
    "ComponentDef.transfer nulls handles; PhysicsSystem recreates",
  clearCoroutines: "scheduled against the old world; not portable",
  clearVisualScriptScope: "evaluation scope rebuilt on the next run",
};

describe("Scene.destroy side tables vs EntityExtra", () => {
  const scene = src("Scene.ts");
  const destroyBody = scene.slice(scene.indexOf("  destroy(entity: Entity)"));
  const helpers = [
    ...new Set(
      [...destroyBody.matchAll(/\b(clear[A-Z]\w*)\(this\.world,/g)].map(
        (m) => m[1] as string,
      ),
    ),
  ];

  it("finds the helpers", () => {
    expect(helpers.length).toBeGreaterThanOrEqual(4);
  });

  it("classifies every clear* helper as extra-covered or engine-managed", () => {
    const unclassified = helpers.filter(
      (h) => !(h in COVERED_BY_EXTRA) && !(h in ENGINE_MANAGED),
    );
    expect(unclassified).toEqual([]);
  });

  it("has no stale classification entries", () => {
    const known = [
      ...Object.keys(COVERED_BY_EXTRA),
      ...Object.keys(ENGINE_MANAGED),
    ];
    expect(known.filter((k) => !helpers.includes(k))).toEqual([]);
  });

  it("extra-covered helpers are called from a registered EntityExtra clear", () => {
    for (const [helper, file] of Object.entries(COVERED_BY_EXTRA)) {
      const text = src(file);
      const re = new RegExp(`clear:\\s*\\([^)]*\\)\\s*=>\\s*${helper}\\(`);
      expect(re.test(text), `${helper} in ${file}`).toBe(true);
    }
  });
});

const Link = defineComponent("XrefLink", () => ({ to: NO_REF as EntityRef }), {
  schema: { to: { kind: "entityRef" } },
});

describe("findCrossReferences", () => {
  it("reports refs between two snapshots of one scene, both directions", () => {
    const scene = new Scene();
    const a = scene.spawn();
    a.add(Meta, { persistent: true });
    const b = scene.spawn();
    b.add(Meta, { persistent: false });
    b.add(Link, { to: scene.refTo(a) });
    a.add(Link, { to: NO_REF });
    const carried = captureEntities(scene, persistentTransferPolicy);
    const room = captureEntities(scene, {
      select: (e) => e.get(Meta)?.persistent === false,
    });
    expect(findCrossReferences(room, carried)).toHaveLength(1);
    expect(findCrossReferences(carried, room)).toEqual([]);
  });

  it("Game warns when carried and cached entities reference each other", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const game = createHeadlessGame();
    await game.loadScene(
      defineScene({
        persistentKey: "r",
        onLoad(scene) {
          const a = scene.spawn();
          a.add(Meta, { persistent: true });
          const b = scene.spawn();
          b.add(Meta, { persistent: false });
          b.add(Link, { to: scene.refTo(a) });
        },
      }),
    );
    await game.loadScene(defineScene({}), { carry: persistentTransferPolicy });
    expect(warn.mock.calls.some((c) => String(c[0]).includes("dangle"))).toBe(
      true,
    );
    warn.mockRestore();
  });
});
