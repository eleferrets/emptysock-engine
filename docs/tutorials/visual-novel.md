# Tutorial: Build a Mini Visual Novel

This tutorial builds a complete mini visual novel using the EmptySock Story Graph panel and VNSystem. By the end you will have:

- A multi-branch dialogue tree authored in the Story Graph panel
- Character portrait sprites that change per scene
- Background music that transitions between chapters
- Story progress saved and loaded with SaveSystem
- Localised dialogue strings using LocalisationSystem

Estimated time: 45–75 minutes.

---

## Step 1 — Open the IDE and create the project files

1. Start the IDE (`pnpm dev` from `apps/ide/`, or open the desktop app).
2. In the **Files** panel, create:
   - `src/scenes/VNScene.ts`
   - `src/locales/en.json`
   - `src/locales/fr.json`

---

## Step 2 — Open the Story Graph panel

Open the **Story Graph** panel: in the IDE menu bar choose **Module → Story Graph**, or drag its tab out of the panel bar.

| Action        | Input                                                |
| ------------- | ---------------------------------------------------- |
| Pan           | Middle-click drag, Space + drag, or two-finger swipe |
| Zoom          | Scroll wheel or pinch                                |
| Move node     | Drag the node's header bar                           |
| Connect nodes | Drag from an output port to an input port            |
| Edit node     | Double-click the node body                           |
| Delete node   | Select then press `Delete`                           |

---

## Step 3 — Build the story graph

You will create a short story with one branch: **Chapter 1 → A choice → two endings**.

### 3.1 Add a Dialogue node

Right-click the canvas and choose **Add Node → Dialogue**. In the edit modal:

- **Speaker:** `Narrator`
- **Text:** `You wake up in a small village. A stranger approaches.`

Click **Save**.

### 3.2 Add a second Dialogue node

Add another Dialogue node:

- **Speaker:** `Stranger`
- **Text:** `You look lost. Can I help you?`

Connect the first node's output port to this node's input port.

### 3.3 Add a Choice node

Right-click and choose **Add Node → Choice**. Add two options:

- Option 1: `Accept the offer`
- Option 2: `Refuse and walk away`

Connect the Stranger node's output to the Choice node's input.

### 3.4 Add branch Dialogue nodes

**Branch A (accept):** Speaker `Stranger`, text `Wonderful! Follow me to the inn.`

Connect Choice output port **1** to this node.

**Branch B (refuse):** Speaker `Narrator`, text `You walk on alone into the forest.`

Connect Choice output port **2** to this node.

### 3.5 Export the graph

Click **Export JSON** in the Story Graph toolbar. Save as `assets/story/chapter1.storyGraph.json`. Place it under `apps/ide/public/assets/story/`.

---

## Step 4 — Prepare localisation files

Create `src/locales/en.json`:

```json
{
  "vn.narrator.wake": "You wake up in a small village. A stranger approaches.",
  "vn.stranger.help": "You look lost. Can I help you?",
  "vn.choice.accept": "Accept the offer",
  "vn.choice.refuse": "Refuse and walk away",
  "vn.branch.accept": "Wonderful! Follow me to the inn.",
  "vn.branch.refuse": "You walk on alone into the forest.",
  "vn.ui.skip": "Skip",
  "vn.ui.next": "Next"
}
```

Create `src/locales/fr.json`:

```json
{
  "vn.narrator.wake": "Vous vous réveillez dans un petit village. Un inconnu s'approche.",
  "vn.stranger.help": "Vous semblez perdu. Puis-je vous aider ?",
  "vn.choice.accept": "Accepter l'offre",
  "vn.choice.refuse": "Refuser et partir",
  "vn.branch.accept": "Parfait ! Suivez-moi à l'auberge.",
  "vn.branch.refuse": "Vous continuez seul vers la forêt.",
  "vn.ui.skip": "Passer",
  "vn.ui.next": "Suivant"
}
```

> If you want full localisation, the Story Graph exports raw text. Replace text bodies in the exported JSON with `i18n` key references (e.g. `"text": "vn.narrator.wake"`) and resolve them in your renderer by calling `loc.t(node.text)`.

---

## Step 5 — Write VNScene

Create `src/scenes/VNScene.ts`:

