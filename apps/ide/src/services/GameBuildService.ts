/**
 * GameBuildService — transforms TypeScript/JavaScript source using esbuild-wasm,
 * bundling it as an IIFE with @emptysock/engine resolved to the pre-bundled
 * window.EmptySockEngine global.
 *
 * Supports a virtualFiles map for multi-file projects: relative imports in the
 * entry file are resolved against the in-memory file system.
 */

import type * as esbuild from "esbuild-wasm";
import { loadSettings } from "./SettingsService";
import { useIDEStore } from "../store/ideStore";

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
  mode: "debug" | "release";
  aggressiveMode?: boolean;
  target?: string[];
  virtualFiles?: Record<string, string>;
  define?: Record<string, string>;
  format?: "esm" | "iife";
  onStart: () => void;
  onComplete: (result: BuildJobResult) => void;
};

// `esbuild` namespace used as a type reference — the static import is `import type`
// so Vite/Rollup does not include esbuild-wasm in the initial chunk.
type EsBuildModule = typeof esbuild;

let esbuildReady: Promise<EsBuildModule> | null = null;

function ensureEsbuild(buildWorkers?: number): Promise<EsBuildModule> {
  if (esbuildReady === null) {
    const workers = buildWorkers ?? loadSettings().buildWorkers;
    esbuildReady = (async () => {
      const mod = (await import("esbuild-wasm")) as EsBuildModule;
      await mod.initialize({ wasmURL: "/esbuild.wasm", worker: workers > 1 });
      return mod;
    })();
  }
  return esbuildReady;
}

function loaderForFilename(filename: string): esbuild.Loader {
  const ext = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  switch (ext) {
    case "js":
      return "js";
    case "jsx":
      return "jsx";
    case "tsx":
      return "tsx";
    case "ts":
    default:
      return "ts";
  }
}

function normalizePath(base: string, rel: string): string {
  const dir = base.includes("/")
    ? base.slice(0, base.lastIndexOf("/") + 1)
    : "";
  const parts = (dir + rel).split("/");
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === "..") resolved.pop();
    else if (p !== ".") resolved.push(p);
  }
  return resolved.join("/");
}

function resolveVirtualPath(
  importer: string,
  path: string,
  files: Record<string, string>,
): string | null {
  const candidates = ["", ".ts", ".tsx", ".js", "/index.ts", "/index.js"];
  const base = normalizePath(importer, path);
  for (const ext of candidates) {
    if (files[base + ext] !== undefined) return base + ext;
  }
  return null;
}

const engineGlobalPlugin: esbuild.Plugin = {
  name: "engine-global",
  setup(build) {
    build.onResolve({ filter: /^@emptysock\/engine$/ }, () => ({
      path: "@emptysock/engine",
      namespace: "engine-global",
    }));
    build.onLoad({ filter: /.*/, namespace: "engine-global" }, () => ({
      contents: "module.exports = window.EmptySockEngine",
      loader: "js",
    }));
  },
};

function virtualFsPlugin(files: Record<string, string>): esbuild.Plugin {
  return {
    name: "virtual-fs",
    setup(build) {
      build.onResolve({ filter: /^\./ }, (args) => {
        const resolved = resolveVirtualPath(args.importer, args.path, files);
        if (resolved !== null)
          return { path: resolved, namespace: "virtual-fs" };
        return null;
      });
      build.onLoad({ filter: /.*/, namespace: "virtual-fs" }, (args) => {
        const content = files[args.path];
        if (content === undefined) return null;
        return { contents: content, loader: loaderForFilename(args.path) };
      });
    },
  };
}

function checkVirtualFilesCompleteness(
  virtualFiles: Record<string, string>,
): void {
  const addLog = useIDEStore.getState().addLog;
  const importRe = /from\s+['"](\.[^'"]+)['"]/g;
  for (const [importer, content] of Object.entries(virtualFiles)) {
    let match: RegExpExecArray | null;
    importRe.lastIndex = 0;
    while ((match = importRe.exec(content)) !== null) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      const resolved = normalizePath(importer, specifier);
      const candidates = ["", ".ts", ".tsx", ".js", "/index.ts", "/index.js"];
      const found = candidates.some(
        (ext) => virtualFiles[resolved + ext] !== undefined,
      );
      if (!found) {
        addLog(
          "warn",
          `Build: missing virtual file "${resolved}" — open it in the editor before building`,
          "BuildService",
        );
      }
    }
  }
}

