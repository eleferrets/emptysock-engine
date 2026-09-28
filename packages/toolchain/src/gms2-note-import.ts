import { promises as fs } from "node:fs";
import path from "node:path";

export interface NoteAsset {
  name: string;
  /** The note's raw text content, verbatim. */
  content: string;
}

/**
 * A GMS2 "note" resource (`resourceType: "GMNote"` in its `.yy`) is IDE-only
 * documentation — a plain `.txt` file with the author's note text sitting
 * alongside the `.yy`. GameMaker's own auto-generated compatibility reports
 * also show up as notes. There is no engine-side "note" concept in
 * `@emptysock/engine` and there shouldn't be one — fabricating a fake
 * in-engine asset just to call this "converted" the same way a sprite or
 * sound is would be dishonest. The correct, complete action is simpler:
 * copy the real text content somewhere a developer can actually read it,
 * rather than silently dropping it or telling the developer to "recreate it
 * manually" when there's nothing to recreate — it's already just text.
 *
 * Throws a descriptive Error if the directory or `.txt` file cannot be read.
 */
export async function convertGms2Note(noteDir: string): Promise<NoteAsset> {
  let entries: string[];
  try {
    entries = await fs.readdir(noteDir);
  } catch (err) {
    throw new Error(
      `convertGms2Note: cannot read directory "${noteDir}": ${String(err)}`,
    );
  }

  const txtFile = entries.find((e) => e.endsWith(".txt"));
  if (txtFile === undefined) {
    throw new Error(`convertGms2Note: no .txt file found in "${noteDir}"`);
  }

  const txtPath = path.join(noteDir, txtFile);
  let content: string;
  try {
    content = await fs.readFile(txtPath, "utf-8");
  } catch (err) {
    throw new Error(
      `convertGms2Note: cannot read "${txtPath}": ${String(err)}`,
    );
  }

  const name = path.basename(noteDir);
  return { name, content };
}

/**
 * Build the `notes/<name>.md` file content this note's real text is
 * preserved into — a thin Markdown wrapper (title + verbatim body) rather
 * than a bare copy of the `.txt`, so it reads sensibly sitting next to the
 * other generated `.md`/`.json` output.
 */
export function buildNoteMarkdown(note: NoteAsset): string {
  return `# ${note.name}

> Migrated from a GMS2 note resource (IDE-only documentation — this content
> has no equivalent in \`@emptysock/engine\` and is preserved here verbatim
> for reference, not loaded by the engine at runtime).

${note.content}
`;
}

/** The verbatim `.txt` body a note is preserved as (`notes/<name>.txt`). */
export function buildNoteText(note: NoteAsset): string {
  return note.content;
}
