/**
 * GameBuildService — transforms the editor's TypeScript source using
 * esbuild-wasm, bundling it as an IIFE with @emptysock/engine resolved
 * to the pre-bundled window.EmptySockEngine global.
 */

import * as esbuild from 'esbuild-wasm';

export interface BuildJobResult {
  success: boolean;
  errors: string[];
  duration: number;
  byteSize: number;
  js: string;
}

type BuildJob = {
  code: string;
  mode: 'debug' | 'release';
  onStart: () => void;
  onComplete: (result: BuildJobResult) => void;
};

let esbuildReady: Promise<void> | null = null;

function ensureEsbuild(): Promise<void> {
  if (esbuildReady === null) {
    esbuildReady = esbuild.initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm@0.25.5/esbuild.wasm',
      worker: true,
    });
  }
  return esbuildReady;
}

// esbuild plugin: resolves @emptysock/engine to window.EmptySockEngine
const engineGlobalPlugin: esbuild.Plugin = {
  name: 'engine-global',
  setup(build) {
    build.onResolve({ filter: /^@emptysock\/engine$/ }, () => ({
      path: '@emptysock/engine',
      namespace: 'engine-global',
    }));
    build.onLoad({ filter: /.*/, namespace: 'engine-global' }, () => ({
      contents: 'module.exports = window.EmptySockEngine',
      loader: 'js',
    }));
  },
};

async function runBuild(code: string, mode: 'debug' | 'release'): Promise<BuildJobResult> {
  const start = Date.now();
  try {
    await ensureEsbuild();

    const result = await esbuild.build({
      stdin: {
        contents: code,
        loader: 'ts',
        sourcefile: 'game.ts',
      },
      bundle: true,
      format: 'iife',
      globalName: 'UserGame',
      minify: mode === 'release',
      sourcemap: mode === 'debug' ? 'inline' : false,
      target: ['es2020'],
      ...(mode === 'release' ? { drop: ['console'] as const } : {}),
      plugins: [engineGlobalPlugin],
      write: false,
    });

    const errors = result.errors.map(e => `${e.location?.file ?? 'game.ts'}:${e.location?.line ?? 0}: ${e.text}`);
    if (errors.length > 0) {
      return { success: false, errors, duration: Date.now() - start, byteSize: 0, js: '' };
    }

    const js = result.outputFiles[0]?.text ?? '';
    return { success: true, errors: [], duration: Date.now() - start, byteSize: js.length, js };
  } catch (e: unknown) {
    const errors: string[] = [];
    if (e !== null && typeof e === 'object' && 'errors' in e) {
      const eb = e as { errors: Array<{ text: string; location?: { line?: number } | null }> };
      errors.push(...eb.errors.map(err => err.text));
    } else {
      errors.push(String(e));
    }
    return { success: false, errors, duration: Date.now() - start, byteSize: 0, js: '' };
  }
}

export class GameBuildService {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;

  constructor(debounceMs = 300) {
    this.debounceMs = debounceMs;
    // Kick off esbuild-wasm initialization eagerly so the first build is fast
    void ensureEsbuild();
  }

  queueBuild(job: BuildJob): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      job.onStart();
      void runBuild(job.code, job.mode).then(result => job.onComplete(result));
    }, this.debounceMs);
  }

  cancel(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  async buildNow(job: Omit<BuildJob, 'onStart' | 'onComplete'>): Promise<BuildJobResult> {
    this.cancel();
    return runBuild(job.code, job.mode);
  }

  destroy(): void {
    this.cancel();
  }
}

export const gameBuildService = new GameBuildService(300);
