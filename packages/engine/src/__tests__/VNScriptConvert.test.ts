import { describe, it, expect } from "vitest";
import {
  storyGraphToDialogueTree,
  dialogueTreeToStoryGraph,
} from "../systems/VNScriptConvert.js";
import type { DialogueTree } from "../systems/VNSystem.js";

describe("VNScriptConvert", () => {
  it("round-trips dialogue, choice, and jump nodes losslessly", () => {
    const tree: DialogueTree = {
      startNode: "start",
      nodes: {
        start: {
          type: "dialogue",
          speaker: "Alice",
          text: "Hello!",
          next: "question",
        },
        question: {
          type: "choice",
          text: "What next?",
          options: [
            { label: "Go left", next: "left" },
            { label: "Go right", next: "right" },
          ],
        },
        left: { type: "dialogue", speaker: "Bob", text: "Left path." },
        right: { type: "dialogue", speaker: "Bob", text: "Right path." },
      },
    };

    const roundTripped = storyGraphToDialogueTree(
      dialogueTreeToStoryGraph(tree),
    );
    expect(roundTripped).toEqual(tree);
  });

  it("round-trips a condition node (with and without ifFalse) losslessly", () => {
    const tree: DialogueTree = {
      startNode: "gate",
      nodes: {
        gate: {
          type: "condition",
          condition: { kind: "switch", index: 1, equals: true },
          ifTrue: "unlocked",
          ifFalse: "locked",
        },
        unlocked: {
          type: "condition",
          condition: { kind: "variable", index: 4, op: "gte", value: 10 },
          ifTrue: "strong",
          // no ifFalse — a dangling/ending branch
        },
        locked: { type: "dialogue", speaker: "Guard", text: "Not yet." },
        strong: { type: "dialogue", speaker: "Guard", text: "Welcome in." },
      },
    };

    const graph = dialogueTreeToStoryGraph(tree);
    const roundTripped = storyGraphToDialogueTree(graph);
    expect(roundTripped).toEqual(tree);
  });

  it("round-trips a when-gated choice option losslessly", () => {
    const tree: DialogueTree = {
      startNode: "door",
      nodes: {
        door: {
          type: "choice",
          text: "The door is locked.",
          options: [
            {
              label: "Unlock it",
              next: "open",
              when: { kind: "switch", index: 2, equals: true },
            },
            { label: "Walk away", next: "leave" },
          ],
        },
        open: {
          type: "dialogue",
          speaker: "Narrator",
          text: "It creaks open.",
        },
        leave: { type: "dialogue", speaker: "Narrator", text: "You leave." },
      },
    };

    const graph = dialogueTreeToStoryGraph(tree);
    // Sanity check the intermediate Story Graph actually carries the `when`
    // data rather than silently dropping it before we even convert back.
    const doorNode = graph.nodes.find((n) => n.id === "door");
    expect(doorNode?.optionWhens?.[0]).toEqual({
      kind: "switch",
      index: 2,
      equals: true,
    });
    expect(doorNode?.optionWhens?.[1]).toBeUndefined();

    const roundTripped = storyGraphToDialogueTree(graph);
    expect(roundTripped).toEqual(tree);
  });

  it("round-trips a variable-comparison condition combined with a when-gated choice", () => {
    const tree: DialogueTree = {
      startNode: "gate",
      nodes: {
        gate: {
          type: "condition",
          condition: { kind: "variable", index: 7, op: "lt", value: 3 },
          ifTrue: "offer",
        },
        offer: {
          type: "choice",
          text: "Want a hint?",
          options: [
            {
              label: "Yes",
              next: "hint",
              when: { kind: "variable", index: 8, op: "neq", value: 0 },
            },
            { label: "No", next: "end" },
          ],
        },
        hint: {
          type: "dialogue",
          speaker: "Narrator",
          text: "Try the left door.",
        },
        end: { type: "dialogue", speaker: "Narrator", text: "Suit yourself." },
      },
    };

    const roundTripped = storyGraphToDialogueTree(
      dialogueTreeToStoryGraph(tree),
    );
    expect(roundTripped).toEqual(tree);
  });

  it("does not emit a condition node when it has no wired 'true' branch", () => {
    // A condition node with a condition configured but no outgoing edge for
    // the true branch is malformed authoring state — storyGraphToDialogueTree
    // must not emit a dangling/invalid DialogueNode for it.
    const graph = {
      nodes: [
        {
          id: "gate",
          type: "condition" as const,
          x: 0,
          y: 0,
          text: "switch[1] == true",
          condition: { kind: "switch" as const, index: 1, equals: true },
        },
      ],
      edges: [],
      startNodeId: "gate",
    };

    const tree = storyGraphToDialogueTree(graph);
    expect(tree.nodes["gate"]).toBeUndefined();
  });
});
