import { describe, it, expect, beforeEach } from "vitest";
import { useIDEStore } from "../store/ideStore";
import { useLocalisationStore } from "../store/localisationStore";

// Reset to a known clean state before each test so tests do not bleed into each other.
beforeEach(() => {
  useIDEStore.getState().resetProject();
});

// ---------------------------------------------------------------------------
// Default project boilerplate targets the ECS API, not the classic one —
// apps/ide's runtime bundle and Monaco types only cover @emptysock/engine
// now (RELEASE_PASS.md's "apps/ide ECS migration" track), so a new project
// seeded with classic-API code (`extends Scene`, `createEntity`, `new
// Transform(...)`) would fail to even typecheck, let alone run.
// ---------------------------------------------------------------------------
describe("ideStore — default project boilerplate is ECS, not classic", () => {
  it("imports and calls only real ECS API shapes", () => {
    const code = useIDEStore.getState().editorCode;
    expect(code).toContain("defineScene");
    expect(code).toContain("scene.spawn(");
    expect(code).toContain(".add(Transform");
    expect(code).toContain("new Game()");
    // Classic-only API shapes must not reappear in the seeded boilerplate.
    expect(code).not.toContain("extends Scene");
    expect(code).not.toContain("createEntity");
    expect(code).not.toContain("addComponent");
  });

  it('seeds the same code into openFiles["src/scenes/GameScene.ts"]', () => {
    const state = useIDEStore.getState();
    expect(state.openFiles["src/scenes/GameScene.ts"]).toBe(state.editorCode);
  });
});

