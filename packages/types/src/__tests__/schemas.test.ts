import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  ProjectManifestSchema,
  SaveSlotSchema,
  GPUTierSchema,
  EngineConfigSchema,
  AssetEntrySchema,
  AssetIndexSchema,
  SceneDocumentSchema,
} from "../index.js";

describe("ProjectManifestSchema", () => {
  const base = {
    name: "MyGame",
    version: "1.0.0",
    engineVersion: "0.1.0",
  };

  it("parses valid data with defaults", () => {
    const result = ProjectManifestSchema.parse(base);
    expect(result.name).toBe("MyGame");
    expect(result.entryPoint).toBe("src/main.ts");
    expect(result.targetResolution).toEqual({ width: 1280, height: 720 });
  });

  it("throws ZodError on missing name", () => {
    expect(() =>
      ProjectManifestSchema.parse({ version: "1.0.0", engineVersion: "0.1.0" }),
    ).toThrow(z.ZodError);
  });

  it("throws ZodError on invalid version format", () => {
    expect(() =>
      ProjectManifestSchema.parse({ ...base, version: "not-semver" }),
    ).toThrow(z.ZodError);
  });

  it("strips extra fields (strict passthrough)", () => {
    const result = ProjectManifestSchema.parse({
      ...base,
      unknownField: "ignored",
    });
    expect((result as Record<string, unknown>)["unknownField"]).toBeUndefined();
  });

  it("accepts custom resolution", () => {
    const result = ProjectManifestSchema.parse({
      ...base,
      targetResolution: { width: 1920, height: 1080 },
    });
    expect(result.targetResolution.width).toBe(1920);
  });
});

describe("SaveSlotSchema", () => {
  const valid = {
    slotId: 0,
    timestamp: Date.now(),
    playtime: 120,
    currentScene: "GameScene",
    data: { hp: 100 },
  };

  it("parses valid save slot", () => {
    const result = SaveSlotSchema.parse(valid);
    expect(result.slotId).toBe(0);
    expect(result.currentScene).toBe("GameScene");
  });

  it("throws on slotId out of range", () => {
    expect(() => SaveSlotSchema.parse({ ...valid, slotId: 10 })).toThrow(
      z.ZodError,
    );
  });

  it("throws on negative playtime", () => {
    expect(() => SaveSlotSchema.parse({ ...valid, playtime: -1 })).toThrow(
      z.ZodError,
    );
  });

  it("throws on missing currentScene", () => {
    const rest = Object.fromEntries(
      Object.entries(valid).filter(([k]) => k !== "currentScene"),
    );
    expect(() => SaveSlotSchema.parse(rest)).toThrow(z.ZodError);
  });
});

describe("GPUTierSchema", () => {
  it("accepts valid tiers", () => {
    for (const tier of ["potato", "low", "mid", "high", "ultra"] as const) {
      expect(GPUTierSchema.parse(tier)).toBe(tier);
    }
  });

  it("rejects invalid tier", () => {
    expect(() => GPUTierSchema.parse("extreme")).toThrow(z.ZodError);
  });

  it("rejects number", () => {
    expect(() => GPUTierSchema.parse(3)).toThrow(z.ZodError);
  });
});

describe("EngineConfigSchema", () => {
  it("parses empty object with defaults", () => {
    const result = EngineConfigSchema.parse({});
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
    expect(result.antialias).toBe(true);
  });

  it("throws on negative width", () => {
    expect(() => EngineConfigSchema.parse({ width: -1 })).toThrow(z.ZodError);
  });

  it("accepts partial config", () => {
    const result = EngineConfigSchema.parse({ width: 800, height: 600 });
    expect(result.width).toBe(800);
    expect(result.resolution).toBe(1);
  });
});

