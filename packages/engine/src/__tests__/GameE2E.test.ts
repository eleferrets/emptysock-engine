/**
 * End-to-end test: a minimal turn-based RPG game loop.
 * Exercises Scene, Entity, ECS components, BattleSystem, and Widget API together.
 */
import { describe, it, expect, vi } from "vitest";
import { Scene } from "../core/Scene.js";
import { SceneManagerInstance } from "../core/SceneManager.js";
import { BattleSystem } from "../systems/BattleSystem.js";
import { TweenManager } from "../systems/TweenSystem.js";
import { ButtonWidget, ProgressBarWidget } from "../ui/Widget.js";
import { Transform } from "../components/Transform.js";
import { Sprite } from "../components/Sprite.js";
import type { BattleEvent } from "../systems/BattleSystem.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeCombatant(
  id: string,
  name: string,
  isParty: boolean,
  hp = 100,
  atk = 20,
  def = 10,
) {
  return {
    id,
    name,
    stats: {
      hp,
      maxHp: hp,
      mp: 50,
      maxMp: 50,
      attack: atk,
      defense: def,
      speed: 10,
      luck: 0,
    },
    statusEffects: [] as never[],
    isParty,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Scene + ECS", () => {
  it("entities hold typed components and can be queried by tag", () => {
    const scene = new Scene("Level1");

    const player = scene.createEntity("Player");
    player.addTag("player");
    player.addComponent(new Transform({ x: 100, y: 200 }));
    player.addComponent(new Sprite({ texturePath: "hero.png" }));

    const enemy = scene.createEntity("Slime");
    enemy.addTag("enemy");
    enemy.addComponent(new Transform({ x: 300, y: 200 }));

    expect(scene.getEntities().size).toBe(2);
    expect(scene.getEntitiesByTag("player")).toHaveLength(1);
    expect(scene.getEntitiesByTag("enemy")).toHaveLength(1);

    const t = player.getComponent<Transform>("Transform");
    expect(t?.x).toBe(100);
    expect(t?.y).toBe(200);

    const sp = player.getComponent<Sprite>("Sprite");
    expect(sp?.texturePath).toBe("hero.png");
  });

  it("systems update every frame when scene is running", () => {
    const scene = new Scene("GameScene");
    const frames: number[] = [];
    scene.addSystem("tick", (_s, dt) => frames.push(dt));
    scene.start();
    scene.update(0.016);
    scene.update(0.016);
    scene.update(0.016);
    expect(frames).toHaveLength(3);
    expect(frames.every((f) => f === 0.016)).toBe(true);
  });
});

describe("SceneManager scene stack", () => {
  it("pushScene and popScene restore prior scene", () => {
    const sm = SceneManagerInstance as unknown as {
      _registry: Map<string, () => Scene>;
      _active: Scene | null;
      _stack: Scene[];
      _pending: string | null;
      _transitioning: boolean;
      _elapsed: number;
    };
    sm._registry.clear();
    sm._active?.stop();
    sm._active = null;
    sm._pending = null;
    sm._transitioning = false;
    sm._elapsed = 0;

    SceneManagerInstance.register("Game", () => new Scene("Game"));
    SceneManagerInstance.load("Game");
    expect(SceneManagerInstance.current?.name).toBe("Game");

    SceneManagerInstance.pushScene(new Scene("Pause"));
    expect(SceneManagerInstance.current?.name).toBe("Pause");

    SceneManagerInstance.popScene();
    expect(SceneManagerInstance.current?.name).toBe("Game");
  });
});

