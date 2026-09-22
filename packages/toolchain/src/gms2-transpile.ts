import fs from "fs/promises";

// ---------------------------------------------------------------------------
// GML pattern-level transpiler
// ---------------------------------------------------------------------------

/**
 * Apply regex-based pattern replacements to a GML source string and return
 * the resulting TypeScript snippet.
 *
 * Transformations are applied in order; later passes do not re-process text
 * produced by earlier ones (single-pass sequential replacement).
 */
export function transpileGML(gml: string): string {
  let out = gml;

  // -- Variable declarations -------------------------------------------------
  // global.x = expr  →  export let x = expr; // was global.x
  out = out.replace(
    /\bglobal\.(\w+)\s*=\s*([^;\n]+)/g,
    (_m, varName: string, expr: string) =>
      `export let ${varName} = ${expr.trimEnd()}; // was global.${varName}`,
  );
  // var x = expr  →  let x = expr;
  out = out.replace(/\bvar\b(\s+\w+\s*=)/g, "let$1");

  // -- Control flow ----------------------------------------------------------
  // repeat(n) { ... }  →  for (let _i = 0; _i < n; _i++) { ... }
  out = out.replace(
    /\brepeat\s*\(([^)]+)\)/g,
    (_m, n: string) => `for (let _i = 0; _i < ${n.trim()}; _i++)`,
  );
  // for loops: var → let inside for initialiser
  out = out.replace(/\bfor\s*\(\s*var\b/g, "for (let");
  // exit  →  return;
  out = out.replace(/\bexit\b/g, "return;");

  // -- GML built-ins → EmptySock / JS equivalents ---------------------------

  // instance_create_layer
  out = out.replace(
    /\binstance_create_layer\s*\([^)]*\)\s*;?/g,
    "// TODO: scene.createEntity() and add ObjX component",
  );
  // instance_destroy
  out = out.replace(
    /\binstance_destroy\s*\(\s*\)\s*;?/g,
    "// entity.destroy();",
  );

  // audio_play_sound(snd, priority, loop)
  out = out.replace(
    /\baudio_play_sound\s*\(\s*([^,)]+)\s*,\s*[^,)]+\s*,\s*([^)]+)\s*\)\s*;?/g,
    (_m, _snd: string, loop: string) =>
      `// audioSystem.play('sound_name', { loop: ${loop.trim()} });`,
  );

  // room_goto(rm_next)
  out = out.replace(
    /\broom_goto\s*\(\s*([^)]+)\s*\)\s*;?/g,
    (_m, rm: string) => `// sceneManager.load('${rm.trim()}');`,
  );

  // draw_sprite
  out = out.replace(
    /\bdraw_sprite\s*\([^)]*\)\s*;?/g,
    "// Sprite component handles drawing declaratively",
  );

  // alarm[n] = expr
  out = out.replace(
    /\balarm\s*\[\s*\d+\s*\]\s*=\s*([^;\n]+)/g,
    (_m, expr: string) =>
      `// entity.startCoroutine(waitFrames(${expr.trimEnd()}));`,
  );

  // show_message(msg)
  out = out.replace(
    /\bshow_message\s*\(\s*([^)]+)\s*\)\s*;?/g,
    (_m, msg: string) => `console.log(${msg.trim()});`,
  );

  // Math helpers — order matters: more specific first
  out = out.replace(
    /\birandom_range\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, a: string, b: string) =>
      `Math.floor(Math.random() * (${b.trim()} - ${a.trim()} + 1)) + ${a.trim()}`,
  );
  out = out.replace(
    /\birandom\s*\(\s*([^)]+)\s*\)/g,
    (_m, n: string) => `Math.floor(Math.random() * (${n.trim()} + 1))`,
  );
  out = out.replace(
    /\brandom\s*\(\s*([^)]+)\s*\)/g,
    (_m, n: string) => `Math.random() * ${n.trim()}`,
  );

  out = out.replace(
    /\blerp\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, a: string, b: string, t: string) =>
      `${a.trim()} + (${b.trim()} - ${a.trim()}) * ${t.trim()}`,
  );
  out = out.replace(
    /\bclamp\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, v: string, lo: string, hi: string) =>
      `Math.min(Math.max(${v.trim()}, ${lo.trim()}), ${hi.trim()})`,
  );
  out = out.replace(
    /\babs\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.abs(${x.trim()})`,
  );
  out = out.replace(
    /\bfloor\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.floor(${x.trim()})`,
  );
  out = out.replace(
    /\bceil\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.ceil(${x.trim()})`,
  );
  out = out.replace(
    /\bround\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.round(${x.trim()})`,
  );
  out = out.replace(
    /\bsqrt\s*\(\s*([^)]+)\s*\)/g,
    (_m, x: string) => `Math.sqrt(${x.trim()})`,
  );
  out = out.replace(
    /\bpower\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, x: string, y: string) => `Math.pow(${x.trim()}, ${y.trim()})`,
  );
  out = out.replace(
    /\blengthdir_x\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, len: string, dir: string) =>
      `${len.trim()} * Math.cos(${dir.trim()} * Math.PI / 180)`,
  );
  out = out.replace(
    /\blengthdir_y\s*\(\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, len: string, dir: string) =>
      `${len.trim()} * Math.sin(${dir.trim()} * Math.PI / 180)`,
  );
  out = out.replace(
    /\bpoint_distance\s*\(\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^,)]+)\s*,\s*([^)]+)\s*\)/g,
    (_m, x1: string, y1: string, x2: string, y2: string) =>
      `Math.hypot(${x2.trim()} - ${x1.trim()}, ${y2.trim()} - ${y1.trim()})`,
  );
  out = out.replace(
    /\bstring_length\s*\(\s*([^)]+)\s*\)/g,
    (_m, s: string) => `${s.trim()}.length`,
  );
  out = out.replace(
    /\bstring\s*\(\s*([^)]+)\s*\)/g,
    (_m, v: string) => `String(${v.trim()})`,
  );

  return out;
}

/**
 * Attempt to read and transpile a GML event file. Returns the transpiled
 * method body lines (indented), or null if the file doesn't exist.
 */
export async function readAndTranspileGML(
  gmlPath: string,
): Promise<string | null> {
  try {
    const source = await fs.readFile(gmlPath, "utf-8");
    return transpileGML(source);
  } catch {
    return null;
  }
}

/**
 * Indent each non-empty line of a multi-line string by `spaces` spaces.
 */
export function indent(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}