```typescript
import {
  Scene,
  type SceneConfig,
  VNSystem,
  storyGraphToDialogueTree,
  type DialogueNode,
  type StoryGraph,
  Sprite,
  Audio,
  SaveSystem,
  LocalisationSystem,
} from "@emptysock/engine";
import { z } from "zod";

const SaveSchema = z.object({ nodeId: z.string() });
type VNSave = z.infer<typeof SaveSchema>;

export class VNScene extends Scene {
  static readonly config: SceneConfig = { renderMode: "2d", gameSpeed: 60 };

  private _vn!: VNSystem;
  private _loc!: LocalisationSystem;
  private _portraitEntity!: ReturnType<Scene["createEntity"]>;
  private _savedNodeId: string | null = null;

  override async onLoad(): Promise<void> {
    // Localisation
    this._loc = new LocalisationSystem();
    const schema = z.record(z.string());
    const en = schema.parse(await (await fetch("assets/i18n/en.json")).json());
    const fr = schema.parse(await (await fetch("assets/i18n/fr.json")).json());
    this._loc.addTranslations("en", en);
    this._loc.addTranslations("fr", fr);
    this._loc.setLocale("en");

    // Background music
    await Audio.preload("chapter1_music", "assets/music/chapter1.ogg");
    Audio.music("chapter1_music", { loop: true, fade: 1.0 });

    // Character portrait
    this._portraitEntity = this.createEntity("Portrait");
    this._portraitEntity.addComponent(Sprite, {
      texture: "assets/portraits/narrator.png",
      anchor: { x: 0.5, y: 1.0 },
    });
    this._portraitEntity.position.x = 200;
    this._portraitEntity.position.y = 480;

    // Load save
    await this._tryResumeSave();

    // Load the script
    const response = await fetch("assets/story/chapter1.storyGraph.json");
    const graph = (await response.json()) as StoryGraph;
    const tree = storyGraphToDialogueTree(graph);

    this._vn = new VNSystem();

    this._vn.onNode = (node: DialogueNode) => {
      this._displayNode(node);
    };

    this._vn.onChoice = (options) => {
      this._showChoices(options);
    };

    this._vn.onEnd = () => {
      // hide dialogue box
    };

    this._vn.load(tree);
  }

  override onUpdate(_dt: number): void {
    // VNSystem is event-driven; no per-frame polling needed.
  }

  override onDestroy(): void {
    Audio.stopMusic({ fade: 0.8 });
  }

  private _displayNode(node: DialogueNode): void {
    if (node.type === "dialogue") {
      const text = this._loc.t(node.text);
      console.log(`[${node.speaker}] ${text}`);

      // Swap portrait
      const sprite = this._portraitEntity.getComponent(Sprite);
      if (sprite !== undefined) {
        const portraits: Record<string, string> = {
          Narrator: "assets/portraits/narrator.png",
          Stranger: "assets/portraits/stranger.png",
        };
        // Sprite texture update would go here
        void portraits[node.speaker];
      }

      // Save progress
      this._saveProgress(node.id ?? "");
    }
  }

  private _showChoices(options: { label: string; next: string }[]): void {
    // Render choice buttons via UISystem; for brevity, auto-pick option 0:
    this._vn.selectOption(options[0].next);
  }

  private _saveProgress(nodeId: string): void {
    SaveSystem.save("vn-progress", { nodeId }).catch(() => undefined);
  }

  private async _tryResumeSave(): Promise<void> {
    const slots = await SaveSystem.listSlots();
    if (!slots.includes("vn-progress")) return;
    try {
      const raw = await SaveSystem.load("vn-progress");
      const data = SaveSchema.parse(raw.data) as VNSave;
      this._savedNodeId = data.nodeId;
    } catch {
      // corrupt save — start from beginning
    }
  }
}
```

---

## Step 6 — Add choice buttons

In `_showChoices`, replace the auto-pick stub with real UISystem buttons:

```typescript
private _showChoices(options: { label: string; next: string }[]): void {
  options.forEach((opt, i) => {
    const btn = createChoiceButton(
      this._loc.t(opt.label),
      () => {
        removeChoiceButtons();
        this._vn.selectOption(opt.next);
      },
      i,
    );
    // add btn to UISystem...
    void btn;
  });
}
```

---

## Step 7 — Play it

Press **Play** (or `Ctrl+Enter`). The dialogue tree starts in the Canvas Preview panel.

- Click the dialogue area to advance text.
- When a Choice node appears, click a button to pick an option.
- Reload the page — the story resumes from the last saved node.

To test French localisation, change `this._loc.setLocale('en')` to `'fr'` in `onLoad`.

---

## Step 8 — Export

**Web:**

```bash
pnpm emptysock-toolchain export --platform web \
  --entry src/scenes/VNScene.ts --out dist/visual-novel
```

**macOS:**

```bash
pnpm emptysock-toolchain export --platform macos --format dmg \
  --entry src/scenes/VNScene.ts --out dist/visual-novel
```

---

## What you practised

| Concept                                                                | Where                 |
| ---------------------------------------------------------------------- | --------------------- |
| Story Graph panel — Dialogue, Choice nodes                             | Steps 2–3             |
| Exporting to `.storyGraph.json`                                        | Step 3.5              |
| `storyGraphToDialogueTree`, `VNSystem.load`, `advance`, `selectOption` | `VNScene.ts`          |
| Character portraits via `Sprite`                                       | `_displayNode`        |
| Background music transitions with `Audio.music()`                      | `onLoad`, `onDestroy` |
| SaveSystem — progress save/resume with Zod validation                  | Steps 5, 6            |
| LocalisationSystem                                                     | Steps 4, 5            |
| Export pipeline                                                        | Step 8                |

From here you can extend: add a typewriter text effect with a Coroutine, add animated character expressions with Animator, or add an ambient sound layer per chapter using `Audio.setGroupVolume()`.
