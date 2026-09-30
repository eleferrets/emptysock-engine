import { describe, it, expect, beforeEach } from "vitest";
import { LocalisationSystem } from "../systems/LocalisationSystem.js";

describe("LocalisationSystem", () => {
  let loc: LocalisationSystem;

  beforeEach(() => {
    loc = new LocalisationSystem();
    loc.addTranslations("en", {
      hello: "Hello",
      greeting: "Hello, {{name}}!",
      score: "Score: {{points}} points",
    });
    loc.addTranslations("es", {
      hello: "Hola",
      greeting: "Hola, {{name}}!",
    });
  });

  it("setLocale changes the locale", () => {
    loc.setLocale("es");
    expect(loc.currentLocale).toBe("es");
  });

  it("t returns translation for current locale", () => {
    loc.setLocale("en");
    expect(loc.t("hello")).toBe("Hello");
  });

  it("t substitutes {{vars}} in template", () => {
    loc.setLocale("en");
    expect(loc.t("greeting", { name: "World" })).toBe("Hello, World!");
  });

  it("t substitutes multiple vars", () => {
    loc.setLocale("en");
    expect(loc.t("score", { points: 42 })).toBe("Score: 42 points");
  });

  it("t returns key as fallback for missing translation", () => {
    loc.setLocale("en");
    expect(loc.t("missing_key")).toBe("missing_key");
  });

  it("locale switch picks different translation", () => {
    loc.setLocale("es");
    expect(loc.t("hello")).toBe("Hola");
  });
});
