import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { projectKey } from "./fixture.js";

/**
 * Committed per-project baseline for the fixture-gated tests
 * (`src/__tests__/golden/baseline.json`). Projects are keyed by
 * `projectKey` and labelled A..G; no project name or content is stored.
 *
 * Counts are ceilings: a run may report fewer (a fix) but never more. The
 * target for every count except `tscErrorLines` is zero.
 */
export interface ProjectBaseline {
  label: string;
  /** Generated behavior/script modules that fail to load. */
  loadFailures: number;
  /** Distinct `GmlBehaviorSystem` handler errors over a full 600-frame walk. */
  handlerErrors: number;
  /** `tsc --noEmit` error lines over the generated output. */
  tscErrorLines: number;
}

export interface Baseline {
  projects: Record<string, ProjectBaseline>;
}

export const BASELINE_PATH = path.join(
  __dirname,
  "..",
  "golden",
  "baseline.json",
);

export function readBaseline(): Baseline {
  return JSON.parse(readFileSync(BASELINE_PATH, "utf8")) as Baseline;
}

export function writeBaseline(b: Baseline): void {
  writeFileSync(BASELINE_PATH, JSON.stringify(b, null, 2) + "\n", "utf8");
}

/** Baseline entry for a `.yyp`; an unknown project gets a strict all-zero ceiling. */
export function baselineFor(yyp: string): ProjectBaseline {
  return (
    readBaseline().projects[projectKey(yyp)] ?? {
      label: "?",
      loadFailures: 0,
      handlerErrors: 0,
      tscErrorLines: 0,
    }
  );
}
