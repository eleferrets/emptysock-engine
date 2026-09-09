/**
 * copy-docs.mjs — copies docs/manual/ into public/manual/ so the
 * manual is available offline at /manual/ in both dev and production builds.
 *
 * Run automatically via the predev / prebuild npm scripts.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../../../docs/manual');
const outDir = path.resolve(__dirname, '../public/manual');

fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.md'));

for (const file of files) {
  fs.copyFileSync(path.join(srcDir, file), path.join(outDir, file));
}

// Generate a simple HTML index so the browser renders something useful
// at /manual/ rather than a 404 or raw file listing.
const sections = [
  { file: '01-prerequisites.md',    title: '1 — Prerequisites & Required SDKs' },
  { file: '02-getting-started.md',  title: '2 — Getting Started' },
  { file: '03-architecture.md',     title: '3 — Architecture Overview' },
  { file: '04-core-reference.md',   title: '4 — Core Engine Reference' },
  { file: '05-systems-reference.md',title: '5 — Systems Reference' },
  { file: '06-actor-model.md',      title: '6 — Actor Model & Multiplayer' },
  { file: '07-ide-reference.md',    title: '7 — IDE Reference' },
  { file: '08-tutorial-pong.md',    title: '8 — Tutorial: Build a Pong Clone' },
  { file: '09-troubleshooting.md',  title: '9 — Troubleshooting' },
  { file: '10-language-reference.md', title: '10 — TypeScript & JavaScript Language Reference' },
  { file: '11-gms2-migration.md',     title: '11 — GameMaker Studio 2 Migration Guide' },
];

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>EmptySock Engine — Offline Manual</title>
<style>
  :root { color-scheme: dark light; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    max-width: 720px;
    margin: 48px auto;
    padding: 0 24px;
    background: #0f0f12;
    color: #e2e2e8;
    line-height: 1.7;
  }
  h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 8px; color: #fff; }
  p.subtitle { color: #888; margin-top: 0; font-size: 0.9rem; }
  hr { border: none; border-top: 1px solid #2a2a35; margin: 28px 0; }
  ol { padding-left: 1.4em; }
  li { margin: 10px 0; }
  a {
    color: #9d8ffa;
    text-decoration: none;
    font-size: 1rem;
  }
  a:hover { text-decoration: underline; color: #bdb0fc; }
  .note {
    background: #1a1a22;
    border-left: 3px solid #4a4a5a;
    padding: 12px 16px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: #aaa;
    margin-top: 32px;
  }
  @media (prefers-color-scheme: light) {
    body { background: #fafafa; color: #1a1a2e; }
    a { color: #5a4fd8; }
    a:hover { color: #3a2fb8; }
    .note { background: #f0f0f8; border-left-color: #ccc; color: #666; }
    hr { border-top-color: #e0e0ea; }
  }
</style>
</head>
<body>
<h1>EmptySock Engine — Offline Manual</h1>
<p class="subtitle">All sections are available offline. Click any section to open it in the browser.</p>
<hr>
<ol>
${sections.map(s => `  <li><a href="${s.file}">${s.title}</a></li>`).join('\n')}
</ol>
<hr>
<p class="note">
  <strong>Tip:</strong> These are Markdown files. Your browser renders them as plain text —
  paste the URL into a Markdown viewer or IDE extension for formatted output.
  In desktop (Tauri) mode the manual opens in the system browser.
</p>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'index.html'), html);

// Copy api-reference.json to public/ so Help → API Reference works offline.
const apiSrc = path.resolve(__dirname, '../../../api-reference.json');
const apiDst = path.resolve(__dirname, '../public/api-reference.json');
if (fs.existsSync(apiSrc)) {
  fs.copyFileSync(apiSrc, apiDst);
}

// Copy esbuild.wasm to public/ so it is served with the correct MIME type
// in both dev and production, eliminating the CDN dependency on unpkg.
const wasmSrc = path.resolve(__dirname, '../../../node_modules/.pnpm/esbuild-wasm@0.28.2/node_modules/esbuild-wasm/esbuild.wasm');
const wasmFallback = path.resolve(__dirname, '../node_modules/esbuild-wasm/esbuild.wasm');
const wasmDst = path.resolve(__dirname, '../public/esbuild.wasm');
const wasmResolved = fs.existsSync(wasmSrc) ? wasmSrc : fs.existsSync(wasmFallback) ? wasmFallback : null;
if (wasmResolved) {
  fs.copyFileSync(wasmResolved, wasmDst);
} else {
  // Resolve via require.resolve if pnpm layout differs
  try {
    const { createRequire } = await import('module');
    const req = createRequire(import.meta.url);
    const resolved = req.resolve('esbuild-wasm/esbuild.wasm');
    fs.copyFileSync(resolved, wasmDst);
  } catch {
    console.warn('[copy-docs] could not locate esbuild-wasm/esbuild.wasm — skipping');
  }
}

console.log(`[copy-docs] copied ${files.length} manual pages → public/manual/ and api-reference.json → public/`);
