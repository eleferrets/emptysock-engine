import { describe, it, expect, vi, afterEach } from "vitest";
import { engineChannel } from "../EngineChannel.js";

/**
 * Covers the postMessage boundary validation between the IDE and the
 * preview iframe: a well-formed `es:entities` payload is accepted and
 * dispatched to handlers, while a malformed one (wrong field type, missing
 * field, or not an array at all) is dropped with a console warning and
 * never reaches handlers — it must not corrupt IDE state.
 */

function makeEvent(data: unknown): MessageEvent {
  return { data } as MessageEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EngineChannel — es:entities validation", () => {
  it("accepts and dispatches a well-formed es:entities payload", () => {
    const handler = vi.fn();
    const unsubscribe = engineChannel.onEntities(handler);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const snapshot = {
      id: "e1",
      name: "Player",
      active: true,
      components: ["Transform", "Sprite"],
      tags: ["player"],
      x: 10,
      y: 20,
      rotation: 0,
    };

    engineChannel.handleMessage(
      makeEvent({ type: "es:entities", payload: [snapshot] }),
    );

    expect(handler).toHaveBeenCalledWith([snapshot]);
    expect(warnSpy).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("drops an es:entities payload with a wrong-typed field and warns", () => {
    const handler = vi.fn();
    const unsubscribe = engineChannel.onEntities(handler);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const badSnapshot = {
      id: "e1",
      name: "Player",
      active: true,
      components: ["Transform"],
      tags: [],
      x: "not-a-number", // wrong type
      y: 20,
      rotation: 0,
    };

    engineChannel.handleMessage(
      makeEvent({ type: "es:entities", payload: [badSnapshot] }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("drops an es:entities payload with a missing field and warns", () => {
    const handler = vi.fn();
    const unsubscribe = engineChannel.onEntities(handler);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const badSnapshot = {
      id: "e1",
      name: "Player",
      active: true,
      components: ["Transform"],
      tags: [],
      // x missing entirely
      y: 20,
      rotation: 0,
    };

    engineChannel.handleMessage(
      makeEvent({ type: "es:entities", payload: [badSnapshot] }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("drops an es:entities payload whose top-level payload is not an array", () => {
    const handler = vi.fn();
    const unsubscribe = engineChannel.onEntities(handler);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    engineChannel.handleMessage(
      makeEvent({ type: "es:entities", payload: { not: "an array" } }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("ignores messages with no es: prefix", () => {
    const handler = vi.fn();
    const unsubscribe = engineChannel.onEntities(handler);
    engineChannel.handleMessage(
      makeEvent({ type: "other:thing", payload: [] }),
    );
    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe("EngineChannel — es:component-fields validation", () => {
  it("accepts a well-formed es:component-fields message", () => {
    const handler = vi.fn();
    const unsubscribe = engineChannel.onComponentFields(handler);

    engineChannel.handleMessage(
      makeEvent({
        type: "es:component-fields",
        entityId: "e1",
        component: "Sprite",
        fields: { visible: true },
      }),
    );

    expect(handler).toHaveBeenCalledWith("e1", "Sprite", { visible: true });
    unsubscribe();
  });

  it("drops es:component-fields with a non-object fields value and warns", () => {
    const handler = vi.fn();
    const unsubscribe = engineChannel.onComponentFields(handler);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    engineChannel.handleMessage(
      makeEvent({
        type: "es:component-fields",
        entityId: "e1",
        component: "Sprite",
        fields: "not-an-object",
      }),
    );

    expect(handler).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});

describe("EngineChannel — postToEngine is the only outbound method", () => {
  it("posts a message to the attached iframe's contentWindow", () => {
    const postMessage = vi.fn();
    const fakeIframe = {
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement;

    engineChannel.setIframe(fakeIframe);
    engineChannel.postToEngine({ type: "es:select-entity", id: "e1" });

    expect(postMessage).toHaveBeenCalledWith(
      { type: "es:select-entity", id: "e1" },
      "*",
    );
    engineChannel.setIframe(null);
  });

  it("has no sendToEngine method (removed dead duplicate)", () => {
    expect(
      (engineChannel as unknown as Record<string, unknown>)["sendToEngine"],
    ).toBeUndefined();
  });
});