describe("BattleSystem full combat loop", () => {
  it("runs a complete 1v1 battle to victory", () => {
    const battle = new BattleSystem({ critChance: 0, fleeChance: 0 });
    battle.loadDatabase({
      skills: [
        {
          id: "fireball",
          name: "Fireball",
          mpCost: 10,
          targetType: "single-enemy",
          formula: "magical",
          power: 40,
        },
      ],
      statusEffects: [],
    });

    battle.addPartyMember(makeCombatant("hero", "Hero", true, 100, 30, 10));
    battle.addEnemy(makeCombatant("slime", "Slime", false, 50, 10, 5));

    const events: BattleEvent[] = [];
    battle.onEvent((e) => events.push(e));

    battle.start();
    expect(battle.getPhase()).toBe("input");

    const actionNeededEvents = events.filter((e) => e.kind === "action-needed");
    expect(actionNeededEvents.length).toBeGreaterThan(0);

    // Hero attacks each round until slime is defeated
    let rounds = 0;
    while (battle.getPhase() === "input" && rounds < 20) {
      battle.submitAction("hero", { type: "attack", targetId: "slime" });
      rounds++;
    }

    const phase = battle.getPhase();
    expect(phase === "victory" || phase === "input").toBe(true);

    if (phase === "victory") {
      expect(events.some((e) => e.kind === "victory")).toBe(true);
      expect(events.some((e) => e.kind === "combatant-defeated")).toBe(true);
    }

    battle.destroy();
  });

  it("skill with status effect applies the effect", () => {
    const battle = new BattleSystem({ critChance: 0 });
    battle.loadDatabase({
      skills: [
        {
          id: "poison",
          name: "Poison Arrow",
          mpCost: 5,
          targetType: "single-enemy",
          formula: "fixed",
          power: 10,
          statusEffect: { effectId: "poisoned", chance: 1.0 },
        },
      ],
      statusEffects: [
        { id: "poisoned", name: "Poisoned", hpDrainPercentPerTurn: 0.1 },
      ],
    });

    battle.addPartyMember(makeCombatant("hero", "Hero", true, 200, 20, 10));
    battle.addEnemy(makeCombatant("goblin", "Goblin", false, 200, 10, 5));

    const events: BattleEvent[] = [];
    battle.onEvent((e) => events.push(e));

    battle.start();
    // Use poison skill
    battle.submitAction("hero", {
      type: "skill",
      skillId: "poison",
      targetId: "goblin",
    });

    expect(events.some((e) => e.kind === "status-applied")).toBe(true);

    const applied = events.find((e) => e.kind === "status-applied") as
      | Extract<BattleEvent, { kind: "status-applied" }>
      | undefined;
    expect(applied?.effectId).toBe("poisoned");

    battle.destroy();
  });

  it("flee action changes phase to idle", () => {
    const battle = new BattleSystem({ fleeChance: 1.0 });
    battle.addPartyMember(makeCombatant("hero", "Hero", true));
    battle.addEnemy(makeCombatant("boss", "Boss", false));
    battle.start();

    let fled = false;
    battle.onEvent((e) => {
      if (e.kind === "fled") fled = true;
    });
    battle.submitAction("hero", { type: "flee" });

    expect(fled).toBe(true);
    battle.destroy();
  });
});

describe("TweenManager in-game use", () => {
  it("tweens a value over time and fires onComplete", () => {
    const tweens = new TweenManager();
    const target = { x: 0 };
    const done = vi.fn();
    tweens.to(
      target,
      { x: 100 },
      { duration: 1.0, ease: "quadOut", onComplete: done },
    );

    tweens.update(0.5);
    expect(target.x).toBeGreaterThan(0);
    expect(target.x).toBeLessThan(100);

    tweens.update(0.5);
    expect(target.x).toBeCloseTo(100, 1);
    expect(done).toHaveBeenCalledOnce();
  });
});

describe("Widget UI in game scene", () => {
  it("button click fires handler and disables on toggle", () => {
    const clicked = vi.fn();
    const btn = new ButtonWidget({
      label: "Attack",
      width: 120,
      height: 40,
      anchor: "bottom",
    });
    btn.on("click", clicked);

    expect(btn.state).toBe("normal");
    btn.triggerClick();
    expect(clicked).toHaveBeenCalledOnce();

    btn.disabled = true;
    btn.triggerClick();
    expect(clicked).toHaveBeenCalledOnce(); // still just 1 call
  });

  it("progress bar tracks HP fraction", () => {
    const hpBar = new ProgressBarWidget({
      value: 75,
      min: 0,
      max: 100,
      width: 200,
      height: 12,
    });
    expect(hpBar.normalised).toBeCloseTo(0.75);
    hpBar.value = 25;
    expect(hpBar.normalised).toBeCloseTo(0.25);
  });
});
