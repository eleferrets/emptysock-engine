# 13 — Tutorial: Build a Mini Visual Novel

This tutorial builds a complete mini visual novel from scratch using the EmptySock Story Graph panel and VNSystem. By the end you will have:

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

Open the **Story Graph** panel: in the IDE menu bar, choose **Module → Story Graph**, or drag its tab out of the panel bar.

The Story Graph is an SVG-based node graph editor for branching dialogue trees. The canvas supports:

| Action | Input |
|--------|-------|
| Pan | Middle-click drag, Space + drag, or two-finger trackpad swipe |
| Zoom | Scroll wheel or pinch gesture |
| Move node | Drag the node's header bar |
| Connect nodes | Drag from an output port to an input port |
| Edit node | Double-click the node body |
| Delete node | Select then press `Delete` |

---

## Step 3 — Build the story graph

You will create a short story with one branch:

**Chapter 1 → A choice → two endings**

### 3.1 Add a Dialogue node

Right-click the canvas and choose **Add Node → Dialogue**. In the edit modal:

- **Speaker:** `Narrator`
- **Text:** `You wake up in a small village. A stranger approaches.`

Click **Save**. The node appears on the canvas with one output port (the "continue" arrow).

### 3.2 Add a second Dialogue node (the stranger speaks)

Add another Dialogue node:

- **Speaker:** `Stranger`
- **Text:** `You look lost. Can I help you?`

Connect the first node's output port to this node's input port.

### 3.3 Add a Choice node

Right-click the canvas and choose **Add Node → Choice**. In the edit modal, add two options:

- Option 1: `Accept the offer`
- Option 2: `Refuse and walk away`

Connect the Stranger's output port to the Choice node's input port.

### 3.4 Add Dialogue nodes for each branch

**Branch A (accept):**

- Speaker: `Stranger`
- Text: `Wonderful! Follow me to the inn.`

Connect Choice output port **1** to this node.

**Branch B (refuse):**

- Speaker: `Narrator`
- Text: `You walk on alone into the forest.`

Connect Choice output port **2** to this node.

### 3.5 Add Condition nodes (optional advanced step)

Right-click and choose **Add Node → Condition**. Condition nodes take a variable name and a value. If the variable matches, execution follows the "true" branch; otherwise, the "false" branch. Example:

- **Variable:** `metStranger`
- **Value:** `true`

This lets the story react to flags you set in `VNScene.ts` via `VNSystem.setVariable()`.

### 3.6 Export the graph

Click **Export JSON** in the Story Graph toolbar. Save the file as `assets/story/chapter1.vnscript`. Place it under `apps/ide/public/assets/story/`.

---

## Step 4 — Prepare localisation files

Story text in the graph is keyed so you can localise it. Create `src/locales/en.json`:

```json
{
  "vn.narrator.wake":     "You wake up in a small village. A stranger approaches.",
  "vn.stranger.help":     "You look lost. Can I help you?",
  "vn.choice.accept":     "Accept the offer",
  "vn.choice.refuse":     "Refuse and walk away",
  "vn.branch.accept":     "Wonderful! Follow me to the inn.",
  "vn.branch.refuse":     "You walk on alone into the forest.",
  "vn.ui.skip":           "Skip",
  "vn.ui.next":           "Next"
}
```

Create `src/locales/fr.json`:

```json
{
  "vn.narrator.wake":     "Vous vous réveillez dans un petit village. Un inconnu s'approche.",
  "vn.stranger.help":     "Vous semblez perdu. Puis-je vous aider ?",
  "vn.choice.accept":     "Accepter l'offre",
  "vn.choice.refuse":     "Refuser et partir",
  "vn.branch.accept":     "Parfait ! Suivez-moi à l'auberge.",
  "vn.branch.refuse":     "Vous continuez seul vers la forêt.",
  "vn.ui.skip":           "Passer",
  "vn.ui.next":           "Suivant"
}
```

> **Note:** The Story Graph editor embeds raw text in the exported JSON. If you want full localisation, replace the text bodies in the exported JSON with `i18n` key references (e.g., `"text": "vn.narrator.wake"`) and resolve them in your dialogue renderer. VNSystem passes the raw text string to your display callback — call `i18n.t(text)` there if you use this convention.

---

## Step 5 — Write the VNScene

Create `src/scenes/VNScene.ts`:

```typescript
import {
  Scene,
  type SceneConfig,
  VNSystem,
  type VNNode,
  type VNChoiceNode,
  type VNDialogueNode,
  Sprite,
  UISystem,
  Audio,
  SaveSystem,
  SceneManager,
  i18n,
} from '@emptysock/engine'
import { z } from 'zod'

const SaveSchema = z.object({
  nodeId:   z.string(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
})
type VNSave = z.infer<typeof SaveSchema>

export class VNScene extends Scene {
  static readonly config: SceneConfig = { renderMode: '2d', gameSpeed: 60 }

  private _vn!: VNSystem
  private _ui!: UISystem
  private _portraitEntity!: ReturnType<Scene['createEntity']>
  private _dialoguePanel!: ReturnType<UISystem['createPanel']>
  private _speakerLabel!:  ReturnType<UISystem['createLabel']>
  private _bodyLabel!:     ReturnType<UISystem['createLabel']>
  private _choiceButtons:  ReturnType<UISystem['createButton']>[] = []

  override async onLoad(): Promise<void> {
    await i18n.load('en', () => import('../locales/en.json'))
    await i18n.load('fr', () => import('../locales/fr.json'))
    i18n.setLocale('en')   // switch to 'fr' for French

    // Background music
    await Audio.preload('chapter1_music', 'assets/music/chapter1.ogg')
    Audio.music('chapter1_music', { loop: true, fade: 1.0 })

    // Character portrait entity (positioned at left of screen)
    this._portraitEntity = this.createEntity('Portrait')
    this._portraitEntity.addComponent(Sprite, {
      texture: 'assets/portraits/narrator.png',
      anchor: { x: 0.5, y: 1.0 },
    })
    this._portraitEntity.position.x = 200
    this._portraitEntity.position.y = 480

    // UI
    this._ui = new UISystem()
    this._buildDialogueBox()
    this.setUI(this._ui)

    // Load the VN script
    this._vn = new VNSystem()
    await this._vn.loadScript('assets/story/chapter1.vnscript')

    // Resume from save if one exists
    await this._tryResumeSave()

    // Start or resume playback
    this._vn.onNode((node) => this._displayNode(node))
    this._vn.play()
  }

  override onUpdate(_dt: number): void {
    // VNSystem drives itself via the node callback — no per-frame logic needed here.
  }

  override onDestroy(): void {
    this._vn.destroy()
    this._ui.destroy()
    Audio.stopMusic({ fade: 0.8 })
  }
}
```

---

## Step 6 — Build the dialogue box UI

Add `_buildDialogueBox()` inside the class:

```typescript
private _buildDialogueBox(): void {
  // Main dialogue box at bottom of screen
  this._dialoguePanel = this._ui.createPanel({
    x: 0, y: 400,
    width: 800, height: 160,
  })

  this._speakerLabel = this._ui.createLabel({
    parent: this._dialoguePanel,
    text: '',
    color: '#ffd700',
    x: 16, y: 8,
  })

  this._bodyLabel = this._ui.createLabel({
    parent: this._dialoguePanel,
    text: '',
    color: '#fff',
    x: 16, y: 36,
    wrapWidth: 768,
  })

  // Skip button
  const skipBtn = this._ui.createButton({
    parent: this._dialoguePanel,
    text: i18n.t('vn.ui.skip'),
    x: 700, y: 8,
    width: 80, height: 30,
    onClick: () => this._vn.skip(),
  })
  void skipBtn  // reference kept to suppress lint warning
}
```

---

## Step 7 — Display nodes

Add `_displayNode()` inside the class:

```typescript
private _displayNode(node: VNNode): void {
  // Clear any existing choice buttons
  for (const btn of this._choiceButtons) {
    this._ui.setVisible(btn, false)
  }
  this._choiceButtons = []

  if (node.type === 'dialogue') {
    this._showDialogue(node as VNDialogueNode)
  } else if (node.type === 'choice') {
    this._showChoices(node as VNChoiceNode)
  }
}

private _showDialogue(node: VNDialogueNode): void {
  const text   = i18n.t(node.text)    // resolve key or return raw text
  const speaker = node.speaker

  this._speakerLabel.setText(speaker)
  this._bodyLabel.setText(text)

  // Swap portrait based on speaker name
  const sprite = this._portraitEntity.getComponent(Sprite)
  if (sprite) {
    const portraitMap: Record<string, string> = {
      Narrator: 'assets/portraits/narrator.png',
      Stranger: 'assets/portraits/stranger.png',
    }
    sprite.texture = portraitMap[speaker] ?? 'assets/portraits/narrator.png'
  }

  // Save progress at each dialogue node
  this._saveProgress(node.id)

  // Advance to the next node when the player clicks the dialogue panel
  this._dialoguePanel.onClick = () => this._vn.advance()
}

private _showChoices(node: VNChoiceNode): void {
  this._speakerLabel.setText('')
  this._bodyLabel.setText('')
  this._dialoguePanel.onClick = undefined  // choices are clicked, not the panel

  node.options.forEach((option, index) => {
    const btn = this._ui.createButton({
      text: i18n.t(option.label),
      x: 200,
      y: 140 + index * 56,
      width: 400, height: 48,
      onClick: () => this._vn.choose(index),
    })
    this._choiceButtons.push(btn)
  })
}
```

