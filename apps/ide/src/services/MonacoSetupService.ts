/**
 * MonacoSetupService — configures Monaco for EmptySock game development.
 *
 * Call setupMonaco(monaco) once at editor mount. It:
 *   - Wires the engine's published types into Monaco's TypeScript service
 *     so game code gets real-time squiggles (not engine-internal types).
 *   - Registers the emptysock-resource language for .esscene/.esmap/etc.
 *   - Adds hover docs for resource file property keys.
 *
 * Call registerEditorActions(editor, monaco, openFile) per-editor to wire
 * up the right-click "Open Referenced Resource" action.
 */

import type * as Monaco from "monaco-editor";

// Property key → short description, shown in hover tooltips on resource files.
const RESOURCE_KEY_DOCS: Record<string, string> = {
  type: 'Component type string — must match a registered component (e.g. `"Sprite"`, `"PhysicsBody"`).',
  name: "Entity or resource name identifier.",
  tag: "Tag string for grouping entities — query with `entity.hasTag()`.",
  texture: "Path to the sprite texture asset (`.png`, `.jpg`, `.webp`).",
  spritesheet: "Path to an `.esanim` animation spritesheet.",
  clip: "Animation clip name to play from the spritesheet.",
  layer: "Tilemap layer name.",
  bodyType: 'Physics body type: `"static"`, `"dynamic"`, or `"kinematic"`.',
  shape: 'Collider shape: `"box"`, `"circle"`, `"capsule"`, or `"polygon"`.',
  x: "Horizontal position in world space (pixels).",
  y: "Vertical position in world space (pixels).",
  z: "Depth / draw order (higher = drawn on top).",
  width: "Width in pixels.",
  height: "Height in pixels.",
  scaleX: "Horizontal scale factor (1.0 = normal, -1.0 = flipped).",
  scaleY: "Vertical scale factor.",
  rotation: "Rotation in radians.",
  alpha: "Opacity (0.0 = transparent, 1.0 = opaque).",
  visible: "Whether the entity or widget is rendered.",
  gravityScale:
    "Multiplier applied to world gravity for this body (0 = no gravity).",
  friction: "Surface friction coefficient (0.0–1.0).",
  restitution:
    "Bounciness coefficient (0.0 = no bounce, 1.0 = perfect bounce).",
  slopeAngle:
    "Maximum walkable slope angle for `CharacterController` (degrees).",
  emissionRate: "Particles emitted per second.",
  lifetimeMin: "Minimum particle lifetime in seconds.",
  lifetimeMax: "Maximum particle lifetime in seconds.",
  startSize: "Particle size at spawn.",
  endSize: "Particle size at end of life.",
  startColour: 'Particle colour at spawn (hex string, e.g. `"#ff8800"`).',
  endColour: "Particle colour at end of life.",
  blendMode: 'Particle blend mode: `"normal"`, `"add"`, `"multiply"`.',
  locale: 'BCP 47 locale code (e.g. `"en"`, `"ja"`, `"fr"`).',
  volume: "Playback volume (0.0–1.0).",
  loop: "Whether audio loops.",
  fade: "Fade-in duration in seconds.",
};

const ES_EXTENSIONS = [
  ".esscene",
  ".esmap",
  ".esanim",
  ".esprefab",
  ".esvn",
  ".esparticle",
  ".esui",
  ".esdata",
];

// Matches asset path strings that can be opened from the editor context menu.
const ASSET_PATH_RE =
  /\.(esscene|esmap|esanim|esprefab|esvn|esparticle|esui|esdata|png|jpg|jpeg|webp|ogg|wav|mp3)$/i;

let _setupDone = false;

