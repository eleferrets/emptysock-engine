/**
 * Bundles @emptysock/engine as a self-contained IIFE that sets
 * window.EmptySockEngine = { ...all exports }.
 *
 * Output: src/runtime/engineBundle.generated.ts
 * Run automatically via the predev / prebuild npm scripts.
 */

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const engineEntry = resolve(__dirname, '../../packages/engine/src/index.ts');
const outDir = resolve(__dirname, 'src/runtime');
const outFile = resolve(outDir, 'engineBundle.generated.ts');

console.log('[engine-runtime] Bundling engine as IIFE...');

const result = await build({
  configFile: false,
  logLevel: 'warn',
  resolve: {
    alias: {
      '@emptysock/engine': engineEntry,
    },
  },
  optimizeDeps: {
    exclude: ['@dimforge/rapier2d-compat'],
  },
  build: {
    write: false,
    minify: false,
    lib: {
      entry: engineEntry,
      name: 'EmptySockEngine',
      formats: ['iife'],
      fileName: () => 'engine.iife.js',
    },
    rollupOptions: {
      output: {
        name: 'EmptySockEngine',
      },
    },
  },
});

const output = Array.isArray(result) ? result[0] : result;
const chunk = output.output.find(c => c.type === 'chunk' && c.isEntry);
if (!chunk || chunk.type !== 'chunk') {
  console.error('[engine-runtime] No entry chunk found in build output');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

writeFileSync(
  outFile,
  `// AUTO-GENERATED — do not edit. Run \`pnpm engine-runtime\` to regenerate.\n` +
  `// eslint-disable\n` +
  `export const ENGINE_BUNDLE: string = ${JSON.stringify(chunk.code)};\n`,
  'utf-8'
);

console.log(`[engine-runtime] Written to ${outFile} (${(chunk.code.length / 1024).toFixed(1)} KB)`);
