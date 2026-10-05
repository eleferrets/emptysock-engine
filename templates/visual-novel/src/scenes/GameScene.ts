import { defineScene } from "@emptysock/engine";
import type { InputManager } from "@emptysock/engine";

// The engine ships no dialogue runner, so this template keeps a tiny one
// inline: a node graph plus a cursor. Swap it for your own system, or drive
// the story with VisualScriptState / the VariableStore on `ctx.variables`.
interface DialogueNode {
  readonly speaker: string;
  readonly text: string;
  /** Next node id; omit to end the story. */
  readonly next?: string;
  /** If present the player picks one instead of following `next`. */
  readonly options?: readonly { label: string; next: string }[];
}

const START_NODE = "intro";

const DIALOGUE: Readonly<Record<string, DialogueNode>> = {
  intro: {
    speaker: "Narrator",
    text: "You stand at a crossroads in a mysterious forest.",
    next: "ask",
  },
  ask: {
    speaker: "Narrator",
    text: "Which path do you take?",
    options: [
      { label: "The dark path", next: "dark" },
      { label: "The bright path", next: "bright" },
    ],
  },
  dark: {
    speaker: "Narrator",
    text: "You venture into the shadows...",
    next: "end",
  },
  bright: {
    speaker: "Narrator",
    text: "Sunlight guides your way.",
    next: "end",
  },
  end: { speaker: "Narrator", text: "The adventure continues..." },
};

function show(node: DialogueNode): void {
  console.log(`[${node.speaker}]: ${node.text}`);
  if (node.options !== undefined) {
    console.log(
      node.options.map((o, i) => `${String(i + 1)}) ${o.label}`).join("  "),
    );
  }
}

export function createGameScene() {
  let current: DialogueNode | undefined;
  let choice: number | undefined;
  let input: InputManager | undefined;

  const goTo = (id: string | undefined): void => {
    current = id === undefined ? undefined : DIALOGUE[id];
    if (current !== undefined) show(current);
  };

  return defineScene({
    onLoad(_scene, ctx) {
      ctx.input.setActions({
        advance: [
          { kind: "key", code: "Space" },
          { kind: "key", code: "Enter" },
        ],
        choose1: [{ kind: "key", code: "Digit1" }],
        choose2: [{ kind: "key", code: "Digit2" }],
      });
      ctx.localisation.addTranslations("en", {
        "ui.advance": "Press SPACE to continue",
        "ui.choose": "Press 1 or 2 to choose",
      });
      ctx.localisation.setLocale("en");
      console.log(ctx.localisation.t("ui.advance"));
      goTo(START_NODE);
      input = ctx.input;
    },
    onUpdate() {
      if (current === undefined || input === undefined) return;
      if (current.options !== undefined) {
        if (input.wasPressed("choose1")) choice = 0;
        else if (input.wasPressed("choose2")) choice = 1;
        const picked =
          choice === undefined ? undefined : current.options[choice];
        choice = undefined;
        if (picked !== undefined) goTo(picked.next);
      } else if (input.wasPressed("advance")) {
        goTo(current.next);
      }
    },
  });
}