export async function setupMonaco(monaco: typeof Monaco): Promise<void> {
  if (_setupDone) return;
  _setupDone = true;

  // --- TypeScript / JavaScript compiler options for game developers ----------
  // Strict but not overwhelming — no noUncheckedIndexedAccess etc.
  const tsOpts: Monaco.languages.typescript.CompilerOptions = {
    strict: true,
    target: monaco.languages.typescript.ScriptTarget.ES2022,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    allowJs: true,
    checkJs: false,
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    experimentalDecorators: true,
  };

  monaco.languages.typescript.typescriptDefaults.setCompilerOptions(tsOpts);
  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    ...tsOpts,
    checkJs: true,
    strict: false, // JS files get lighter checking — devs new to types deserve a break
  });

  monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
  monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);

  // --- Engine type declarations (game-developer-facing only) ----------------
  // virtual:engine-types is generated at build time from packages/engine/dist-types/
  // These are the published types, not the engine's own internal strictness.
  const { default: libs } = (await import("virtual:engine-types")) as {
    default: Record<string, string>;
  };

  for (const [uri, content] of Object.entries(libs)) {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(content, uri);
    monaco.languages.typescript.javascriptDefaults.addExtraLib(content, uri);
  }

  // --- EmptySock resource file language -------------------------------------
  if (
    !monaco.languages.getLanguages().some((l) => l.id === "emptysock-resource")
  ) {
    monaco.languages.register({
      id: "emptysock-resource",
      extensions: ES_EXTENSIONS,
      aliases: ["EmptySock Resource"],
      mimetypes: ["application/x-emptysock-resource"],
    });

    monaco.languages.setMonarchTokensProvider("emptysock-resource", {
      tokenizer: {
        root: [
          // Known property keys — highlighted as type identifiers
          [
            /"(type|name|tag|texture|spritesheet|clip|layer|bodyType|shape|anchor|x|y|z|width|height|scaleX|scaleY|rotation|visible|alpha|locale|volume|loop|fade|defaultClip|gravityScale|friction|restitution|slopeAngle|emissionRate|lifetimeMin|lifetimeMax|startSize|endSize|startColour|endColour|blendMode|shapeType|shapeWidth|shapeHeight|startSpeed|endSpeed)"(\s*:)/,
            ["type.identifier", "delimiter"],
          ],
          // Other property keys
          [/"[^"]*"(\s*:)/, ["variable", "delimiter"]],
          // String values
          [/"[^"]*"/, "string"],
          // Numbers
          [/-?\d+(\.\d+)?([eE][+-]?\d+)?/, "number"],
          // Booleans / null
          [/\b(true|false|null)\b/, "keyword"],
          // Brackets
          [/[{}[\],]/, "delimiter.bracket"],
          // Whitespace
          [/\s+/, "white"],
          // Line comments (some ES formats allow //)
          [/\/\/.*$/, "comment"],
        ],
      },
    });

    // Hover provider — explains resource property keys on mouse-over
    monaco.languages.registerHoverProvider("emptysock-resource", {
      provideHover(model, position) {
        const word = model.getWordAtPosition(position);
        if (word === null) return null;
        const doc = RESOURCE_KEY_DOCS[word.word];
        if (doc === undefined) return null;
        return {
          range: new monaco.Range(
            position.lineNumber,
            word.startColumn,
            position.lineNumber,
            word.endColumn,
          ),
          contents: [{ value: `**\`${word.word}\`** — ${doc}` }],
        };
      },
    });
  }
}

/**
 * Register per-editor actions. Call once per editor instance after mount.
 * openFile — IDE callback that opens a file path in the editor.
 */
export function registerEditorActions(
  editor: Monaco.editor.IStandaloneCodeEditor,
  monaco: typeof Monaco,
  openFile: (path: string) => void,
): void {
  editor.addAction({
    id: "emptysock.openResource",
    label: "Open Referenced Resource",
    contextMenuGroupId: "navigation",
    contextMenuOrder: 1,
    run(ed) {
      const model = ed.getModel();
      const pos = ed.getPosition();
      if (model === null || pos === null) return;

      const line = model.getLineContent(pos.lineNumber);
      const col = pos.column - 1;

      // Walk left and right from the cursor to find the enclosing string literal
      let l = col;
      let r = col;
      const QUOTES = new Set(['"', "'"]);
      while (l > 0 && !QUOTES.has(line[l - 1] ?? "")) l--;
      while (r < line.length && !QUOTES.has(line[r] ?? "")) r++;

      const token = line.slice(l, r);
      if (ASSET_PATH_RE.test(token)) {
        openFile(token);
      }
    },
  });

  // "Peek Definition" and "Go to Definition" are built into Monaco's TypeScript
  // language service — they appear automatically once engine types are injected.
  // "Find All References" likewise (Shift+F12 / right-click > Find All References).
}