describe("AssetEntrySchema", () => {
  const valid = {
    id: "ast-1",
    name: "player.png",
    type: "image" as const,
    path: "assets/player.png",
  };

  it("parses valid entry", () => {
    const result = AssetEntrySchema.parse(valid);
    expect(result.id).toBe("ast-1");
  });

  it("throws on invalid type", () => {
    expect(() => AssetEntrySchema.parse({ ...valid, type: "video" })).toThrow(
      z.ZodError,
    );
  });

  it("accepts optional size and checksum", () => {
    const result = AssetEntrySchema.parse({
      ...valid,
      size: 1024,
      checksum: "abc",
    });
    expect(result.size).toBe(1024);
  });
});

describe("SceneDocumentSchema", () => {
  const valid = {
    formatVersion: 2,
    name: "GameScene",
    entities: [
      { id: "a" },
      { id: "b", parent: "a", components: { Meta: { data: { name: "B" } } } },
    ],
  };

  it("parses a valid document", () => {
    const result = SceneDocumentSchema.parse(valid);
    expect(result.name).toBe("GameScene");
    expect(result.entities).toHaveLength(2);
  });

  it("round-trips through JSON", () => {
    const doc = SceneDocumentSchema.parse(valid);
    expect(SceneDocumentSchema.parse(JSON.parse(JSON.stringify(doc)))).toEqual(
      doc,
    );
  });

  it("rejects a missing or wrong formatVersion", () => {
    expect(() =>
      SceneDocumentSchema.parse({ ...valid, formatVersion: 1 }),
    ).toThrow(z.ZodError);
    expect(() =>
      SceneDocumentSchema.parse({ name: "X", entities: [] }),
    ).toThrow(z.ZodError);
  });

  it("rejects invalid backgroundColor", () => {
    expect(() =>
      SceneDocumentSchema.parse({ ...valid, backgroundColor: "red" }),
    ).toThrow(z.ZodError);
  });

  it("rejects duplicate ids, missing parents and parent cycles", () => {
    expect(() =>
      SceneDocumentSchema.parse({
        ...valid,
        entities: [{ id: "a" }, { id: "a" }],
      }),
    ).toThrow(/duplicate/);
    expect(() =>
      SceneDocumentSchema.parse({
        ...valid,
        entities: [{ id: "a", parent: "zz" }],
      }),
    ).toThrow(/unknown parent/);
    expect(() =>
      SceneDocumentSchema.parse({
        ...valid,
        entities: [
          { id: "a", parent: "b" },
          { id: "b", parent: "a" },
        ],
      }),
    ).toThrow(/cycle/);
  });

  it("rejects an unresolved view follow ref and bad ids", () => {
    const view = {
      id: "v0",
      visible: true,
      world: { x: 0, y: 0, w: 1, h: 1 },
      screen: { x: 0, y: 0, w: 1, h: 1 },
      follow: { entity: { $ref: "nope" } },
    };
    expect(() =>
      SceneDocumentSchema.parse({
        ...valid,
        room: { width: 1, height: 1, views: [view] },
      }),
    ).toThrow(/follows unknown entity/);
    expect(() =>
      SceneDocumentSchema.parse({ ...valid, entities: [{ id: "bad id!" }] }),
    ).toThrow(z.ZodError);
  });
});

describe("AssetIndexSchema", () => {
  it("round-trips and defaults collisions", () => {
    const parsed = AssetIndexSchema.parse({
      version: 1,
      entries: [
        {
          kind: "sprite",
          name: "spr_a",
          id: "./assets/sprites/spr_a/frame_0.png",
          width: 16,
          height: 32,
          frameCount: 2,
        },
      ],
    });
    expect(parsed.collisions).toEqual([]);
    expect(AssetIndexSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(
      parsed,
    );
  });
  it("rejects unknown kinds and bad versions", () => {
    expect(() =>
      AssetIndexSchema.parse({
        version: 1,
        entries: [{ kind: "bogus", name: "x", id: "x" }],
      }),
    ).toThrow();
    expect(() => AssetIndexSchema.parse({ version: 2, entries: [] })).toThrow();
  });
});