// ---------------------------------------------------------------------------
// saveProjectJson / loadProjectFiles round-trip
// ---------------------------------------------------------------------------
describe("ideStore — saveProjectJson / loadProjectFiles round-trip", () => {
  it("serialises and restores editorGridSize", () => {
    useIDEStore.getState().setEditorGridSize(64);
    const json = useIDEStore.getState().saveProjectJson();

    // Load it back via loadProjectFiles with the JSON as .project.json
    useIDEStore
      .getState()
      .loadProjectFiles({ "emptysock.project.json": json }, "RoundTripProject");
    expect(useIDEStore.getState().editorGridSize).toBe(64);
  });

  it("serialises and restores windowConfig title", () => {
    useIDEStore.getState().setWindowConfig({ title: "TestGame" });
    const json = useIDEStore.getState().saveProjectJson();

    useIDEStore.getState().loadProjectFiles({ "emptysock.project.json": json });
    expect(useIDEStore.getState().windowConfig.title).toBe("TestGame");
  });

  it("serialises and restores localisationLocales", () => {
    useLocalisationStore.getState().setLocalisationLocales(["en", "es", "pt"]);
    const json = useIDEStore.getState().saveProjectJson();

    useIDEStore.getState().loadProjectFiles({ "emptysock.project.json": json });
    expect(useLocalisationStore.getState().localisationLocales).toEqual([
      "en",
      "es",
      "pt",
    ]);
  });

  it("saveProjectJson produces valid JSON", () => {
    const json = useIDEStore.getState().saveProjectJson();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("loadProjectFiles with malformed project.json logs a warning and does not throw", () => {
    useIDEStore.getState().clearLogs();
    useIDEStore
      .getState()
      .loadProjectFiles({ "emptysock.project.json": "{bad json" });
    const logs = useIDEStore.getState().logs;
    const warnLog = logs.find((l) => l.level === "warn");
    expect(warnLog).toBeDefined();
  });

  it("loadProjectFiles sets projectName from argument", () => {
    useIDEStore
      .getState()
      .loadProjectFiles({ "src/main.ts": "export {}" }, "MyLoadedGame");
    expect(useIDEStore.getState().projectName).toBe("MyLoadedGame");
  });

  it("loadProjectFiles defaults projectName to LoadedProject when argument omitted", () => {
    useIDEStore.getState().loadProjectFiles({ "src/main.ts": "export {}" });
    expect(useIDEStore.getState().projectName).toBe("LoadedProject");
  });
});

// ---------------------------------------------------------------------------
// addEntity / deleteEntity
// ---------------------------------------------------------------------------
describe("ideStore — addEntity / deleteEntity", () => {
  it("addEntity appends a top-level entity", () => {
    useIDEStore.getState().addEntity("Hero");
    const entities = useIDEStore.getState().entities;
    const hero = entities.find((e) => e.name === "Hero");
    expect(hero).toBeDefined();
    expect(hero?.components).toContain("Transform");
    expect(hero?.active).toBe(true);
  });

  it("addEntity with parentId inserts as child", () => {
    useIDEStore.getState().addEntity("Parent");
    const parentId = useIDEStore
      .getState()
      .entities.find((e) => e.name === "Parent")?.id;
    expect(parentId).toBeDefined();

    useIDEStore.getState().addEntity("Child", parentId);
    const parent = useIDEStore
      .getState()
      .entities.find((e) => e.id === parentId);
    expect(parent?.children.find((c) => c.name === "Child")).toBeDefined();
  });

  it("deleteEntity removes the entity", () => {
    useIDEStore.getState().addEntity("Doomed");
    const id = useIDEStore
      .getState()
      .entities.find((e) => e.name === "Doomed")?.id;
    expect(id).toBeDefined();

    useIDEStore.getState().deleteEntity(id as string);
    const found = useIDEStore.getState().entities.find((e) => e.id === id);
    expect(found).toBeUndefined();
  });

  it("deleteEntity clears selectedEntityId when the deleted entity was selected", () => {
    useIDEStore.getState().addEntity("TempEntity");
    const id = useIDEStore
      .getState()
      .entities.find((e) => e.name === "TempEntity")?.id as string;
    useIDEStore.setState({ selectedEntityId: id });

    useIDEStore.getState().deleteEntity(id);
    expect(useIDEStore.getState().selectedEntityId).toBeNull();
  });

  it("addComponentToEntity adds a component string", () => {
    useIDEStore.getState().addEntity("Mover");
    const id = useIDEStore.getState().entities.find((e) => e.name === "Mover")
      ?.id as string;
    useIDEStore.getState().addComponentToEntity(id, "PhysicsBody");
    const ent = useIDEStore.getState().entities.find((e) => e.id === id);
    expect(ent?.components).toContain("PhysicsBody");
  });

  it("removeComponentFromEntity removes a component string", () => {
    useIDEStore.getState().addEntity("Slim");
    const id = useIDEStore.getState().entities.find((e) => e.name === "Slim")
      ?.id as string;
    useIDEStore.getState().addComponentToEntity(id, "Sprite");
    useIDEStore.getState().removeComponentFromEntity(id, "Sprite");
    const ent = useIDEStore.getState().entities.find((e) => e.id === id);
    expect(ent?.components).not.toContain("Sprite");
  });
});

// ---------------------------------------------------------------------------
// openFiles manipulation
// ---------------------------------------------------------------------------
describe("ideStore — openFiles manipulation", () => {
  it("openFile adds path to openFiles", () => {
    useIDEStore.getState().openFile("src/foo.ts", "export const x = 1;");
    expect(useIDEStore.getState().openFiles["src/foo.ts"]).toBe(
      "export const x = 1;",
    );
  });

  it("openFile sets activeFilePath", () => {
    useIDEStore.getState().openFile("src/bar.ts", "");
    expect(useIDEStore.getState().activeFilePath).toBe("src/bar.ts");
  });

  it("closeFile removes the path from openFiles", () => {
    useIDEStore.getState().openFile("src/baz.ts", "hello");
    useIDEStore.getState().closeFile("src/baz.ts");
    expect(useIDEStore.getState().openFiles["src/baz.ts"]).toBeUndefined();
  });

  it("closeFile changes activeFilePath to another open file", () => {
    useIDEStore.getState().openFile("src/a.ts", "");
    useIDEStore.getState().openFile("src/b.ts", "");
    useIDEStore.getState().closeFile("src/b.ts");
    expect(useIDEStore.getState().activeFilePath).toBe("src/a.ts");
  });

  it("closeFile sets activeFilePath to null when no files remain", () => {
    useIDEStore.setState({ openFiles: {}, activeFilePath: null });
    useIDEStore.getState().openFile("src/only.ts", "");
    useIDEStore.getState().closeFile("src/only.ts");
    expect(useIDEStore.getState().activeFilePath).toBeNull();
  });

  it("setFileContent updates openFiles content", () => {
    useIDEStore.getState().openFile("src/c.ts", "original");
    useIDEStore.getState().setFileContent("src/c.ts", "updated");
    expect(useIDEStore.getState().openFiles["src/c.ts"]).toBe("updated");
  });

  it("openFile adds to recentFiles", () => {
    useIDEStore.setState({ recentFiles: [] });
    useIDEStore.getState().openFile("src/recent.ts", "");
    const recent = useIDEStore.getState().recentFiles;
    expect(recent.find((r) => r.path === "src/recent.ts")).toBeDefined();
  });

  it("openFile does not duplicate recent entries", () => {
    useIDEStore.setState({ recentFiles: [] });
    useIDEStore.getState().openFile("src/dup.ts", "");
    useIDEStore.getState().openFile("src/dup.ts", "");
    const count = useIDEStore
      .getState()
      .recentFiles.filter((r) => r.path === "src/dup.ts").length;
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Editor grid store actions
// ---------------------------------------------------------------------------
describe("ideStore — editor grid actions", () => {
  it("setEditorGridSize clamps to minimum 4", () => {
    useIDEStore.getState().setEditorGridSize(2);
    expect(useIDEStore.getState().editorGridSize).toBe(4);
  });

  it("setEditorGridSize accepts normal values", () => {
    useIDEStore.getState().setEditorGridSize(32);
    expect(useIDEStore.getState().editorGridSize).toBe(32);
  });

  it("setEditorSnapToGrid toggles snap off", () => {
    useIDEStore.getState().setEditorSnapToGrid(false);
    expect(useIDEStore.getState().editorSnapToGrid).toBe(false);
  });

  it("setEditorShowGrid toggles grid visibility", () => {
    useIDEStore.getState().setEditorShowGrid(false);
    expect(useIDEStore.getState().editorShowGrid).toBe(false);
  });
});