function validateDefines(define: Record<string, string>): void {
  const required = [
    "PROJECT_TITLE",
    "GAME_WIDTH",
    "GAME_HEIGHT",
    "DEBUG",
  ] as const;
  const addLog = useIDEStore.getState().addLog;
  for (const key of required) {
    if (define[key] === undefined) {
      addLog(
        "warn",
        `Build: missing define "${key}" — bundle will contain undefined references`,
        "BuildService",
      );
    }
  }
}

async function runBuild(
  code: string,
  mode: "debug" | "release",
  filename = "game.ts",
  aggressiveMode = false,
  virtualFiles: Record<string, string> = {},
  target: string[] = ["es2026"],
  define: Record<string, string> = {},
  format: "esm" | "iife" = "esm",
): Promise<BuildJobResult> {
  validateDefines(define);
  checkVirtualFilesCompleteness(virtualFiles);
  const start = Date.now();
  try {
    const eb = await ensureEsbuild();
    const isRelease = mode === "release";
    const loader = loaderForFilename(filename);

    const result = await eb.build({
      stdin: { contents: code, loader, sourcefile: filename },
      bundle: true,
      format,
      define,
      minify: isRelease,
      ...(isRelease && aggressiveMode
        ? {
            minifyIdentifiers: true,
            minifySyntax: true,
            minifyWhitespace: true,
            treeShaking: true,
          }
        : {}),
      sourcemap: mode === "debug" ? "inline" : false,
      target,
      ...(isRelease ? { drop: ["console"] as const } : {}),
      plugins: [engineGlobalPlugin, virtualFsPlugin(virtualFiles)],
      write: false,
    });

    const errors = result.errors.map(
      (e) =>
        `${e.location?.file ?? filename}:${e.location?.line ?? 0}: ${e.text}`,
    );
    if (errors.length > 0) {
      return {
        success: false,
        errors,
        duration: Date.now() - start,
        byteSize: 0,
        js: "",
      };
    }
    const js = result.outputFiles[0]?.text ?? "";
    return {
      success: true,
      errors: [],
      duration: Date.now() - start,
      byteSize: js.length,
      js,
    };
  } catch (e: unknown) {
    const errors: string[] = [];
    if (e !== null && typeof e === "object" && "errors" in e) {
      const eb = e as { errors: Array<{ text: string }> };
      errors.push(...eb.errors.map((err) => err.text));
    } else {
      errors.push(String(e));
    }
    return {
      success: false,
      errors,
      duration: Date.now() - start,
      byteSize: 0,
      js: "",
    };
  }
}

export class GameBuildService {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;

  constructor(debounceMs = 300) {
    this.debounceMs = debounceMs;
    // Pre-warm: kick off the dynamic import + WASM init so first build is fast
    void ensureEsbuild(loadSettings().buildWorkers);
  }

  queueBuild(job: BuildJob): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      job.onStart();
      void runBuild(
        job.code,
        job.mode,
        job.filename,
        job.aggressiveMode,
        job.virtualFiles,
        job.target,
        job.define,
        job.format,
      ).then((r) => job.onComplete(r));
    }, this.debounceMs);
  }

  cancel(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  async buildNow(
    job: Omit<BuildJob, "onStart" | "onComplete">,
  ): Promise<BuildJobResult> {
    this.cancel();
    return runBuild(
      job.code,
      job.mode,
      job.filename,
      job.aggressiveMode,
      job.virtualFiles,
      job.target,
      job.define,
      job.format,
    );
  }

  async transformOnly(code: string, filename: string): Promise<string> {
    const eb = await ensureEsbuild();
    const loader = loaderForFilename(filename);
    const result = await eb.transform(code, {
      loader,
      format: "esm",
      target: ["es2026"],
    });
    return result.code;
  }

  destroy(): void {
    this.cancel();
  }
}

export const gameBuildService = new GameBuildService(300);
