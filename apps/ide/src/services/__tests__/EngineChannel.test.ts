import { describe, it, expect, vi, afterEach } from "vitest";
import { engineChannel, summaryToSnapshot } from "../EngineChannel.js";

/**
 * Covers the `es:query`/`es:query-result` request/response protocol between
 * the IDE and the preview iframe's `QueryChannel` bridge.
 */

function makeEvent(data: unknown): MessageEvent {
  return { data } as MessageEvent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EngineChannel.query — request/response over postMessage", () => {
  it("posts an es:query with a fresh id, resolves when the matching es:query-result arrives", async () => {
    const postMessage = vi.fn();
    const fakeIframe = {
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement;
    engineChannel.setIframe(fakeIframe);

    const pending = engineChannel.query({ kind: "listEntities" });

    expect(postMessage).toHaveBeenCalledTimes(1);
    const sent = postMessage.mock.calls[0]?.[0] as {
      type: string;
      id: string;
      query: unknown;
    };
    expect(sent.type).toBe("es:query");
    expect(sent.query).toEqual({ kind: "listEntities" });

    engineChannel.handleMessage(
      makeEvent({
        type: "es:query-result",
        id: sent.id,
        result: { ok: true, data: [] },
      }),
    );

    await expect(pending).resolves.toEqual({ ok: true, data: [] });
    engineChannel.setIframe(null);
  });

  it("resolves no-live-instance immediately when no iframe is attached", async () => {
    engineChannel.setIframe(null);
    const result = await engineChannel.query({ kind: "listEntities" });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "no-live-instance",
        message: expect.any(String) as string,
      },
    });
  });

  it("ignores an es:query-result whose id does not match any pending query", () => {
    const postMessage = vi.fn();
    engineChannel.setIframe({
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement);

    // Should not throw, and should not affect any real pending query.
    expect(() =>
      engineChannel.handleMessage(
        makeEvent({
          type: "es:query-result",
          id: "not-a-real-id",
          result: { ok: true, data: [] },
        }),
      ),
    ).not.toThrow();
    engineChannel.setIframe(null);
  });

  it("ignores messages with no es:query-result type", () => {
    expect(() =>
      engineChannel.handleMessage(makeEvent({ type: "other:thing" })),
    ).not.toThrow();
  });

  it("resolves every pending query as no-live-instance when the iframe changes mid-flight", async () => {
    const postMessage = vi.fn();
    engineChannel.setIframe({
      contentWindow: { postMessage },
    } as unknown as HTMLIFrameElement);

    const pending = engineChannel.query({ kind: "listEntities" });
    engineChannel.setIframe(null); // Simulates a re-render/reload swapping the iframe.

    const result = await pending;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("no-live-instance");
  });
});

describe("summaryToSnapshot", () => {
  it("fills in defaults for every optional EntitySummary field", () => {
    expect(
      summaryToSnapshot({ entityId: 7, components: ["Transform"] }),
    ).toEqual({
      id: "7",
      name: "Entity 7",
      active: true,
      components: ["Transform"],
      tags: [],
      x: 0,
      y: 0,
      rotation: 0,
    });
  });

  it("passes through real Meta/Transform-derived fields when present", () => {
    expect(
      summaryToSnapshot({
        entityId: 3,
        components: ["Transform", "Meta"],
        name: "Hero",
        tags: ["player"],
        active: false,
        x: 10,
        y: 20,
        rotation: 1.5,
      }),
    ).toEqual({
      id: "3",
      name: "Hero",
      active: false,
      components: ["Transform", "Meta"],
      tags: ["player"],
      x: 10,
      y: 20,
      rotation: 1.5,
    });
  });
});
