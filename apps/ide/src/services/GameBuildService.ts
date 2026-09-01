/**
 * GameBuildService — transforms TypeScript/JavaScript source using esbuild-wasm,
 * bundling it as an IIFE with @emptysock/engine resolved to the pre-bundled
 * window.EmptySockEngine global.
 *
 * Supports a virtualFiles map for multi-file projects: relative imports in the
 * entry file are resolved against the in-memory file system.
 */

import * as esbuild from 'esbuild-wasm';
import esbuildWasmUrl from 'esbuild-wasm/esbuild.wasm?url';

export interface BuildJobResult {
  success: boolean;
  errors: string[];
  duration: number;
  byteSize: number;
  js: string;
}

type BuildJob = {
  code: string;
  filename?: string;
  mode: 'debug' | 'release';
  aggressiveMode?: boolean;
  target?: string[];
  virtualFiles?: Record<string, string>;
  onStart: () => void;
  onComplete: (result: BuildJobResult) => void;
};

let esbuildReady: Promise<void> | null = null;

function ensureEsbuild(): Promise<void> {
  if (esbuildReady === null) {
    esbuildReady = esbuild.initialize({
      wasmURL: esbuildWasmUrl,
      worker: true,
    });
  }
  return esbuildReady;
}

function loaderForFilename(filename: string): esbuild.Loader {
  const ext = filename.slice(filename.lastIndexOf('.') + 1).toLowerCase();
  switch (ext) {
    case 'js':  return 'js';
    case 'jsx': return 'jsx';
    case 'tsx': return 'tsx';
    case 'ts':
    default:    return 'ts';
  }
}

function normalizePath(base: string, rel: string): string {
  const dir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const parts = (dir + rel).split('/');
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === '..') resolved.pop();
    else if (p !== '.') resolved.push(p);
  }
  return resolved.join('/');
}

function resolveVirtualPath(importer: string, path: string, files: Record<string, string>): string | null {
  const candidates = ['', '.ts', '.tsx', '.js', '/index.ts', '/index.js'];
  const base = normalizePath(importer, path);
  for (const ext of candidates) {
    if (files[base + ext] !== undefined) return base + ext;
  }
  return null;
}

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

function virtualFsPlugin(files: Record<string, string>): esbuild.Plugin {
  return {
    name: 'virtual-fs',
    setup(build) {
      build.onResolve({ filter: /^\./ }, (args) => {
        const resolved = resolveVirtualPath(args.importer, args.path, files);
        if (resolved !== null) return { path: resolved, namespace: 'virtual-fs' };
        return null;
      });
      build.onLoad({ filter: /.*/, namespace: 'virtual-fs' }, (args) => {
        const content = files[args.path];
        if (content === undefined) return null;
        return { contents: content, loader: loaderForFilename(args.path) };
      });
    },
  };
}

async function runBuild(
  code: string,
  mode: 'debug' | 'release',
  filename = 'game.ts',
  aggressiveMode = false,
  virtualFiles: Record<string, string> = {},
  target: string[] = ['es2020'],
): Promise<BuildJobResult> {
  const start = Date.now();
  try {
    await ensureEsbuild();
    const isRelease = mode === 'release';
    const loader = loaderForFilename(filename);

    const result = await esbuild.build({
      stdin: { contents: code, loader, sourcefile: filename },
      bundle: true,
      format: 'iife',
      globalName: 'UserGame',
      minify: isRelease,
      ...(isRelease && aggressiveMode ? {
        minifyIdentifiers: true,
        minifySyntax: true,
        minifyWhitespace: true,
        treeShaking: true,
      } : {}),
      sourcemap: mode === 'debug' ? 'inline' : false,
      target,
      ...(isRelease ? { drop: ['console'] as const } : {}),
      plugins: [engineGlobalPlugin, virtualFsPlugin(virtualFiles)],
      write: false,
    });

    const errors = result.errors.map(e => `${e.location?.file ?? filename}:${e.location?.line ?? 0}: ${e.text}`);
    if (errors.length > 0) {
      return { success: false, errors, duration: Date.now() - start, byteSize: 0, js: '' };
    }
    const js = result.outputFiles[0]?.text ?? '';
    return { success: true, errors: [], duration: Date.now() - start, byteSize: js.length, js };
  } catch (e: unknown) {
    const errors: string[] = [];
    if (e !== null && typeof e === 'object' && 'errors' in e) {
      const eb = e as { errors: Array<{ text: string }> };
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
    void ensureEsbuild();
  }

  queueBuild(job: BuildJob): void {
    if (this.debounceTimer !== null) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      job.onStart();
      void runBuild(job.code, job.mode, job.filename, job.aggressiveMode, job.virtualFiles, job.target).then(r => job.onComplete(r));
    }, this.debounceMs);
  }

  cancel(): void {
    if (this.debounceTimer !== null) { clearTimeout(this.debounceTimer); this.debounceTimer = null; }
  }

  async buildNow(job: Omit<BuildJob, 'onStart' | 'onComplete'>): Promise<BuildJobResult> {
    this.cancel();
    return runBuild(job.code, job.mode, job.filename, job.aggressiveMode, job.virtualFiles, job.target);
  }

  destroy(): void { this.cancel(); }
}

export const gameBuildService = new GameBuildService(300);
