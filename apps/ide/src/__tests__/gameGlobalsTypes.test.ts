import { describe, it, expect } from "vitest";
import {
  buildGameGlobalsDts,
  syncGameGlobalsToMonaco,
} from "../services/gameGlobalsTypes";

describe("gameGlobalsTypes", () => {
  it("emits an augmentation with declared globals and skips bad names", () => {
    const d = buildGameGlobalsDts({ score: "number", "bad name": "x" });
    expect(d).toContain("score: number;");
    expect(d).not.toContain("bad name");
    expect(d).toContain("interface GameGlobals");
  });
  it("replaces the previous extra lib on each sync", () => {
    let disposed = 0;
    const t = {
      addExtraLib: () => ({
        dispose: () => {
          disposed++;
        },
      }),
    };
    syncGameGlobalsToMonaco([t], { a: "1" });
    syncGameGlobalsToMonaco([t], { a: "2" });
    expect(disposed).toBe(1);
  });
});
