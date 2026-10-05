import { describe, expect, it, vi } from "vitest";

const apps: {
  destroyed: number;
  initDone: boolean;
  ticker?: { add: () => void; remove: () => void };
}[] = [];

vi.mock("pixi.js", () => {
  class Application {
    readonly state: (typeof apps)[number] = { destroyed: 0, initDone: false };
    // pixi adds the ticker and stage only once init() has finished.
    ticker?: { add: () => void; remove: () => void };
    stage?: { addChild: () => void };
    screen = { width: 100, height: 100 };
    constructor() {
      apps.push(this.state);
    }
    async init(): Promise<void> {
      await new Promise((r) => setTimeout(r, 10));
      this.ticker = { add: () => {}, remove: () => {} };
      this.stage = { addChild: () => {} };
      this.state.initDone = true;
    }
    destroy(): void {
      if (this.ticker === undefined) throw new Error("destroyed before init");
      this.state.destroyed++;
    }
  }
  class Container {
    addChild(): void {}
  }
  class Graphics {
    x = 0;
    y = 0;
    clear(): this {
      return this;
    }
    circle(): this {
      return this;
    }
    fill(): this {
      return this;
    }
  }
  return { Application, Container, Graphics };
});

const { BouncingBallsDemo } = await import("../BouncingBalls.js");

describe("BouncingBallsDemo", () => {
  it("tears itself down once init finishes when destroyed while pixi is still initialising", async () => {
    const canvas = document.createElement("canvas");
    const demo = new BouncingBallsDemo();
    const init = demo.init(canvas, () => {});
    demo.destroy();
    await init;
    await new Promise((r) => setTimeout(r, 30));
    expect(apps[0]?.initDone).toBe(true);
    expect(apps[0]?.destroyed).toBe(1);
  });

  it("runs a second init only after the first demo was destroyed", async () => {
    const canvas = document.createElement("canvas");
    const first = new BouncingBallsDemo();
    const before = apps.length;
    void first.init(canvas, () => {});
    first.destroy();
    const second = new BouncingBallsDemo();
    await second.init(canvas, () => {});
    expect(apps.length).toBe(before + 2);
    expect(apps[before]?.destroyed).toBe(1);
    expect(apps[before + 1]?.initDone).toBe(true);
    expect(apps[before + 1]?.destroyed).toBe(0);
    second.destroy();
    await new Promise((r) => setTimeout(r, 30));
    expect(apps[before + 1]?.destroyed).toBe(1);
  });
});
