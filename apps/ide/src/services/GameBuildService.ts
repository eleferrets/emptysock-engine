/**
 * GameBuildService — orchestrates hot-reload builds for the IDE editor.
 *
 * In production this would invoke a Tauri command backed by esbuild on the
 * native side. The real implementation would call:
 *   import { buildForPreview } from '@emptysock/export-utils';
 * and delegate to that. For now the service does lightweight in-process
 * validation to keep the web prototype dependency-free at runtime.
 */

export interface BuildJob {
  code: string;
  mode: 'debug' | 'release';
  onStart: () => void;
  onComplete: (result: {
    success: boolean;
    errors: string[];
    duration: number;
    byteSize: number;
  }) => void;
}

type BuildJobResult = {
  success: boolean;
  errors: string[];
  duration: number;
  byteSize: number;
};

function countChar(str: string, ch: string): number {
  let count = 0;
  for (const c of str) {
    if (c === ch) count++;
  }
  return count;
}

function validateCode(code: string): string[] {
  const errors: string[] = [];

  // Check for unmatched braces (simple heuristic)
  const opens = countChar(code, '{');
  const closes = countChar(code, '}');
  if (opens !== closes) {
    errors.push(`Unmatched braces: ${opens} '{' vs ${closes} '}'`);
  }

  // Check for import statements — they should be present in a module
  // (This is informational; not an error if absent.)

  return errors;
}

function stripConsoleLog(code: string): string {
  // Simple regex replace to simulate console dropping in release mode.
  // The real esbuild 'drop' option handles this more robustly.
  return code.replace(/console\s*\.\s*log\s*\([^)]*\)\s*;?/g, '');
}

async function runBuild(
  code: string,
  mode: 'debug' | 'release'
): Promise<BuildJobResult> {
  const start = Date.now();

  const errors = validateCode(code);
  if (errors.length > 0) {
    const duration = Date.now() - start;
    return { success: false, errors, duration, byteSize: 0 };
  }

  let outputCode = code;
  if (mode === 'release') {
    outputCode = stripConsoleLog(outputCode);
  }

  // Add artificial 50–150ms to simulate esbuild transform latency
  const artificial = 50 + Math.floor(Math.random() * 100);
  await new Promise<void>(resolve => setTimeout(resolve, artificial));

  const duration = Date.now() - start;
  return {
    success: true,
    errors: [],
    duration,
    byteSize: outputCode.length,
  };
}

export class GameBuildService {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;

  constructor(debounceMs = 300) {
    this.debounceMs = debounceMs;
  }

  /** Queue a build — debounced so rapid edits coalesce into one build. */
  queueBuild(job: BuildJob): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      job.onStart();
      void runBuild(job.code, job.mode).then(result => {
        job.onComplete(result);
      });
    }, this.debounceMs);
  }

  /** Cancel any pending debounced build. */
  cancel(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Synchronous (awaitable) build for immediate use, e.g. triggered by Ctrl+S.
   * Cancels any pending debounced build first.
   */
  async buildNow(
    job: Omit<BuildJob, 'onStart' | 'onComplete'>
  ): Promise<BuildJobResult> {
    this.cancel();
    return runBuild(job.code, job.mode);
  }

  /** Clean up — cancel any pending timers. */
  destroy(): void {
    this.cancel();
  }
}

/** Singleton GameBuildService for use across the IDE. */
export const gameBuildService = new GameBuildService(300);
