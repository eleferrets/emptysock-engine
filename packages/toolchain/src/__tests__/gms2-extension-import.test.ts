import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { convertGms2Extension } from "../gms2-extension-import.js";

// ---------------------------------------------------------------------------
// Fully synthetic fixture, hand-authored to match the real on-disk GMS2
// Extension format confirmed via GitHub code search for this pass (e.g.
// Ttanasart-pt/Pixel-Composer's `extensions/patreon_key/patreon_key.yy`,
// `extensions/YYFirebaseFirestore/YYFirebaseFirestore.yy`) — never real
// project content.
// ---------------------------------------------------------------------------

const EXT_YY = `{
  "resourceType":"GMExtension",
  "resourceVersion":"1.2",
  "extensionVersion":"1.0.0",
  "files":[
    {"resourceType":"GMExtensionFile","filename":"myext.gml","kind":2,"functions":[
      {"resourceType":"GMExtensionFunction","name":"myext_add","externalName":"myext_add","kind":2,"argCount":2,"args":[],},
      {"resourceType":"GMExtensionFunction","name":"myext_missing","externalName":"myext_missing","kind":2,"argCount":0,"args":[],},
    ],},
    {"resourceType":"GMExtensionFile","filename":"myext.js","kind":3,"functions":[
      {"resourceType":"GMExtensionFunction","name":"myext_greet","externalName":"myextGreetImpl","kind":5,"argCount":1,"args":[],},
    ],},
    {"resourceType":"GMExtensionFile","filename":"myext.dll","kind":1,"functions":[
      {"resourceType":"GMExtensionFunction","name":"myext_native_call","externalName":"nativeCall","kind":1,"argCount":0,"args":[],},
      {"resourceType":"GMExtensionFunction","name":"myext_native_other","externalName":"nativeOther","kind":1,"argCount":0,"args":[],},
    ],},
  ],
}`;

describe("convertGms2Extension", () => {
  let projectRoot: string;

  beforeAll(async () => {
    projectRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), "gms2-extension-fixture-"),
    );
    const dir = path.join(projectRoot, "extensions", "myext");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "myext.yy"), EXT_YY, "utf-8");
    await fs.writeFile(
      path.join(dir, "myext.gml"),
      "function myext_add(a, b) {\n  return a + b;\n}\n",
      "utf-8",
    );
    await fs.writeFile(
      path.join(dir, "myext.js"),
      "function myextGreetImpl(name) {\n  return 'hello ' + name;\n}\n",
      "utf-8",
    );
    // myext.dll intentionally not written to disk — native binaries are
    // never read, only declared functions are reported.
  });

  afterAll(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  it("transpiles GML-backed functions through the real transpile pipeline", async () => {
    const converted = await convertGms2Extension("myext", projectRoot);
    const gmlModule = converted.modules.find((m) => m.fileName === "myext.ts");
    expect(gmlModule).toBeDefined();
    expect(gmlModule?.content).toContain("export function myext_add(");
    expect(gmlModule?.content).toContain("return a + b;");
  });

  it("emits a TODO stub for a declared function whose body can't be located", async () => {
    const converted = await convertGms2Extension("myext", projectRoot);
    const gmlModule = converted.modules.find((m) => m.fileName === "myext.ts");
    expect(gmlModule?.content).toContain("export function myext_missing(");
    expect(gmlModule?.content).toContain(
      "could not locate this function's body",
    );
  });

  it("passes JS-backed source through with minimal adaptation and a real export alias", async () => {
    const converted = await convertGms2Extension("myext", projectRoot);
    const jsModule = converted.modules.find(
      (m) => m.fileName === "myext.ts" && m.content.includes("myextGreetImpl"),
    );
    expect(jsModule).toBeDefined();
    expect(jsModule?.content).toContain("function myextGreetImpl(name)");
    expect(jsModule?.content).toContain(
      "export const myext_greet = myextGreetImpl;",
    );
  });

  it("reports every native-library-backed function BY NAME instead of a generic skip note", async () => {
    const converted = await convertGms2Extension("myext", projectRoot);
    const names = converted.nativeFunctions.map((fn) => fn.name);
    expect(names).toEqual(
      expect.arrayContaining(["myext_native_call", "myext_native_other"]),
    );
    expect(converted.nativeFunctions).toHaveLength(2);
    // No module was (or could be) generated for the native file.
    expect(
      converted.modules.some((m) => m.fileName.includes("myext.dll")),
    ).toBe(false);
  });
});
