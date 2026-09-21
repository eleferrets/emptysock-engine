import { describe, it, expect, vi } from "vitest";
import { VNSystem } from "../VNSystem.js";
import type { DialogueTree } from "../VNSystem.js";
import { VariableStore } from "@emptysock/engine";

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
    left: {
      type: "event",
      eventName: "enterLeft",
      data: { door: "left" },
      next: "end",
    },
    right: {
      type: "dialogue",
      speaker: "Bob",
      text: "Right path!",
      next: "end",
    },
    end: { type: "dialogue", speaker: "Narrator", text: "The end." },
  },
};

describe("VNSystem", () => {
  it("loads tree and starts at startNode", () => {
    const vn = new VNSystem();
    vn.load(tree);
    const node = vn.currentNode;
    expect(node?.type).toBe("dialogue");
    if (node?.type === "dialogue") expect(node.speaker).toBe("Alice");
  });

  it("advance() moves to next dialogue node", () => {
    const vn = new VNSystem();
    vn.load(tree);
    vn.advance();
    const node = vn.currentNode;
    expect(node?.type).toBe("choice");
  });

  it("choice node has options", () => {
    const vn = new VNSystem();
    vn.load(tree);
    vn.advance(); // now at 'question' choice node
    const node = vn.currentNode;
    if (node?.type === "choice") {
      expect(node.options.length).toBe(2);
      expect(node.options[0]?.label).toBe("Go left");
    }
  });

  it("onEvent callback fires on event nodes", () => {
    const vn = new VNSystem();
    const onEvent = vi.fn();
    vn.setListener({ onEvent });
    vn.load(tree);
    vn.advance(); // → question
    vn.selectOption("left"); // → left (event node, fires immediately)
    expect(onEvent).toHaveBeenCalledWith("enterLeft", { door: "left" });
  });

  it("selectOption navigates to chosen branch", () => {
    const vn = new VNSystem();
    vn.load(tree);
    vn.advance(); // → question
    vn.selectOption("right"); // → right
    const node = vn.currentNode;
    if (node?.type === "dialogue") expect(node.speaker).toBe("Bob");
  });
});

describe("VNSystem variable-gated conditionals", () => {
  it("condition node routes to ifTrue when the switch is set", () => {
    const store = new VariableStore();
    store.setSwitch(1, true);

    const condTree: DialogueTree = {
      startNode: "gate",
      nodes: {
        gate: {
          type: "condition",
          condition: { kind: "switch", index: 1, equals: true },
          ifTrue: "unlocked",
          ifFalse: "locked",
        },
        unlocked: { type: "dialogue", speaker: "Guard", text: "Welcome in." },
        locked: { type: "dialogue", speaker: "Guard", text: "Not yet." },
      },
    };

    const vn = new VNSystem(store);
    vn.load(condTree);
    const node = vn.currentNode;
    expect(node?.type).toBe("dialogue");
    if (node?.type === "dialogue") expect(node.text).toBe("Welcome in.");
  });

  it("condition node routes to ifFalse when the switch is unset", () => {
    const store = new VariableStore(); // switch 1 defaults to false

    const condTree: DialogueTree = {
      startNode: "gate",
      nodes: {
        gate: {
          type: "condition",
          condition: { kind: "switch", index: 1, equals: true },
          ifTrue: "unlocked",
          ifFalse: "locked",
        },
        unlocked: { type: "dialogue", speaker: "Guard", text: "Welcome in." },
        locked: { type: "dialogue", speaker: "Guard", text: "Not yet." },
      },
    };

    const vn = new VNSystem(store);
    vn.load(condTree);
    const node = vn.currentNode;
    if (node?.type === "dialogue") expect(node.text).toBe("Not yet.");
  });

  it("condition node ends dialogue when false and ifFalse is omitted", () => {
    const store = new VariableStore();
    const condTree: DialogueTree = {
      startNode: "gate",
      nodes: {
        gate: {
          type: "condition",
          condition: { kind: "switch", index: 1, equals: true },
          ifTrue: "unlocked",
        },
        unlocked: { type: "dialogue", speaker: "Guard", text: "Welcome in." },
      },
    };
    const onEnd = vi.fn();
    const vn = new VNSystem(store);
    vn.setListener({ onEnd });
    vn.load(condTree);
    expect(vn.currentNode).toBeNull();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("condition node evaluates a variable comparison", () => {
    const store = new VariableStore();
    store.setVar(4, 12);

    const condTree: DialogueTree = {
      startNode: "gate",
      nodes: {
        gate: {
          type: "condition",
          condition: { kind: "variable", index: 4, op: "gte", value: 10 },
          ifTrue: "high",
          ifFalse: "low",
        },
        high: { type: "dialogue", speaker: "Narrator", text: "Strong enough." },
        low: { type: "dialogue", speaker: "Narrator", text: "Too weak." },
      },
    };

    const vn = new VNSystem(store);
    vn.load(condTree);
    const node = vn.currentNode;
    if (node?.type === "dialogue") expect(node.text).toBe("Strong enough.");
  });

  it("choice options with an unmet `when` condition are filtered out of onChoice", () => {
    const store = new VariableStore();
    store.setSwitch(2, false); // "hasKey" is false

    const choiceTree: DialogueTree = {
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

    const onChoice = vi.fn();
    const vn = new VNSystem(store);
    vn.setListener({ onChoice });
    vn.load(choiceTree);

    expect(onChoice).toHaveBeenCalledOnce();
    const options = onChoice.mock.calls[0]?.[0] as Array<{ label: string }>;
    expect(options.map((o) => o.label)).toEqual(["Walk away"]);
  });

  it("choice options with a met `when` condition are included", () => {
    const store = new VariableStore();
    store.setSwitch(2, true); // "hasKey" is true

    const choiceTree: DialogueTree = {
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

    const onChoice = vi.fn();
    const vn = new VNSystem(store);
    vn.setListener({ onChoice });
    vn.load(choiceTree);

    const options = onChoice.mock.calls[0]?.[0] as Array<{ label: string }>;
    expect(options.map((o) => o.label)).toEqual(["Unlock it", "Walk away"]);
  });
});