---

## Step 8 — Save and resume story progress

Add `_saveProgress()` and `_tryResumeSave()` inside the class:

```typescript
private _saveProgress(nodeId: string): void {
  const variables = this._vn.getVariables()
  SaveSystem.save('vn-progress', {
    nodeId,
    variables,
  }).catch(() => undefined)
}

private async _tryResumeSave(): Promise<void> {
  const slots = await SaveSystem.listSlots()
  if (!slots.includes('vn-progress')) return

  try {
    const raw  = await SaveSystem.load('vn-progress')
    const data = SaveSchema.parse(raw.data) as VNSave
    // Restore variables so condition nodes evaluate correctly
    for (const [key, value] of Object.entries(data.variables)) {
      this._vn.setVariable(key, value)
    }
    // Jump to the saved node
    this._vn.jumpToNode(data.nodeId)
  } catch {
    // Corrupt save — start from the beginning
  }
}
```

---

## Step 9 — Add background music transitions

When the story reaches a branch that changes the mood, swap the music track. You can attach a **Condition** node in the Story Graph that sets a variable, then check it in `_displayNode`:

```typescript
// Inside _displayNode, after resolving dialogue:
if (node.type === 'dialogue') {
  const chapterFlag = this._vn.getVariable('chapter')
  if (chapterFlag === 'inn') {
    Audio.music('inn_music', { loop: true, fade: 1.0 })
  } else if (chapterFlag === 'forest') {
    Audio.music('forest_music', { loop: true, fade: 1.0 })
  }
}
```

Trigger the variable change in the Story Graph by adding a **Condition** node between the branch Dialogue nodes and setting `chapter = inn` or `chapter = forest` as its side-effect data.

---

## Step 10 — Play it

Press **Play** (or `Ctrl+Enter`). The visual novel starts in the Canvas Preview panel.

- Click the dialogue panel (or press `Space`) to advance text.
- When a Choice node appears, click a button to pick an option.
- The story branches according to your choice.
- Refresh the page — your progress is saved and the story resumes from the last Dialogue node.

To test the French localisation, change `i18n.setLocale('en')` to `i18n.setLocale('fr')` in `onLoad`.

---

## Step 11 — Export

**Web:**

```bash
pnpm emptysock-toolchain export --platform web --entry src/scenes/VNScene.ts --out dist/visual-novel
```

**Desktop (macOS):**

```bash
pnpm emptysock-toolchain export --platform macos --format dmg --entry src/scenes/VNScene.ts --out dist/visual-novel
```

---

## What you practised

| Concept | Where |
|---------|-------|
| Story Graph panel — Dialogue, Choice, Condition nodes | Steps 2–3 |
| Exporting the graph to a `.vnscript` JSON | Step 3.6 |
| `VNSystem.loadScript()`, `.play()`, `.advance()`, `.choose()` | `VNScene.ts` |
| `VNSystem.setVariable()` / `getVariable()` for Condition nodes | Step 8 |
| Character portraits via `Sprite` component | `_showDialogue` |
| Background music transitions with `Audio.music()` | Steps 5, 9 |
| SaveSystem — progress save/resume with Zod validation | Steps 8 |
| Localisation with `i18n` | Steps 4, 7 |
| UISystem — dialogue box, labels, buttons | Steps 6–7 |
| Export pipeline | Step 11 |

From here you can extend the novel: add a typewriter text effect (Coroutine + string splice), add animated character expressions (Animator on the portrait entity), or wire in an ambient sound layer per chapter using `Audio.setGroupVolume()`.
