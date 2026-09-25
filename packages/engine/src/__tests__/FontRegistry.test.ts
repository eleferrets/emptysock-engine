import { describe, it, expect, beforeEach } from "vitest";
import { FontRegistry } from "../systems/FontRegistry.js";
import { Game } from "../Game.js";

describe("FontRegistry", () => {
  let fonts: FontRegistry;

  beforeEach(() => {
    fonts = new FontRegistry();
  });

  it("registers and reads back a font descriptor by id", () => {
    fonts.register("fnt_menu", {
      family: "Impact",
      size: 24,
      bold: true,
      italic: false,
    });
    expect(fonts.has("fnt_menu")).toBe(true);
    expect(fonts.get("fnt_menu")).toEqual({
      family: "Impact",
      size: 24,
      bold: true,
      italic: false,
    });
  });

  it("has() is false and get() is undefined for an unregistered id", () => {
    expect(fonts.has("nope")).toBe(false);
    expect(fonts.get("nope")).toBeUndefined();
  });

  it("cssFontFor composes '[italic ][bold ]<size>px <family>' in the right order", () => {
    fonts.register("plain", {
      family: "Arial",
      size: 12,
      bold: false,
      italic: false,
    });
    fonts.register("bold", {
      family: "Arial",
      size: 12,
      bold: true,
      italic: false,
    });
    fonts.register("italic", {
      family: "Arial",
      size: 12,
      bold: false,
      italic: true,
    });
    fonts.register("both", {
      family: "Arial",
      size: 12,
      bold: true,
      italic: true,
    });

    expect(fonts.cssFontFor("plain")).toBe("12px Arial");
    expect(fonts.cssFontFor("bold")).toBe("bold 12px Arial");
    expect(fonts.cssFontFor("italic")).toBe("italic 12px Arial");
    expect(fonts.cssFontFor("both")).toBe("italic bold 12px Arial");
  });

  it("cssFontFor returns undefined for an unregistered id", () => {
    expect(fonts.cssFontFor("missing")).toBeUndefined();
  });

  it("keys() enumerates every registered id", () => {
    fonts.register("a", { family: "A", size: 1, bold: false, italic: false });
    fonts.register("b", { family: "B", size: 2, bold: false, italic: false });
    expect(Array.from(fonts.keys()).sort()).toEqual(["a", "b"]);
  });

  it("clear() removes every registered font", () => {
    fonts.register("a", { family: "A", size: 1, bold: false, italic: false });
    fonts.clear();
    expect(fonts.has("a")).toBe(false);
    expect(Array.from(fonts.keys())).toEqual([]);
  });

  it("re-registering the same id overwrites its descriptor", () => {
    fonts.register("x", { family: "A", size: 1, bold: false, italic: false });
    fonts.register("x", { family: "B", size: 2, bold: true, italic: true });
    expect(fonts.get("x")).toEqual({
      family: "B",
      size: 2,
      bold: true,
      italic: true,
    });
  });
});

describe("FontRegistry as a Game service", () => {
  it("Game constructs one FontRegistry, reachable via game.fonts and ctx.plugins-style SceneLifecycle.fonts", async () => {
    const game = new Game();
    expect(game.fonts).toBeInstanceOf(FontRegistry);
    game.fonts.register("fnt_a", {
      family: "A",
      size: 10,
      bold: false,
      italic: false,
    });

    let sawFonts: FontRegistry | undefined;
    await game.loadScene(
      {
        onLoad: (_scene, ctx) => {
          sawFonts = ctx.fonts;
        },
      },
      { manageLifecycle: false },
    );
    expect(sawFonts).toBe(game.fonts);
    expect(sawFonts?.get("fnt_a")?.family).toBe("A");
  });

  it("a new Game gets its own isolated FontRegistry instance", () => {
    const gameA = new Game();
    const gameB = new Game();
    gameA.fonts.register("only_in_a", {
      family: "A",
      size: 1,
      bold: false,
      italic: false,
    });
    expect(gameB.fonts.has("only_in_a")).toBe(false);
  });
});
