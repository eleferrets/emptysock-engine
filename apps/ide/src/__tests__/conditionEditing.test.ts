import { describe, it, expect } from "vitest";
import {
  defaultCondition,
  describeCondition,
  setNodeCondition,
  toggleOptionWhen,
  updateOptionWhen,
  removeOption,
} from "../components/panels/vn-editor/conditionEditing";
import type { VNNode } from "../components/panels/vn-editor/persistence";

describe("conditionEditing", () => {
  it("defaultCondition returns a switch check", () => {
    expect(defaultCondition()).toEqual({
      kind: "switch",
      index: 1,
      equals: true,
    });
  });

  it("describeCondition formats a switch condition", () => {
    expect(describeCondition({ kind: "switch", index: 3, equals: false })).toBe(
      "switch[3] == false",
    );
  });

  it("describeCondition formats a variable condition", () => {
    expect(
      describeCondition({ kind: "variable", index: 4, op: "gte", value: 10 }),
    ).toBe("var[4] >= 10");
  });

  it("setNodeCondition sets condition and derives the label text", () => {
    const node: VNNode = {
      id: "n1",
      type: "condition",
      x: 0,
      y: 0,
      text: "old label",
    };
    const next = setNodeCondition(node, {
      kind: "switch",
      index: 2,
      equals: true,
    });
    expect(next.condition).toEqual({ kind: "switch", index: 2, equals: true });
    expect(next.text).toBe("switch[2] == true");
    // Original node is untouched (pure function).
    expect(node.condition).toBeUndefined();
  });

  it("toggleOptionWhen enables a when gate, growing optionWhens to match options", () => {
    const node: VNNode = {
      id: "n1",
      type: "choice",
      x: 0,
      y: 0,
      text: "Choose",
      options: ["A", "B"],
    };
    const next = toggleOptionWhen(node, 1, true);
    expect(next.optionWhens).toHaveLength(2);
    expect(next.optionWhens?.[0]).toBeUndefined();
    expect(next.optionWhens?.[1]).toEqual({
      kind: "switch",
      index: 1,
      equals: true,
    });
  });

  it("toggleOptionWhen disables an existing when gate", () => {
    const node: VNNode = {
      id: "n1",
      type: "choice",
      x: 0,
      y: 0,
      text: "Choose",
      options: ["A", "B"],
      optionWhens: [{ kind: "switch", index: 5, equals: true }, undefined],
    };
    const next = toggleOptionWhen(node, 0, false);
    expect(next.optionWhens?.[0]).toBeUndefined();
  });

  it("updateOptionWhen replaces the condition at the given index", () => {
    const node: VNNode = {
      id: "n1",
      type: "choice",
      x: 0,
      y: 0,
      text: "Choose",
      options: ["A"],
      optionWhens: [{ kind: "switch", index: 1, equals: true }],
    };
    const next = updateOptionWhen(node, 0, {
      kind: "variable",
      index: 9,
      op: "lt",
      value: 3,
    });
    expect(next.optionWhens?.[0]).toEqual({
      kind: "variable",
      index: 9,
      op: "lt",
      value: 3,
    });
  });

  it("removeOption drops the option and keeps optionWhens aligned", () => {
    const node: VNNode = {
      id: "n1",
      type: "choice",
      x: 0,
      y: 0,
      text: "Choose",
      options: ["A", "B", "C"],
      optionWhens: [
        undefined,
        { kind: "switch", index: 1, equals: true },
        undefined,
      ],
    };
    const next = removeOption(node, 1);
    expect(next.options).toEqual(["A", "C"]);
    expect(next.optionWhens).toEqual([undefined, undefined]);
  });

  it("removeOption is a no-op for a node with no options", () => {
    const node: VNNode = { id: "n1", type: "dialogue", x: 0, y: 0, text: "Hi" };
    expect(removeOption(node, 0)).toBe(node);
  });
});
