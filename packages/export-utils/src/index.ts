import { build, type BuildOptions } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProjectManifestSchema } from '../../types/dist/index.js';

export interface ExportConfig {
  projectDir: string;
  outDir: string;
  minify?: boolean;
  sourcemap?: boolean;
  target?: string[];
}

export interface ExportResult {
  success: boolean;
  outputFiles: string[];
  errors: string[];
  duration: number;
}

export async function exportGame(config: ExportConfig): Promise<ExportResult> {
  const start = Date.now();
  const errors: string[] = [];
  const outputFiles: string[] = [];

  // Load and validate project manifest
  let entryPoint = 'src/main.ts';
  try {
    const manifestPath = join(config.projectDir, 'emptysock.project.json');
    const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown;
    const manifest = ProjectManifestSchema.parse(raw);
    entryPoint = manifest.entryPoint;
  } catch (e) {
    errors.push(`Failed to load project manifest: ${String(e)}`);
    return { success: false, outputFiles, errors, duration: Date.now() - start };
  }

  const buildOptions: BuildOptions = {
    entryPoints: [join(config.projectDir, entryPoint)],
    outfile: join(config.outDir, 'game.js'),
    bundle: true,
    minify: config.minify ?? true,
    sourcemap: config.sourcemap ?? false,
    target: config.target ?? ['es2020'],
    format: 'iife',
    globalName: 'EmptySockGame',
    loader: {
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.svg': 'dataurl',
      '.mp3': 'dataurl',
      '.ogg': 'dataurl',
      '.wav': 'dataurl',
      '.woff2': 'dataurl',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  };

  try {
    const result = await build(buildOptions);

    if (result.errors.length > 0) {
      errors.push(...result.errors.map(e => e.text));
      return { success: false, outputFiles, errors, duration: Date.now() - start };
    }

    outputFiles.push(join(config.outDir, 'game.js'));
    return { success: true, outputFiles, errors, duration: Date.now() - start };
  } catch (e) {
    errors.push(String(e));
    return { success: false, outputFiles, errors, duration: Date.now() - start };
  }
}

export interface BundleAnalysis {
  totalBytes: number;
  gzippedEstimate: number;
  modules: Array<{ path: string; bytes: number }>;
}

export async function analyzeBundle(projectDir: string): Promise<BundleAnalysis> {
  const result = await build({
    entryPoints: [join(projectDir, 'src/main.ts')],
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
  });

  const metafile = result.metafile;
  if (metafile === undefined) {
    return { totalBytes: 0, gzippedEstimate: 0, modules: [] };
  }

  const modules = Object.entries(metafile.inputs).map(([path, info]) => ({
    path,
    bytes: info.bytes,
  }));

  const totalBytes = modules.reduce((sum, m) => sum + m.bytes, 0);

  return {
    totalBytes,
    gzippedEstimate: Math.round(totalBytes * 0.3), // rough gzip estimate
    modules: modules.sort((a, b) => b.bytes - a.bytes),
  };
}
